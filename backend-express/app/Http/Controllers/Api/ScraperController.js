'use strict';

const createError = require('http-errors');
const ApifyService = require('../../../Services/ApifyService');
const ScraperRepository = require('../../../Repositories/ScraperRepository');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');

class ScraperController {
    constructor() {
        this.apifyService = new ApifyService();
        this.repository = new ScraperRepository();
    }

    /**
     * @openapi
     * /scraper/run:
     *   post:
     *     tags: [Scraper]
     *     summary: Chạy Apify Facebook scraper → lưu scraper_runs → match subjects → cập nhật social_posts
     *     description: |
     *       1. Gọi Apify Actor lấy bài.
     *       2. Mỗi bài upsert vào `scraper_runs`.
     *       3. Match `title`/`text` với `subjects.name` hoặc `normalized_name` (kiểu %name%).
     *       4. Tạo `subjects_scraper_runs` và recompute `social_posts` (SUM engagement + trend/hot).
     *     security: []
     *     requestBody:
     *       required: false
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
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
     *         description: Scrape + match thành công
     *       "500":
     *         description: Thiếu APIFY_API_TOKEN hoặc lỗi Apify
     */
    async run(req, res, next) {
        try {
            const overrides = { ...(req.validatedData || {}) };
            const { run, items, input } = await this.apifyService.runFacebookScraper(overrides);
            const ingest = await this.repository.ingestApifyItems({ run, items });

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
     *     summary: Lịch sử Actor runs trên Apify (console.apify.com/actors/runs)
     *     description: Không chạy scrape mới — chỉ list run đã có trên Apify để chọn ingest lại.
     *     security: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema: { type: integer, minimum: 1 }
     *       - in: query
     *         name: per_page
     *         schema: { type: integer, minimum: 1, maximum: 100 }
     *       - in: query
     *         name: status
     *         schema: { type: string, example: SUCCEEDED }
     *       - in: query
     *         name: desc
     *         schema: { type: boolean, default: true }
     *     responses:
     *       "200":
     *         description: OK
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
     * /scraper/run-from-history:
     *   post:
     *     tags: [Scraper]
     *     summary: Ingest lại data từ một Apify run đã có (không gọi Actor mới)
     *     description: |
     *       Lấy dataset của `runId` trên Apify → upsert `scraper_runs` theo `(platform, platform_post_id)`
     *       (bài Facebook trùng không tạo lại) → match subjects → cập nhật `social_posts`.
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [runId]
     *             properties:
     *               runId:
     *                 type: string
     *                 example: abc123xyz
     *     responses:
     *       "200":
     *         description: Ingest thành công
     *       "404":
     *         description: Không tìm thấy Apify run
     */
    async runFromHistory(req, res, next) {
        try {
            const { runId } = req.validatedData;
            const { run, items } = await this.apifyService.getRunItems(runId);
            const ingest = await this.repository.ingestApifyItems({ run, items });

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
     * /scraper/runs:
     *   get:
     *     tags: [Scraper]
     *     summary: Danh sách scraper_runs (bài đã scrape trong DB local)
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
     * /scraper/runs/{id}:
     *   get:
     *     tags: [Scraper]
     *     summary: Chi tiết một scraper_run (bài trong DB local)
     *     security: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
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
}

module.exports = ScraperController;
