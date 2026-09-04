'use strict';

const express = require('express');
const ScraperController = require('../../app/Http/Controllers/Api/ScraperController');
const {
    validateRunFacebook,
    validateRunYoutube,
    validateRunTikTok,
    validateRefreshYoutubeTail,
    validateAsyncStatusLatest,
} = require('../../app/Http/Requests/ScraperRequest');

const router = express.Router();
const controller = new ScraperController();

/** GET /api/scraper/async-health — queue / stale diagnostics */
router.get('/async-health', controller.asyncHealth.bind(controller));

/** GET /api/scraper/async-active — pending|running scrape jobs */
router.get('/async-active', controller.listActiveAsync.bind(controller));

/** GET /api/scraper/async-status?job_type=&scope_key= — latest job for scope */
router.get(
    '/async-status',
    validateAsyncStatusLatest,
    controller.showLatestAsyncStatus.bind(controller)
);

/** GET /api/scraper/async-status/:id — poll job status */
router.get('/async-status/:id', controller.showAsyncStatus.bind(controller));

/** POST /api/scraper/facebook/run — enqueue Facebook scrape (202) */
router.post(
    '/facebook/run',
    validateRunFacebook,
    controller.runFacebook.bind(controller)
);

/** POST /api/scraper/youtube/run — enqueue YouTube scrape (202) */
router.post(
    '/youtube/run',
    validateRunYoutube,
    controller.runYoutube.bind(controller)
);

/** POST /api/scraper/tiktok/run — enqueue TikTok scrape (202) */
router.post(
    '/tiktok/run',
    validateRunTikTok,
    controller.runTikTok.bind(controller)
);

/** POST /api/scraper/youtube/refresh-tail — refresh stats video tail (rank > headSize), không comment */
router.post(
    '/youtube/refresh-tail',
    validateRefreshYoutubeTail,
    controller.refreshYoutubeTail.bind(controller)
);

module.exports = router;
