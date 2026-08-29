'use strict';

const express = require('express');
const CommentController = require('../../app/Http/Controllers/Api/CommentController');

const router = express.Router();
const controller = new CommentController();

/** GET /api/comments?scraper_run_id= */
router.get('/', controller.listByScraperRun.bind(controller));

/** POST /api/comments/analyze — phân tích AI 1 bài (mọi MXH) */
router.post('/analyze', controller.analyze.bind(controller));

module.exports = router;
