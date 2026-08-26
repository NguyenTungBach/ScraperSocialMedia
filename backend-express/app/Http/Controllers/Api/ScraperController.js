'use strict';

const createError = require('http-errors');
const ApifyService = require('../../../Services/ApifyService');
const YouTubeService = require('../../../Services/YouTubeService');
const ScraperRepository = require('../../../Repositories/ScraperRepository');
const ChannelRepository = require('../../../Repositories/ChannelRepository');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');
const {
    extractHandleFromUrl,
    toYoutubeVideoResponse,
} = require('../../../Helpers/YouTubeHelper');

class ScraperController {
    constructor() {
        this.apifyService = new ApifyService();
        this.youtubeService = new YouTubeService();
        this.repository = new ScraperRepository();
        this.channelRepository = new ChannelRepository();
    }

    /**
     * @openapi
     * /scraper/apify/facebook/run:
     *   post:
     *     tags: [Scraper]
     *     summary: Chạy Apify Facebook scraper theo channel_id[]
     *     description: |
     *       Body nhận `channel_id[]` (ID bảng `channels` trong DB local).
     *       Backend lấy `url` từ DB → `startUrls` Apify → scrape mới.
     *       Upsert `scraper_runs` (kèm `channel_id`) → link subjects qua `subject_channels` → recompute `social_posts`.
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [channel_id]
     *             properties:
     *               channel_id:
     *                 type: array
     *                 minItems: 1
     *                 items: { type: integer, minimum: 1 }
     *                 description: ID kênh trong bảng `channels`
     *                 example: [2, 3]
     *               captionText:
     *                 type: boolean
     *                 description: Tuỳ chọn — truyền xuống input Apify Actor
     *               resultsLimit:
     *                 type: integer
     *                 minimum: 1
     *                 maximum: 100
     *                 description: Số bài tối đa mỗi kênh
     *                 example: 20
     *     responses:
     *       "200":
     *         description: Scrape + ingest thành công
     *       "422":
     *         description: channel_id không hợp lệ hoặc không có URL kênh
     */
    async run(req, res, next) {
        try {
            const data = req.validatedData || {};
            const channels = await this.channelRepository.findChannelsByIds({
                channel_id: data.channel_id || [],
            });
            const startUrls = this.channelRepository.buildStartUrls(channels);
            if (startUrls.length === 0) {
                throw createError(422, 'No valid channel URLs to scrape');
            }

            const overrides = {
                captionText: data.captionText,
                resultsLimit: data.resultsLimit,
                startUrls,
            };
            const { run, items, input } = await this.apifyService.runFacebookScraper(overrides);
            const ingest = await this.repository.ingestApifyItems({
                run,
                items,
                channels,
            });

            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, {
                source: 'apify',
                external_run_id: run.id,
                status: run.status,
                items_count: items.length,
                ...ingest,
                dataset_url: `https://console.apify.com/storage/datasets/${run.defaultDatasetId}`,
                console_url: `https://console.apify.com/actors/${run.actId}/runs/${run.id}`,
                input,
            });
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /scraper/apify/runs:
     *   get:
     *     tags: [Scraper]
     *     summary: Lịch sử Actor runs trên Apify
     *     description: |
     *       Danh sách run trên Apify Console ([actors/runs](https://console.apify.com/actors/runs)).
     *       Dùng field `id` trong `result[]` làm `runId` cho POST `/scraper/apify/facebook/run-from-history`.
     *     security: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema: { type: integer, minimum: 1, default: 1 }
     *       - in: query
     *         name: per_page
     *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
     *       - in: query
     *         name: status
     *         schema: { type: string }
     *         description: Lọc theo trạng thái Apify (vd. SUCCEEDED, FAILED, RUNNING)
     *       - in: query
     *         name: desc
     *         schema: { type: boolean, default: true }
     *         description: Sắp xếp mới nhất trước
     *     responses:
     *       "200":
     *         description: OK — `result[]` chứa Apify run (`id`, `status`, `console_url`, …)
     */
    async listApifyRuns(req, res, next) {
        try {
            const page = Math.max(Number(req.validatedData?.page) || 1, 1);
            const per_page = Math.min(Math.max(Number(req.validatedData?.per_page) || 20, 1), 100);
            const offset = (page - 1) * per_page;
            const result = await this.apifyService.listActorRuns({
                limit: per_page,
                offset,
                status: req.validatedData?.status || null,
                desc: req.validatedData?.desc !== false,
            });

            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, {
                actor_id: result.actor_id,
                console_url: 'https://console.apify.com/actors/runs',
                ...ResponseService.responseJsonPaginated(
                    result.items,
                    page,
                    per_page,
                    result.total
                ),
            });
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /scraper/apify/facebook/run-from-history:
     *   post:
     *     tags: [Scraper]
     *     summary: Ingest dataset Apify run đã có theo channel_id[]
     *     description: |
     *       **Không chạy Actor mới** — chỉ đọc dataset của run Apify đã có.
     *
     *       1. `runId` — Apify Run ID (string), lấy từ GET `/scraper/apify/runs` → `result[].id`
     *          hoặc từ URL console `.../actors/{actId}/runs/{runId}`.
     *       2. `channel_id[]` — ID kênh trong bảng `channels` (DB local).
     *
     *       Mỗi bài được gán `scraper_runs.channel_id`, sau đó map sang subjects qua bảng `subject_channels`.
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [runId, channel_id]
     *             properties:
     *               runId:
     *                 type: string
     *                 minLength: 1
     *                 description: Apify Run ID (không phải channel_id hay subject_id)
     *                 example: "abc123XYZ"
     *               channel_id:
     *                 type: array
     *                 minItems: 1
     *                 items: { type: integer, minimum: 1 }
     *                 description: ID kênh trong bảng `channels`
     *                 example: [2, 3]
     *     responses:
     *       "200":
     *         description: Ingest thành công
     *       "400":
     *         description: Run chưa có dataset
     *       "404":
     *         description: Apify run không tồn tại
     *       "422":
     *         description: channel_id không hợp lệ
     */
    async runFromHistory(req, res, next) {
        try {
            const data = req.validatedData;
            const channels = await this.channelRepository.findChannelsByIds({
                channel_id: data.channel_id || [],
            });

            const { run, items } = await this.apifyService.getRunItems(data.runId);
            const ingest = await this.repository.ingestApifyItems({
                run,
                items,
                channels,
            });

            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, {
                source: 'apify_history',
                external_run_id: run.id,
                status: run.status,
                items_count: items.length,
                ...ingest,
                dataset_url: run.defaultDatasetId
                    ? `https://console.apify.com/storage/datasets/${run.defaultDatasetId}`
                    : null,
                console_url: `https://console.apify.com/actors/${run.actId}/runs/${run.id}`,
            });
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /scraper/apify/facebook/runs:
     *   get:
     *     tags: [Scraper]
     *     summary: Danh sách scraper_runs (bài trong DB local)
     *     security: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema: { type: integer, minimum: 1 }
     *       - in: query
     *         name: per_page
     *         schema: { type: integer, minimum: 1, maximum: 100 }
     *       - in: query
     *         name: q
     *         schema: { type: string }
     *         description: Tìm theo title/text/post_url
     *     responses:
     *       "200":
     *         description: OK — mỗi bài có `channel_id`
     */
    async listRuns(req, res, next) {
        try {
            const { rows, count, page, per_page } = await this.repository.listScraperRuns(req.validatedData);
            return ResponseService.responseJson(
                res,
                HTTP_STATUS.SUCCESS,
                ResponseService.responseJsonPaginated(rows, page, per_page, count)
            );
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /scraper/apify/facebook/runs/{id}:
     *   get:
     *     tags: [Scraper]
     *     summary: Chi tiết một scraper_run
     *     security: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *         description: ID bài trong bảng `scraper_runs` (DB local)
     *     responses:
     *       "200":
     *         description: OK
     *       "404":
     *         description: Không tìm thấy
     */
    async getRun(req, res, next) {
        try {
            const row = await this.repository.findScraperRunById(req.params.id);
            if (!row) {
                throw createError(404, 'Scraper run not found');
            }
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, row);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /scraper/youtube/run:
     *   post:
     *     tags: [Scraper]
     *     summary: Cào 10 video mới nhất từ kênh YouTube theo channel_id[]
     *     description: |
     *       Body nhận `channel_id[]` (ID bảng `channels`, `type_channel=youtube`).
     *       URL kênh phải dạng handle `@name` (vd. https://www.youtube.com/@taca).
     *
     *       Luồng YouTube Data API v3 (3 units quota / kênh):
     *       1. channels.list (forHandle) → uploads playlist ID
     *       2. playlistItems.list → 10 videoId mới nhất
     *       3. videos.list (batch) → title, publishedAt, viewCount, likeCount
     *
     *       Upsert `scraper_runs` (platform=youtube) → link subjects qua `subject_channels` → recompute `social_posts`.
     *       Share count không có trên YouTube API → lưu `shares=0`.
     *
     *       Yêu cầu `YOUTUBE_API_KEY` trong `.env`.
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [channel_id]
     *             properties:
     *               channel_id:
     *                 type: array
     *                 minItems: 1
     *                 items: { type: integer, minimum: 1 }
     *                 description: ID kênh YouTube trong bảng `channels`
     *                 example: [5]
     *               maxResults:
     *                 type: integer
     *                 minimum: 1
     *                 maximum: 50
     *                 description: Số video tối đa mỗi kênh (mặc định 10)
     *                 example: 10
     *     responses:
     *       "200":
     *         description: Scrape + ingest thành công
     *       "404":
     *         description: Kênh YouTube không tồn tại
     *       "422":
     *         description: channel_id không hợp lệ hoặc URL không parse được handle
     *       "429":
     *         description: YouTube API quota exceeded
     *       "500":
     *         description: Thiếu hoặc sai YOUTUBE_API_KEY
     */
    async runYoutube(req, res, next) {
        try {
            const data = req.validatedData || {};
            const channels = await this.channelRepository.findChannelsByIds({
                channel_id: data.channel_id || [],
            });

            const youtubeChannels = channels.filter(
                (ch) => String(ch.type_channel || '').toLowerCase() === 'youtube'
            );
            if (youtubeChannels.length === 0) {
                throw createError(
                    422,
                    'No YouTube channels found — channel_id must have type_channel=youtube'
                );
            }
            if (youtubeChannels.length !== channels.length) {
                throw createError(
                    422,
                    'One or more channel_id are not type_channel=youtube'
                );
            }

            const maxResults = data.maxResults;
            const allVideos = [];
            let quotaUsed = 0;
            const upsertTotals = {
                inserted: 0,
                updated: 0,
                skipped: 0,
                links_created: 0,
                unmatched_channel: 0,
            };
            const affectedSubjectIds = new Set();

            for (const channel of youtubeChannels) {
                const handle = extractHandleFromUrl(channel.url);
                if (!handle) {
                    throw createError(
                        422,
                        `Cannot parse YouTube @handle from channel url (id=${channel.id}): ${channel.url}`
                    );
                }

                const { videos, quota_used } =
                    await this.youtubeService.scrapeChannelByHandle(handle, {
                        maxResults,
                    });
                quotaUsed += quota_used || 3;

                const ingest = await this.repository.ingestYoutubeItems({
                    videos,
                    channels: [channel],
                    channel,
                });

                upsertTotals.inserted += ingest.upsert_stats.inserted;
                upsertTotals.updated += ingest.upsert_stats.updated;
                upsertTotals.skipped += ingest.upsert_stats.skipped;
                upsertTotals.links_created += ingest.upsert_stats.links_created;
                upsertTotals.unmatched_channel +=
                    ingest.upsert_stats.unmatched_channel;

                for (const sid of ingest.affected_subject_ids || []) {
                    affectedSubjectIds.add(sid);
                }

                for (const video of videos) {
                    allVideos.push(toYoutubeVideoResponse(video));
                }
            }

            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, {
                source: 'youtube_api',
                channels_scraped: youtubeChannels.length,
                items_count: allVideos.length,
                quota_used: quotaUsed,
                upsert_stats: upsertTotals,
                affected_subject_ids: [...affectedSubjectIds],
                videos: allVideos,
            });
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = ScraperController;
