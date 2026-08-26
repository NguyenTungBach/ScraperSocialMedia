'use strict';

const express = require('express');
const ChannelController = require('../../app/Http/Controllers/Api/ChannelController');
const {
    validateListQuery,
    validateChannelCreate,
    validateChannelUpdate,
} = require('../../app/Http/Requests/ScraperRequest');

const router = express.Router();
const controller = new ChannelController();

router.get('/', validateListQuery, controller.list.bind(controller));
router.post('/', validateChannelCreate, controller.store.bind(controller));
router.put('/:id', validateChannelUpdate, controller.update.bind(controller));
router.delete('/:id', controller.destroy.bind(controller));

module.exports = router;
