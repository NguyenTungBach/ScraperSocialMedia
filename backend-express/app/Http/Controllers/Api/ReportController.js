'use strict';

const CompareReportService = require('../../../Services/CompareReportService');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');

class ReportController {
    constructor() {
        this.service = new CompareReportService();
    }

    /**
     * @openapi
     * /reports/compare-email:
     *   post:
     *     tags: [Reports]
     *     summary: Gửi mail báo cáo so sánh kênh hoặc bài
     *     description: |
     *       Action sau luồng so sánh (không đụng alert hot/trend).
     *       Body: mode=channels|posts + ids + date_from/date_to.
     *       Người nhận mặc định MAIL_MAIN.
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [mode]
     *             properties:
     *               mode: { type: string, enum: [channels, posts] }
     *               channel_ids:
     *                 oneOf:
     *                   - type: array
     *                     items: { type: integer }
     *                   - type: string
     *               scraper_run_ids:
     *                 oneOf:
     *                   - type: array
     *                     items: { type: integer }
     *                   - type: string
     *               date_from: { type: string, example: "2026-08-25" }
     *               date_to: { type: string, example: "2026-08-29" }
     *               metric: { type: string }
     *               to: { type: string, format: email }
     *               bcc:
     *                 oneOf:
     *                   - type: array
     *                     items: { type: string }
     *                   - type: string
     *     responses:
     *       "200":
     *         description: Đã gửi mail
     *       "422":
     *         description: Thiếu tham số / cấu hình mail
     */
    async sendCompareEmail(req, res, next) {
        try {
            const body = req.body || {};
            const result = await this.service.sendCompareEmail(body);
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result);
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = ReportController;
