'use strict';

const AppSettingsService = require('../../../Services/AppSettingsService');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');

class SettingsController {
    constructor() {
        this.service = new AppSettingsService();
    }

    async show(req, res, next) {
        try {
            const data = await this.service.getForAdmin();
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, data);
        } catch (error) {
            return next(error);
        }
    }

    async update(req, res, next) {
        try {
            const data = await this.service.updateFromAdmin(req.validatedData || {});
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, data, 'Settings updated');
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = SettingsController;
