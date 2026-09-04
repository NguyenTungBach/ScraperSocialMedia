'use strict';

const UserRepository = require('../../../Repositories/UserRepository');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');

class UserController {
    constructor() {
        this.repository = new UserRepository();
    }

    async list(req, res, next) {
        try {
            const { rows, count, page, per_page } = await this.repository.listUsers(
                req.validatedData || {}
            );
            return ResponseService.responseJson(
                res,
                HTTP_STATUS.SUCCESS,
                ResponseService.responseJsonPaginated(rows, page, per_page, count)
            );
        } catch (error) {
            return next(error);
        }
    }

    async store(req, res, next) {
        try {
            const row = await this.repository.createUser(req.validatedData);
            return ResponseService.responseJsonCreated(res, row, 'User created');
        } catch (error) {
            return next(error);
        }
    }

    async update(req, res, next) {
        try {
            const id = Number(req.params.id);
            const row = await this.repository.updateUser(id, req.validatedData, {
                actorId: req.user?.id,
            });
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, row, 'User updated');
        } catch (error) {
            return next(error);
        }
    }

    async destroy(req, res, next) {
        try {
            const id = Number(req.params.id);
            const result = await this.repository.deleteUser(id, {
                actorId: req.user?.id,
            });
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result, 'User deleted');
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = UserController;
