'use strict';

const express = require('express');
const ScraperController = require('../../app/Http/Controllers/Api/ScraperController');
const {
    validateRunScraper,
    validateRunFromHistory,
    validateApifyRunsQuery,
    validateListQuery,
} = require('../../app/Http/Requests/ScraperRequest');

const router = express.Router();
const controller = new ScraperController();

/** POST /api/scraper/run — chạy Actor Apify mới */
router.post('/run', validateRunScraper, controller.run.bind(controller));

/** POST /api/scraper/run-from-history — ingest từ Apify run đã có (không tốn scrape mới) */
router.post(
    '/run-from-history',
    validateRunFromHistory,
    controller.runFromHistory.bind(controller)
);

/** GET /api/scraper/apify/runs — lịch sử Actor runs trên Apify Console */
router.get(
    '/apify/runs',
    validateApifyRunsQuery,
    controller.listApifyRuns.bind(controller)
);

/** GET /api/scraper/runs — bài đã lưu trong DB local */
router.get('/runs', validateListQuery, controller.listRuns.bind(controller));

/** GET /api/scraper/runs/:id — chi tiết 1 bài trong DB */
router.get('/runs/:id', controller.getRun.bind(controller));

module.exports = router;
