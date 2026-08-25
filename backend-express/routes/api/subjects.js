'use strict';

const express = require('express');
const SubjectController = require('../../app/Http/Controllers/Api/SubjectController');
const {
    validateListQuery,
    validateSubjectDetailQuery,
} = require('../../app/Http/Requests/ScraperRequest');

const router = express.Router();
const controller = new SubjectController();

/** POST /api/subjects/discover */
router.post('/discover', controller.discover.bind(controller));

/** GET /api/subjects */
router.get('/', validateListQuery, controller.list.bind(controller));

/** GET /api/subjects/:id — chi tiết + bài liên quan */
router.get('/:id', validateSubjectDetailQuery, controller.show.bind(controller));

module.exports = router;
