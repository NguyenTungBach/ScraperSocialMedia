'use strict';

const youtubeConfig = require('../../../../config/youtube');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');
const YouTubeTailRefreshService = require('../../../Services/YouTubeTailRefreshService');
const YouTubeScrapeService = require('../../../Services/YouTubeScrapeService');
const TikTokScrapeService = require('../../../Services/TikTokScrapeService');
const FacebookScrapeService = require('../../../Services/FacebookScrapeService');

class ScraperController {
    constructor() {
        this.youtubeTailRefreshService = new YouTubeTailRefreshService();
        this.youtubeScrapeService = new YouTubeScrapeService();
        this.tiktokScrapeService = new TikTokScrapeService();
        this.facebookScrapeService = new FacebookScrapeService();
    }

    /**
     * @openapi
     * /scraper/facebook/run:
     *   post:
     *     tags: [Scraper]
     *     summary: Cào bài Facebook mới nhất + comments theo channel_id[]
     *     description: |
     *       Body nhận `channel_id[]` (`type_channel=facebook`). Mỗi kênh cần có `url` page/profile.
     *
     *       Pha 1 — Actor `KoJrdxJCTtpon81KY` (Facebook Posts): bài mới nhất (`maxResults`) → upsert `scraper_runs`.
     *       Pha 2 — Actor `apify/facebook-comments-scraper`: comment + reply theo post URLs → insert-only `post_comments`.
     *
     *       Yêu cầu `APIFY_API_TOKEN`. CLI: `npm run app:facebook-scrape`.
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/FacebookScrapeRequest'
     *     responses:
     *       "200":
     *         description: Scrape + ingest thành công (kèm upsert_stats, comment_stats, posts_run_id, comments_run_id)
     *       "422":
     *         description: channel_id không phải facebook hoặc thiếu url
     *       "500":
     *         description: Thiếu APIFY_API_TOKEN
     */
    async runFacebook(req, res, next) {
        try {
            const data = req.validatedData || {};
            const result = await this.facebookScrapeService.scrapeChannels({
                channel_id: data.channel_id || [],
                maxResults: data.maxResults,
                commentsPerPost: data.commentsPerPost,
                maxRepliesPerComment: data.maxRepliesPerComment,
            });
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /scraper/youtube/run:
     *   post:
     *     tags: [Scraper]
     *     summary: Cào video mới nhất + comment YouTube theo channel_id[]
     *     description: |
     *       Body nhận `channel_id[]` (ID bảng `channels`, `type_channel=youtube`).
     *       URL kênh hỗ trợ: `/@handle`, `/channel/UCxxx`, `/user/name`, `/c/CustomName`.
     *
     *       Luồng YouTube Data API v3:
     *       1. `channels.list` → uploads playlist + subscriberCount (`follow`)
     *       2. `playlistItems.list` → videoId mới nhất (`maxResults`, mặc định 10)
     *       3. `videos.list` → title, publishedAt, views, likes, commentCount
     *       4. `commentThreads.list` (+ `comments.list` nếu cần thêm reply) → comment / reply
     *
     *       Upsert `scraper_runs` → link subjects qua `subject_channels` → recompute `social_posts`.
     *       Comment insert-only vào `post_comments`. Shares không có trên API → `shares=0`.
     *
     *       Yêu cầu `YOUTUBE_API_KEY` trong `.env`. CLI: `npm run app:youtube-scrape`.
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/YoutubeScrapeRequest'
     *     responses:
     *       "200":
     *         description: Scrape + ingest thành công (kèm upsert_stats, comment_stats, quota_used)
     *       "404":
     *         description: Kênh YouTube không tồn tại
     *       "422":
     *         description: channel_id không hợp lệ hoặc URL không parse được
     *       "429":
     *         description: YouTube API quota exceeded
     *       "500":
     *         description: Thiếu hoặc sai YOUTUBE_API_KEY
     */
    async runYoutube(req, res, next) {
        try {
            const data = req.validatedData || {};
            const result = await this.youtubeScrapeService.scrapeChannels({
                channel_id: data.channel_id || [],
                maxResults: data.maxResults,
            });
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /scraper/tiktok/run:
     *   post:
     *     tags: [Scraper]
     *     summary: Cào video TikTok mới nhất + comments theo channel_id[]
     *     description: |
     *       Body nhận `channel_id[]` (`type_channel=tiktok`). Mỗi kênh cần có `url` profile.
     *
     *       Pha 1 — Actor `clockworks/free-tiktok-scraper`: video mới nhất (`resultsPerPage` / `maxResults`) → upsert `scraper_runs`.
     *       Pha 2 — Actor `BDec00yAmCm1QbMEI`: comment + reply theo `postURLs` → insert-only `post_comments`.
     *
     *       Yêu cầu `APIFY_API_TOKEN`. CLI: `npm run app:tiktok-scrape`.
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/TikTokScrapeRequest'
     *     responses:
     *       "200":
     *         description: Scrape + ingest thành công (kèm upsert_stats, comment_stats, video_run_id, comments_run_id)
     *       "422":
     *         description: channel_id không phải tiktok hoặc thiếu url
     *       "500":
     *         description: Thiếu APIFY_API_TOKEN
     */
    async runTikTok(req, res, next) {
        try {
            const data = req.validatedData || {};
            const result = await this.tiktokScrapeService.scrapeChannels({
                channel_id: data.channel_id || [],
                maxResults: data.maxResults,
                commentsPerPost: data.commentsPerPost,
                maxRepliesPerComment: data.maxRepliesPerComment,
            });
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
