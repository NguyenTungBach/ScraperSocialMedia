'use strict';

const AppSettingsService = require('../../../Services/AppSettingsService');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');

class SettingsController {
    constructor() {
        this.service = new AppSettingsService();
    }

    /**
     * @openapi
     * /settings:
     *   get:
     *     tags: [Settings]
     *     summary: Lấy key_scraps + general_settings (admin)
     *     description: |
     *       Runtime config từ DB (`key_scraps`, `general_settings`).
     *       Secret fields trả về dạng mask (không lộ giá trị đầy đủ).
     *     security: []
     *     responses:
     *       "200":
     *         description: OK — `{ keys, settings }`
     *       "403":
     *         description: Không phải admin
     */
    async show(req, res, next) {
        try {
            const data = await this.service.getForAdmin();
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, data);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @openapi
     * /settings:
     *   put:
     *     tags: [Settings]
     *     summary: Cập nhật API keys / mail / ngưỡng alert (admin)
     *     description: |
     *       Body gồm `keys` và/hoặc `settings` (object map name → value).
     *       Chỉ chấp nhận whitelist trong `AppSettingsKeys`.
     *       Sau update, SettingsCache refresh — không cần restart API.
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               keys:
     *                 type: object
     *                 additionalProperties: { type: string }
     *                 description: |
     *                   APIFY_API_TOKEN, YOUTUBE_API_KEY, GEMINI_API_KEY, GEMINI_MODEL,
     *                   GEMINI_FALLBACK_MODELS, GEMINI_MAX_RETRIES, GEMINI_RETRY_DELAY_MS
     *                 example:
     *                   GEMINI_MODEL: gemini-3.6-flash
     *               settings:
     *                 type: object
     *                 additionalProperties: { type: string }
     *                 description: |
     *                   ALERT_HOT_THRESHOLD, ALERT_TREND_THRESHOLD, MAIL_* …
     *                 example:
     *                   ALERT_HOT_THRESHOLD: "800"
     *                   MAIL_MAIN: you@example.com
     *     responses:
     *       "200":
     *         description: Updated
     *       "422":
     *         description: Validation / unknown key
     */
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
