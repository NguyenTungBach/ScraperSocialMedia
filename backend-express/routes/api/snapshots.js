'use strict';

const express = require('express');
const SnapshotController = require('../../app/Http/Controllers/Api/SnapshotController');

const router = express.Router();
const controller = new SnapshotController();

router.post('/run', controller.run.bind(controller));
router.get('/status', controller.status.bind(controller));

router.get('/channels/compare', controller.compareChannels.bind(controller));
router.get('/channels/:id/top-posts', controller.channelTopPosts.bind(controller));
router.get('/channels/:id', controller.channelDetail.bind(controller));

router.get('/posts/compare', controller.comparePosts.bind(controller));
router.get('/posts/catalog', controller.catalogPosts.bind(controller));
router.get('/posts/:scraperRunId/top-comments', controller.postTopComments.bind(controller));
router.get('/posts/:scraperRunId', controller.postDetail.bind(controller));

module.exports = router;
