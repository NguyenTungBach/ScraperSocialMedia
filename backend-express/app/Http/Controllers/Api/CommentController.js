'use strict';

const createError = require('http-errors');
const CommentRepository = require('../../../Repositories/CommentRepository');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');

class CommentController {
    constructor() {
        this.commentRepository = new CommentRepository();
    }

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
