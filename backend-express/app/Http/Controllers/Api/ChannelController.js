'use strict';

const createError = require('http-errors');
const ChannelRepository = require('../../../Repositories/ChannelRepository');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');

class ChannelController {
    constructor() {
        this.repository = new ChannelRepository();
    }

    /**
     * @openapi
     * /channels:
     *   get:
     *     tags: [Channels]
     *     summary: Danh sách kênh (catalog)
     *     security: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema: { type: integer, minimum: 1 }
     *       - in: query
     *         name: per_page
     *         schema: { type: integer, minimum: 1, maximum: 100 }
     *       - in: query
     *         name: q
     *         schema: { type: string }
     *         description: Tìm theo name hoặc url
     *       - in: query
     *         name: type_channel
     *         schema:
     *           type: string
     *           enum: [facebook, youtube, tiktok]
     *           example: youtube
     *         description: Lọc theo nền tảng
     *     responses:
     *       "200":
     *         description: OK
     */
    async list(req, res, next) {
        try {
            const { rows, count, page, per_page } = await this.repository.listChannels(
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

    /**
     * @openapi
     * /channels:
     *   post:
     *     tags: [Channels]
     *     summary: Tạo kênh mới
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [name, url]
     *             properties:
     *               name: { type: string, example: Theanh28 }
     *               url: { type: string, format: uri, example: "https://www.youtube.com/@taca" }
     *               type_channel:
     *                 type: string
     *                 enum: [facebook, youtube, tiktok]
     *                 default: facebook
     *                 example: youtube
     *     responses:
     *       "201":
     *         description: Created
     *       "422":
     *         description: Validation error
     */
    async store(req, res, next) {
        try {
            const row = await this.repository.createChannel(req.validatedData);
            return ResponseService.responseJsonCreated(res, row, 'Channel created');
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /channels/{id}:
     *   put:
     *     tags: [Channels]
     *     summary: Cập nhật kênh
     *     security: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name: { type: string }
     *               url: { type: string, format: uri }
     *               type_channel: { type: string }
     *     responses:
     *       "200":
     *         description: OK
     *       "404":
     *         description: Không tìm thấy
     *       "422":
     *         description: Không thể sửa URL/nền tảng sau khi kênh đã lưu
     */
    async update(req, res, next) {
        try {
            const row = await this.repository.updateChannel(req.params.id, req.validatedData);
            if (!row) throw createError(404, 'Channel not found');
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, row, 'Channel updated');
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /channels/{id}:
     *   delete:
     *     tags: [Channels]
     *     summary: Xóa kênh
     *     security: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       "200":
     *         description: Deleted
     *       "404":
     *         description: Không tìm thấy
     *       "422":
     *         description: Không thể xóa khi kênh đã có bài trong scraper_runs
     */
    async destroy(req, res, next) {
        try {
            const result = await this.repository.deleteChannel(req.params.id);
            if (!result) throw createError(404, 'Channel not found');
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result, 'Channel deleted');
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = ChannelController;
