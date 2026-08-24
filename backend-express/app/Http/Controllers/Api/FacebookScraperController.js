'use strict';

const createError = require('http-errors');
const ApifyService = require('../../../Services/ApifyService');
const FacebookScraperRepository = require('../../../Repositories/FacebookScraperRepository');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');

class FacebookScraperController {
    constructor() {
        this.apifyService = new ApifyService();
        this.repository = new FacebookScraperRepository();
    }

    /**
     * @openapi
     * /scraper/facebook/run:
     *   post:
     *     tags: [Scraper]
     *     summary: Chạy Facebook scraper qua Apify
     *     description: |
     *       Gọi Actor Apify, lưu vào `scraper_runs` + `social_posts`.
     *       Truyền `subject_id` để lấy URL từ `monitor_sources`.
     *       Bài trùng `(platform, platform_post_id)` sẽ được cập nhật engagement, không insert trùng.
     *     security: []
     *     requestBody:
     *       required: false
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               subject_id:
     *                 type: integer
     *                 example: 1
     *               captionText:
     *                 type: boolean
     *                 example: false
     *               resultsLimit:
     *                 type: integer
     *                 example: 5
     *               startUrls:
     *                 type: array
     *                 items:
     *                   oneOf:
     *                     - type: string
     *                     - type: object
     *                       properties:
     *                         url:
     *                           type: string
     *     responses:
     *       "200":
     *         description: Scrape thành công
     *       "422":
     *         description: Dữ liệu đầu vào không hợp lệ
     *       "500":
     *         description: Lỗi Apify hoặc cấu hình thiếu API token
     */
    async run(req, res, next) {
        try {
            const overrides = { ...(req.validatedData || {}) };
            const subjectId = overrides.subject_id ?? null;
            delete overrides.subject_id;

            let monitorSources = [];
            if (subjectId) {
                monitorSources = await this.repository.getActiveMonitorSources(subjectId);
                if (monitorSources.length === 0) {
                    throw createError(422, 'Subject has no active monitor_sources');
                }
                overrides.startUrls = monitorSources.map((source) => ({ url: source.source_url }));
            }

            const { run, items, input } = await this.apifyService.runFacebookScraper(overrides);
            const scraperRun = await this.repository.createRunFromApify({
                run,
                input,
                items,
                subjectId,
                monitorSources,
            });

            const upsertStats = scraperRun.get('upsert_stats') || { inserted: 0, updated: 0, skipped: 0 };

            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, {
                scraper_run_id: scraperRun.id,
                source: 'apify',
                external_run_id: run.id,
                status: run.status,
                subject_id: subjectId,
                items_count: items.length,
                upsert_stats: upsertStats,
                dataset_url: `https://console.apify.com/storage/datasets/${run.defaultDatasetId}`,
                console_url: `https://console.apify.com/actors/${run.actId}/runs/${run.id}`,
                input,
                items,
            });
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /scraper/facebook/runs:
     *   get:
     *     tags: [Scraper]
     *     summary: Danh sách lần chạy scraper đã lưu
     *     security: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema: { type: integer, minimum: 1 }
     *       - in: query
     *         name: per_page
     *         schema: { type: integer, minimum: 1, maximum: 100 }
     *     responses:
     *       "200":
     *         description: OK
     */
    async listRuns(req, res, next) {
        try {
            const { rows, count, page, per_page } = await this.repository.listRuns(req.validatedData);
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
     * /scraper/facebook/runs/{runId}:
     *   get:
     *     tags: [Scraper]
     *     summary: Chi tiết một lần chạy scraper
     *     security: []
     *     parameters:
     *       - in: path
     *         name: runId
     *         required: true
     *         schema: { type: string }
     *         description: External run ID (vd. nf3uF1nIgl9fxtnfl khi source=apify)
     *     responses:
     *       "200":
     *         description: OK
     *       "404":
     *         description: Không tìm thấy run
     */
    async getRun(req, res, next) {
        try {
            const { runId } = req.params;

            try {
                const localRun = await this.repository.findRunByExternalId(runId, 'apify');
                if (localRun) {
                    return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, {
                        source: 'database',
                        run: localRun,
                    });
                }
            } catch (dbError) {
                if (!/does not exist|no such table/i.test(dbError.message || '')) {
                    throw dbError;
                }
            }

            const { run, items } = await this.apifyService.getRunItems(runId);
            if (!run) {
                throw createError(404, 'Scraper run not found');
            }

            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, {
                source: 'apify',
                run,
                items,
            });
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /scraper/facebook/posts:
     *   get:
     *     tags: [Scraper]
     *     summary: Danh sách bài viết đã lưu (social_posts)
     *     security: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema: { type: integer, minimum: 1 }
     *       - in: query
     *         name: per_page
     *         schema: { type: integer, minimum: 1, maximum: 100 }
     *       - in: query
     *         name: subject_id
     *         schema: { type: integer }
     *       - in: query
     *         name: today
     *         schema: { type: boolean }
     *         description: Chỉ lấy bài đăng trong ngày hôm nay
     *     responses:
     *       "200":
     *         description: OK
     */
    async listPosts(req, res, next) {
        try {
            const { rows, count, page, per_page } = await this.repository.listPosts(req.validatedData);
            return ResponseService.responseJson(
                res,
                HTTP_STATUS.SUCCESS,
                ResponseService.responseJsonPaginated(rows, page, per_page, count)
            );
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = FacebookScraperController;
