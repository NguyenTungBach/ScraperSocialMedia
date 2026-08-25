'use strict';

const express = require('express');
const SubjectController = require('../../app/Http/Controllers/Api/SubjectController');
const {
    validateListQuery,
    validateSubjectDetailQuery,
    validateSubjectCreate,
    validateSubjectUpdate,
} = require('../../app/Http/Requests/ScraperRequest');

const router = express.Router();
const controller = new SubjectController();

/** POST /api/subjects/discover */
router.post('/discover', controller.discover.bind(controller));

/** GET /api/subjects — list + search + paginate */
router.get('/', validateListQuery, controller.list.bind(controller));

/** POST /api/subjects */
router.post('/', validateSubjectCreate, controller.store.bind(controller));

/** GET /api/subjects/:id — chi tiết + bài liên quan */
router.get('/:id', validateSubjectDetailQuery, controller.show.bind(controller));

/** PUT /api/subjects/:id */
router.put('/:id', validateSubjectUpdate, controller.update.bind(controller));

/** DELETE /api/subjects/:id — hard delete (blocked if subjects_scraper_runs exist) */
router.delete('/:id', controller.destroy.bind(controller));

module.exports = router;
