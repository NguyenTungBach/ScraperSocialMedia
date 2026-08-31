'use strict';

const AlertService = require('../../../Services/AlertService');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');

class AlertController {
    constructor() {
        this.alertService = new AlertService();
    }

    /**
     * @openapi
     * /alerts/gmail:
     *   post:
     *     tags: [Alerts]
     *     summary: Gửi Gmail khi bài viết vượt ngưỡng hot/trend
     *     description: |
     *       Lọc `scraper_runs` (Facebook, YouTube, TikTok) trong tháng hiện tại có
     *       `hot_score >= ALERT_HOT_THRESHOLD` **hoặc** `trend_score >= ALERT_TREND_THRESHOLD`,
     *       phân tích comment AI (top 3 bài hot/subject), rồi gửi email tới `MAIL_MAIN` (hoặc `to` trong body).
     *       BCC: `MAIL_ALERT_BCC` trong `.env` và/hoặc `bcc` trong body (mảng email hoặc chuỗi phân cách bằng dấu phẩy).
     *     security: []
     *     requestBody:
     *       required: false
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               subject_id:
     *                 type: integer
     *                 description: Chỉ kiểm tra 1 subject (optional)
     *               to:
     *                 type: string
     *                 format: email
     *                 description: Override người nhận (mặc định MAIL_MAIN)
     *               bcc:
     *                 oneOf:
     *                   - type: array
     *                     items:
     *                       type: string
     *                       format: email
     *                   - type: string
     *                 description: BCC thêm (gộp với MAIL_ALERT_BCC trong .env)
     *     responses:
     *       "200":
     *         description: Đã gửi hoặc không có bản ghi vượt ngưỡng
     *       "422":
     *         description: Thiếu cấu hình mail / người nhận
     */
    async sendGmail(req, res, next) {
        try {
            const { subject_id = null, to = null, bcc: bodyBcc = null } = req.validatedData || {};
            const result = await this.alertService.runGmailAlert({
                subject_id,
                to,
                bcc: bodyBcc,
            });
            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, result);
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = AlertController;
