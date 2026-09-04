'use strict';

const express = require('express');
const SettingsController = require('../../app/Http/Controllers/Api/SettingsController');
const { validateUpdateSettings } = require('../../app/Http/Requests/SettingsRequest');

const router = express.Router();
const controller = new SettingsController();

router.get('/', controller.show.bind(controller));
router.put('/', validateUpdateSettings, controller.update.bind(controller));

module.exports = router;
