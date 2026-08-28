'use strict';

const createError = require('http-errors');
const CommentRepository = require('../../../Repositories/CommentRepository');
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
     *       Dùng sau khi scrape YouTube / TikTok (hoặc khi xem chi tiết bài).
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
}

module.exports = CommentController;
