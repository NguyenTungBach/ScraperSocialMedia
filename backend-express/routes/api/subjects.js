'use strict';

const express = require('express');
const SubjectController = require('../../app/Http/Controllers/Api/SubjectController');
const {
    validateSubjectListQuery,
    validateSubjectDetailQuery,
    validateSubjectCreate,
    validateSubjectUpdate,
    validateSubjectChannel,
} = require('../../app/Http/Requests/ScraperRequest');

const router = express.Router();
const controller = new SubjectController();

/** POST /api/subjects/discover */
router.post('/discover', controller.discover.bind(controller));

/** GET /api/subjects — list + search + paginate */
router.get('/', validateSubjectListQuery, controller.list.bind(controller));

/** POST /api/subjects */
router.post('/', validateSubjectCreate, controller.store.bind(controller));

/** POST /api/subjects/:id/channels */
router.post(
    '/:id/channels',
    validateSubjectChannel,
    controller.attachChannel.bind(controller)
);

/** DELETE /api/subjects/:id/channels/:channelId */
router.delete(
    '/:id/channels/:channelId',
    controller.detachChannel.bind(controller)
);

/** GET /api/subjects/:id — chi tiết + bài liên quan */
router.get('/:id', validateSubjectDetailQuery, controller.show.bind(controller));

/** PUT /api/subjects/:id */
router.put('/:id', validateSubjectUpdate, controller.update.bind(controller));

/** DELETE /api/subjects/:id — hard delete (blocked if subjects_scraper_runs exist) */
router.delete('/:id', controller.destroy.bind(controller));

module.exports = router;
