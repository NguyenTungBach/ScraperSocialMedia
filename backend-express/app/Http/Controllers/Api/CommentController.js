'use strict';

const createError = require('http-errors');
const CommentRepository = require('../../../Repositories/CommentRepository');
const CommentAnalysisService = require('../../../Services/CommentAnalysisService');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');

class CommentController {
    constructor() {
        this.commentRepository = new CommentRepository();
        this.commentAnalysisService = new CommentAnalysisService();
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
     *     summary: Phân tích comment AI cho 1 bài (FB / YT / TT)
     *     description: |
     *       Gọi Gemini trên comment `pending` của `scraper_run_id`.
     *       Đã `done`/`skipped` thì bỏ qua (reason=already_done).
     *       Đồng thời tóm tắt content_brief nếu chưa có.
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
     *     responses:
     *       "200":
     *         description: Kết quả phân tích (analyzed true/false + reason)
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

            const brief = await this.commentAnalysisService.analyzeContentBriefIfNeeded(
                scraperRunId
            );
            const comments = await this.commentAnalysisService.analyzeScraperRunIfNeeded(
                scraperRunId
            );
            const data = await this.commentRepository.getCommentsByScraperRunId(scraperRunId);

            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, {
                scraper_run_id: scraperRunId,
                content_brief: brief,
                comments_analysis: comments,
                comments: data,
            });
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = CommentController;
