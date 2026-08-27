'use strict';

/**
 * REST API — Auth + Subjects (Gemini) + Scraper (Apify) + SocialPosts + Alerts.
 */

const express = require('express');
const router = express.Router();

const authenticate = require('../../app/Http/Middleware/Authenticate');
const authRoutes = require('./auth');
const scraperRoutes = require('./scraper');
const subjectsRoutes = require('./subjects');
const socialPostsRoutes = require('./socialPosts');
const alertsRoutes = require('./alerts');
const commentsRoutes = require('./comments');
const channelsRoutes = require('./channels');

const AuthController = require('../../app/Http/Controllers/Api/AuthController');

const authController = new AuthController();

router.use('/subjects', subjectsRoutes);
router.use('/scraper', scraperRoutes);
router.use('/social-posts', socialPostsRoutes);
router.use('/alerts', alertsRoutes);
router.use('/comments', commentsRoutes);
router.use('/channels', channelsRoutes);

router.use('/auth', authRoutes);
router.use(authenticate());

router.get('/profile', authController.getProfile.bind(authController));

module.exports = router;
