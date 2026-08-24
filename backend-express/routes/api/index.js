'use strict';

/**
 * REST API — Auth + Facebook Scraper (Apify).
 */

const express = require('express');
const router = express.Router();

const authenticate = require('../../app/Http/Middleware/Authenticate');
const authRoutes = require('./auth');
const scraperRoutes = require('./scraper');

const AuthController = require('../../app/Http/Controllers/Api/AuthController');

const authController = new AuthController();

// Facebook scraper (Apify)
router.use('/scraper', scraperRoutes);

// Auth
router.use('/auth', authRoutes);
router.use(authenticate());

router.get('/profile', authController.getProfile.bind(authController));

module.exports = router;
