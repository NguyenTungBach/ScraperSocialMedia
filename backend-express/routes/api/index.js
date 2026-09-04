'use strict';

/**
 * REST API — Auth + Subjects (Gemini) + Scraper (Apify) + SocialPosts + Alerts.
 */

const express = require('express');
const router = express.Router();

const authenticate = require('../../app/Http/Middleware/Authenticate');
const requireAdminForWrites = require('../../app/Http/Middleware/RequireAdminForWrites');
const authorizeUserTypes = require('../../app/Http/Middleware/AuthorizeUserTypes');
const UserType = require('../../app/Constants/UserType');
const authRoutes = require('./auth');
const scraperRoutes = require('./scraper');
const subjectsRoutes = require('./subjects');
const socialPostsRoutes = require('./socialPosts');
const alertsRoutes = require('./alerts');
const commentsRoutes = require('./comments');
const channelsRoutes = require('./channels');
const snapshotsRoutes = require('./snapshots');
const reportsRoutes = require('./reports');
const usersRoutes = require('./users');
const settingsRoutes = require('./settings');
const schedulesRoutes = require('./schedules');

const AuthController = require('../../app/Http/Controllers/Api/AuthController');

const authController = new AuthController();

router.use('/auth', authRoutes);

router.use(authenticate());
router.use(requireAdminForWrites());

router.use('/users', authorizeUserTypes(UserType.ADMIN), usersRoutes);
router.use('/settings', authorizeUserTypes(UserType.ADMIN), settingsRoutes);
router.use('/schedules', authorizeUserTypes(UserType.ADMIN), schedulesRoutes);
router.use('/subjects', subjectsRoutes);
router.use('/scraper', scraperRoutes);
router.use('/social-posts', socialPostsRoutes);
router.use('/alerts', alertsRoutes);
router.use('/comments', commentsRoutes);
router.use('/channels', channelsRoutes);
router.use('/snapshots', snapshotsRoutes);
router.use('/reports', reportsRoutes);

router.get('/profile', authController.getProfile.bind(authController));

module.exports = router;
