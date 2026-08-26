'use strict';

const express = require('express');
const ScraperController = require('../../app/Http/Controllers/Api/ScraperController');
const {
    validateRunScraper,
    validateRunYoutube,
    validateRunFromHistory,
    validateApifyRunsQuery,
    validateListQuery,
} = require('../../app/Http/Requests/ScraperRequest');

const router = express.Router();
const controller = new ScraperController();

/** POST /api/scraper/apify/facebook/run */
router.post(
    '/apify/facebook/run',
    validateRunScraper,
    controller.run.bind(controller)
);

/** POST /api/scraper/apify/facebook/run-from-history */
router.post(
    '/apify/facebook/run-from-history',
    validateRunFromHistory,
    controller.runFromHistory.bind(controller)
);

/** GET /api/scraper/apify/runs — lịch sử Actor runs trên Apify Console */
router.get(
    '/apify/runs',
    validateApifyRunsQuery,
    controller.listApifyRuns.bind(controller)
);

/** GET /api/scraper/apify/facebook/runs — bài đã lưu trong DB local */
router.get(
    '/apify/facebook/runs',
    validateListQuery,
    controller.listRuns.bind(controller)
);

/** GET /api/scraper/apify/facebook/runs/:id */
router.get('/apify/facebook/runs/:id', controller.getRun.bind(controller));

/** POST /api/scraper/youtube/run — cào video kênh YouTube qua Data API v3 */
router.post(
    '/youtube/run',
    validateRunYoutube,
    controller.runYoutube.bind(controller)
);

module.exports = router;
