'use strict';

const express = require('express');
const UserController = require('../../app/Http/Controllers/Api/UserController');
const {
    validateIndexUser,
    validateCreateUser,
    validateUpdateUser,
} = require('../../app/Http/Requests/UserRequest');

const router = express.Router();
const controller = new UserController();

router.get('/', validateIndexUser, controller.list.bind(controller));
router.post('/', validateCreateUser, controller.store.bind(controller));
router.put('/:id', validateUpdateUser, controller.update.bind(controller));
router.delete('/:id', controller.destroy.bind(controller));

module.exports = router;
