'use strict';

const express = require('express');
const ReportController = require('../../app/Http/Controllers/Api/ReportController');

const router = express.Router();
const controller = new ReportController();

/** POST /api/reports/compare-email */
router.post('/compare-email', controller.sendCompareEmail.bind(controller));

module.exports = router;
