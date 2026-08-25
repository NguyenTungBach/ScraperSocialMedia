'use strict';

const createError = require('http-errors');
const ScraperRepository = require('../../../Repositories/ScraperRepository');
const MailService = require('../../../Services/MailService');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');
const geminiConfig = require('../../../../config/gemini');
const mailConfig = require('../../../../config/mail');

class AlertController {
    constructor() {
        this.repository = new ScraperRepository();
    }

    /**
     * @openapi
     * /alerts/gmail:
     *   post:
     *     tags: [Alerts]
     *     summary: Gửi Gmail khi hot_score và trend_score vượt ngưỡng
     *     description: |
     *       Lọc `social_posts` có `hot_score >= ALERT_HOT_THRESHOLD` **và**
     *       `trend_score >= ALERT_TREND_THRESHOLD`, rồi gửi email tới `MAIL_MAIN` (hoặc `to` trong body).
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
     *     responses:
     *       "200":
     *         description: Đã gửi hoặc không có bản ghi vượt ngưỡng
     *       "422":
     *         description: Thiếu cấu hình mail / người nhận
     */
    async sendGmail(req, res, next) {
        try {
            const { subject_id = null, to = null } = req.validatedData || {};
            const recipient = (to || mailConfig.mailMain || '').trim();
            if (!recipient) {
                throw createError(422, 'Missing recipient. Set MAIL_MAIN or pass body.to');
            }
            if (!mailConfig.isTransportReady()) {
                throw createError(422, 'Mail transport is not configured');
            }

            const candidates = await this.repository.listAlertCandidates({ subject_id });
            if (candidates.length === 0) {
                return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, {
                    sent: false,
                    reason: 'no_candidates_over_threshold',
                    thresholds: {
                        hot: geminiConfig.alertHotThreshold,
                        trend: geminiConfig.alertTrendThreshold,
                    },
                    count: 0,
                });
            }

            const rowsHtml = candidates
                .map((row) => {
                    const name = row.subject?.name || `#${row.subject_id}`;
                    return `<tr>
                      <td>${name}</td>
                      <td>${row.posts_count}</td>
                      <td>${row.likes}</td>
                      <td>${row.comments}</td>
                      <td>${row.shares}</td>
                      <td>${row.angry_count}</td>
                      <td>${row.trend_score}</td>
                      <td>${row.hot_score}</td>
                    </tr>`;
                })
                .join('');

            const html = `
              <h2>ScraperSocialMedia — Alert vượt ngưỡng</h2>
              <p>Ngưỡng: hot_score &gt;= <b>${geminiConfig.alertHotThreshold}</b>
                 và trend_score &gt;= <b>${geminiConfig.alertTrendThreshold}</b></p>
              <table border="1" cellpadding="6" cellspacing="0">
                <thead>
                  <tr>
                    <th>Subject</th><th>Posts</th><th>Likes</th><th>Comments</th>
                    <th>Shares</th><th>Angry</th><th>Trend</th><th>Hot</th>
                  </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
              </table>
            `;

            const ok = await MailService.sendHtml({
                to: recipient,
                subject: `[Alert] ${candidates.length} subject(s) vượt ngưỡng hot/trend`,
                html,
            });

            if (!ok) {
                throw createError(500, 'Failed to send Gmail');
            }

            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, {
                sent: true,
                to: recipient,
                count: candidates.length,
                thresholds: {
                    hot: geminiConfig.alertHotThreshold,
                    trend: geminiConfig.alertTrendThreshold,
                },
                subjects: candidates.map((row) => ({
                    subject_id: row.subject_id,
                    name: row.subject?.name,
                    hot_score: row.hot_score,
                    trend_score: row.trend_score,
                    posts_count: row.posts_count,
                })),
            });
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = AlertController;
