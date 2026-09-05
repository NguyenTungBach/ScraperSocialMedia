'use strict';

const youtubeConfig = require('../../../../config/youtube');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');
const { ScraperAsyncType } = require('../../../Constants/ScraperAsyncStatus');
const YouTubeTailRefreshService = require('../../../Services/YouTubeTailRefreshService');
const ScraperAsyncService = require('../../../Services/ScraperAsyncService');
const ScraperAsyncQueueHealth = require('../../../Services/ScraperAsyncQueueHealth');

class ScraperController {
    constructor() {
        this.youtubeTailRefreshService = new YouTubeTailRefreshService();
    }

    /**
     * @param {import('express').Response} res
     * @param {Error & { statusCode?: number, data?: object }} e
     * @param {import('express').NextFunction} next
     */
    handleEnqueueError(res, e, next) {
        if (e.statusCode === 409 && e.data) {
            return ResponseService.responseJsonError(
                res,
                HTTP_STATUS.CONFLICT,
                e.message,
                null,
                null,
                e.data
            );
        }
        if (e.statusCode === 422) {
            return ResponseService.responseJsonError(res, HTTP_STATUS.UNPROCESSABLE_ENTITY, e.message);
        }
        if (e.statusCode === 400) {
            return ResponseService.responseJsonError(res, HTTP_STATUS.BAD_REQUEST, e.message);
        }
        return next(e);
    }

    /**
     * @openapi
     * /scraper/facebook/run:
     *   post:
     *     tags: [Scraper]
     *     summary: Enqueue cào bài Facebook (async) — trả 202 + async_job_id
     *     description: |
     *       Body nhận `channel_id[]` (`type_channel=facebook`). Optional `subject_id` cho scope_key.
     *       Worker chạy scrape + Gemini; FE poll `GET /scraper/async-status/:id`.
     *       CLI sync: `npm run app:facebook-scrape`.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/FacebookScrapeRequest'
     *     responses:
     *       "202":
     *         description: Job enqueued
     *       "409":
     *         description: Job đã đang chạy cho cùng scope
     */
    async runFacebook(req, res, next) {
        try {
            const data = req.validatedData || {};
            const result = await ScraperAsyncService.enqueue(
                ScraperAsyncType.FACEBOOK_SCRAPE,
                data,
                req.user
            );
            return res.status(HTTP_STATUS.ACCEPTED).json({
                code: HTTP_STATUS.ACCEPTED,
                data: result,
            });
        } catch (error) {
            return this.handleEnqueueError(res, error, next);
        }
    }

    /**
     * @openapi
     * /scraper/youtube/run:
     *   post:
     *     tags: [Scraper]
     *     summary: Enqueue cào video YouTube (async) — trả 202 + async_job_id
     *     description: |
     *       Body nhận `channel_id[]`. Optional `subject_id` cho scope_key.
     *       Worker chạy scrape + Gemini; FE poll `GET /scraper/async-status/:id`.
     *       CLI sync: `npm run app:youtube-scrape`.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/YoutubeScrapeRequest'
     *     responses:
     *       "202":
     *         description: Job enqueued
     *       "409":
     *         description: Job đã đang chạy cho cùng scope
     */
    async runYoutube(req, res, next) {
        try {
            const data = req.validatedData || {};
            const result = await ScraperAsyncService.enqueue(
                ScraperAsyncType.YOUTUBE_SCRAPE,
                data,
                req.user
            );
            return res.status(HTTP_STATUS.ACCEPTED).json({
                code: HTTP_STATUS.ACCEPTED,
                data: result,
            });
        } catch (error) {
            return this.handleEnqueueError(res, error, next);
        }
    }

    /**
     * @openapi
     * /scraper/tiktok/run:
     *   post:
     *     tags: [Scraper]
     *     summary: Enqueue cào video TikTok (async) — trả 202 + async_job_id
     *     description: |
     *       Body nhận `channel_id[]`. Optional `subject_id` cho scope_key.
     *       Worker chạy scrape + Gemini; FE poll `GET /scraper/async-status/:id`.
     *       CLI sync: `npm run app:tiktok-scrape`.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/TikTokScrapeRequest'
     *     responses:
     *       "202":
     *         description: Job enqueued
     *       "409":
     *         description: Job đã đang chạy cho cùng scope
     */
    async runTikTok(req, res, next) {
        try {
            const data = req.validatedData || {};
            const result = await ScraperAsyncService.enqueue(
                ScraperAsyncType.TIKTOK_SCRAPE,
                data,
                req.user
            );
            return res.status(HTTP_STATUS.ACCEPTED).json({
                code: HTTP_STATUS.ACCEPTED,
                data: result,
            });
        } catch (error) {
            return this.handleEnqueueError(res, error, next);
        }
    }

    /**
     * @openapi
     * /scraper/async-status/{id}:
     *   get:
     *     tags: [Scraper]
     *     summary: Poll trạng thái scrape async theo id
     *     security: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *         description: async_job_id trả về từ POST enqueue scrape (facebook|youtube|tiktok)/run
     *     responses:
     *       "200":
     *         description: pending | running | success | failed (+ result_json)
     *       "404":
     *         description: Không tìm thấy job
     */
    async showAsyncStatus(req, res, next) {
        try {
            const result = await ScraperAsyncService.getStatus(Number(req.params.id));
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result);
        } catch (error) {
            if (error.statusCode === 404) {
                return ResponseService.responseJsonError(res, HTTP_STATUS.NOT_FOUND, error.message);
            }
            return next(error);
        }
    }

    /**
     * @openapi
     * /scraper/async-status:
     *   get:
     *     tags: [Scraper]
     *     summary: Latest async job theo job_type + scope_key
     *     security: []
     *     parameters:
     *       - in: query
     *         name: job_type
     *         required: true
     *         schema:
     *           type: string
     *           enum: [facebook_scrape, youtube_scrape, tiktok_scrape]
     *       - in: query
     *         name: scope_key
     *         required: true
     *         schema: { type: string }
     *         description: "vd. subject:8 hoặc channels:2,3"
     *     responses:
     *       "200":
     *         description: Latest job hoặc null
     *       "422":
     *         description: Thiếu / sai query
     */
    async showLatestAsyncStatus(req, res, next) {
        try {
            const data = req.validatedData || {};
            const result = await ScraperAsyncService.getLatest(data.job_type, data.scope_key);
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /scraper/async-active:
     *   get:
     *     tags: [Scraper]
     *     summary: Các scrape job đang pending hoặc running
     *     security: []
     *     responses:
     *       "200":
     *         description: Danh sách job active
     */
    async listActiveAsync(_req, res, next) {
        try {
            const result = await ScraperAsyncService.listActive();
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /scraper/async-health:
     *   get:
     *     tags: [Scraper]
     *     summary: Chẩn đoán queue / stale async jobs
     *     security: []
     *     responses:
     *       "200":
     *         description: Health snapshot (stale, pending counts, …)
     */
    async asyncHealth(_req, res, next) {
        try {
            const result = await ScraperAsyncQueueHealth.evaluate();
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /scraper/youtube/refresh-tail:
     *   post:
     *     tags: [Scraper]
     *     summary: Refresh stats video YouTube tail (sau top N theo posted_at), không cào comment
     *     description: |
     *       Lấy video rank > `headSize` (mặc định 10) theo `posted_at` mỗi kênh trong DB.
     *       Gọi `videos.list` batch (tối đa 50 / `batchSize`) → cập nhật views/likes/commentCount.
     *       Dùng `offset` để paginate khi cron quét toàn bộ tail.
     *       Cron: workflow `youtube-stale-refresh-cron` / CLI `npm run app:youtube-refresh-tail`.
     *     security: []
     *     requestBody:
     *       required: false
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/YoutubeRefreshTailRequest'
     *     responses:
     *       "200":
     *         description: Batch refresh thành công
     *       "429":
     *         description: YouTube API quota exceeded
     *       "500":
     *         description: Thiếu hoặc sai YOUTUBE_API_KEY
     */
    async refreshYoutubeTail(req, res, next) {
        try {
            const data = req.validatedData || {};

            const result = await this.youtubeTailRefreshService.refreshBatch({
                headSize: data.headSize ?? youtubeConfig.headSize,
                batchSize: data.batchSize ?? youtubeConfig.tailBatchSize,
                offset: data.offset ?? 0,
            });

            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result);
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = ScraperController;
