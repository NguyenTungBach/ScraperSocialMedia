'use strict';

const express = require('express');
const FacebookScraperController = require('../../app/Http/Controllers/Api/FacebookScraperController');
const {
    validateRunFacebookScraper,
    validateListQuery,
} = require('../../app/Http/Requests/FacebookScraperRequest');

const router = express.Router();
const controller = new FacebookScraperController();

/** POST /api/scraper/facebook/run */
router.post('/facebook/run', validateRunFacebookScraper, controller.run.bind(controller));

/** GET /api/scraper/facebook/runs */
router.get('/facebook/runs', validateListQuery, controller.listRuns.bind(controller));

/** GET /api/scraper/facebook/runs/:runId */
router.get('/facebook/runs/:runId', controller.getRun.bind(controller));

/** GET /api/scraper/facebook/posts */
router.get('/facebook/posts', validateListQuery, controller.listPosts.bind(controller));

module.exports = router;
