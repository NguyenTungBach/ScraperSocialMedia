'use strict';

const express = require('express');
const ScheduleController = require('../../app/Http/Controllers/Api/ScheduleController');
const {
    validateIndexSchedule,
    validateCreateSchedule,
    validateUpdateSchedule,
} = require('../../app/Http/Requests/ScheduleRequest');

const router = express.Router();
const controller = new ScheduleController();

router.get('/', validateIndexSchedule, controller.list.bind(controller));
router.post('/', validateCreateSchedule, controller.store.bind(controller));
router.put('/:id', validateUpdateSchedule, controller.update.bind(controller));
router.delete('/:id', controller.destroy.bind(controller));
router.post('/:id/run', controller.runNow.bind(controller));

module.exports = router;
