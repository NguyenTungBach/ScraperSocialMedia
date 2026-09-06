'use strict';

const createError = require('http-errors');
const CommentRepository = require('../../../Repositories/CommentRepository');
const ScraperAsyncService = require('../../../Services/ScraperAsyncService');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');

class CommentController {
    constructor() {
        this.commentRepository = new CommentRepository();
    }

    /**
     * @openapi
     * /comments:
     *   get:
     *     tags: [Comments]
     *     summary: Danh sách comment theo scraper_run_id
     *     description: |
     *       Trả về comment + reply đã lưu cho một bài (`scraper_runs.id`).
     *       Dùng sau khi scrape YouTube / TikTok / Facebook (hoặc khi xem chi tiết bài).
     *     security: []
     *     parameters:
     *       - in: query
     *         name: scraper_run_id
     *         required: true
     *         schema: { type: integer, minimum: 1 }
     *         description: ID bài trong bảng `scraper_runs`
     *     responses:
     *       "200":
     *         description: OK — threads / comments của bài
     *       "422":
     *         description: Thiếu scraper_run_id
     */
    async listByScraperRun(req, res, next) {
        try {
            const scraperRunId = Number(req.query.scraper_run_id);
            if (!scraperRunId) {
                throw createError(422, 'scraper_run_id is required');
            }

            const data = await this.commentRepository.getCommentsByScraperRunId(scraperRunId);
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, data);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /comments/analyze:
     *   post:
     *     tags: [Comments]
     *     summary: Enqueue phân tích comment AI (async) cho 1 bài
     *     description: |
     *       Xếp hàng Gemini trên comment `pending` của `scraper_run_id` (queue worker).
     *       Giới hạn mỗi lần: `max_comments` (comment gốc) + `max_replies` (reply/thread).
     *       Trả HTTP 202 + async_job_id — FE poll GET /scraper/async-status/:id.
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [scraper_run_id]
     *             properties:
     *               scraper_run_id: { type: integer, minimum: 1 }
     *               max_comments: { type: integer, minimum: 1, maximum: 200, default: 30 }
     *               max_replies: { type: integer, minimum: 0, maximum: 50, default: 10 }
     *     responses:
     *       "202":
     *         description: Job enqueued
     *       "409":
     *         description: Đã có job comment_analysis đang chạy cho bài này
     *       "422":
     *         description: Thiếu scraper_run_id
     */
    async analyze(req, res, next) {
        try {
            const body = req.body || {};
            const scraperRunId = Number(body.scraper_run_id);
            if (!Number.isInteger(scraperRunId) || scraperRunId <= 0) {
                throw createError(422, 'scraper_run_id is required');
            }

            const result = await ScraperAsyncService.enqueueCommentAnalysis(
                {
                    scraper_run_id: scraperRunId,
                    max_comments: body.max_comments,
                    max_replies: body.max_replies,
                },
                req.user || null
            );

            return ResponseService.responseJson(res, HTTP_STATUS.ACCEPTED, result);
        } catch (error) {
            if (error.statusCode === 409 && error.data) {
                return ResponseService.responseJsonError(
                    res,
                    HTTP_STATUS.CONFLICT,
                    error.message,
                    null,
                    null,
                    error.data
                );
            }
            if (error.statusCode === 422) {
                return ResponseService.responseJsonError(
                    res,
                    HTTP_STATUS.UNPROCESSABLE_ENTITY,
                    error.message
                );
            }
            if (error.statusCode === 404) {
                return ResponseService.responseJsonError(
                    res,
                    HTTP_STATUS.NOT_FOUND,
                    error.message
                );
            }
            return next(error);
        }
    }
}

module.exports = CommentController;
