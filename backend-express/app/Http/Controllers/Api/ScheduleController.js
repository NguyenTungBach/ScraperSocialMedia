'use strict';

const GeneralScheduleService = require('../../../Services/GeneralScheduleService');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');

class ScheduleController {
    constructor() {
        this.service = new GeneralScheduleService();
    }

    async list(req, res, next) {
        try {
            const { rows, count, page, per_page, allowed_commands } = await this.service.list(
                req.validatedData || {}
            );
            const data = ResponseService.responseJsonPaginated(rows, page, per_page, count);
            data.allowed_commands = allowed_commands;
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, data);
        } catch (error) {
            return next(error);
        }
    }

    async store(req, res, next) {
        try {
            const row = await this.service.create(req.validatedData);
            return ResponseService.responseJsonCreated(res, row, 'Schedule created');
        } catch (error) {
            return next(error);
        }
    }

    async update(req, res, next) {
        try {
            const id = Number(req.params.id);
            const row = await this.service.update(id, req.validatedData || {});
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, row, 'Schedule updated');
        } catch (error) {
            return next(error);
        }
    }

    async destroy(req, res, next) {
        try {
            const id = Number(req.params.id);
            const result = await this.service.destroy(id);
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result, 'Schedule deleted');
        } catch (error) {
            return next(error);
        }
    }

    async runNow(req, res, next) {
        try {
            const id = Number(req.params.id);
            const row = await this.service.runNow(id);
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, row, 'Schedule started');
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = ScheduleController;
