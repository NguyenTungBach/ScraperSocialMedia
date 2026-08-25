'use strict';

const express = require('express');
const AlertController = require('../../app/Http/Controllers/Api/AlertController');
const { validateAlertGmail } = require('../../app/Http/Requests/ScraperRequest');

const router = express.Router();
const controller = new AlertController();

/** POST /api/alerts/gmail */
router.post('/gmail', validateAlertGmail, controller.sendGmail.bind(controller));

module.exports = router;
