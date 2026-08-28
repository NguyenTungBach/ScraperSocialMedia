'use strict';

const express = require('express');
const ScraperController = require('../../app/Http/Controllers/Api/ScraperController');
const {
    validateRunFacebook,
    validateRunYoutube,
    validateRunTikTok,
    validateRefreshYoutubeTail,
} = require('../../app/Http/Requests/ScraperRequest');

const router = express.Router();
const controller = new ScraperController();

/** POST /api/scraper/facebook/run — cào bài + comment Facebook qua Apify */
router.post(
    '/facebook/run',
    validateRunFacebook,
    controller.runFacebook.bind(controller)
);

/** POST /api/scraper/youtube/run — cào video kênh YouTube qua Data API v3 */
router.post(
    '/youtube/run',
    validateRunYoutube,
    controller.runYoutube.bind(controller)
);

/** POST /api/scraper/tiktok/run — cào video + comment TikTok qua Apify */
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
