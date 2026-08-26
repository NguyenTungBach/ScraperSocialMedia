'use strict';

const express = require('express');
const SocialPostController = require('../../app/Http/Controllers/Api/SocialPostController');
const {
    validateListQuery,
    validateSocialPostsDashboardQuery,
} = require('../../app/Http/Requests/ScraperRequest');

const router = express.Router();
const controller = new SocialPostController();

/** GET /api/social-posts/stats */
router.get('/stats', validateListQuery, controller.stats.bind(controller));

/** GET /api/social-posts/dashboard */
router.get('/dashboard', validateSocialPostsDashboardQuery, controller.dashboard.bind(controller));

/** GET /api/social-posts */
router.get('/', validateListQuery, controller.list.bind(controller));

module.exports = router;
