'use strict';

const express = require('express');
const CommentController = require('../../app/Http/Controllers/Api/CommentController');

const router = express.Router();
const controller = new CommentController();

/** GET /api/comments?scraper_run_id= */
router.get('/', controller.listByScraperRun.bind(controller));

module.exports = router;
