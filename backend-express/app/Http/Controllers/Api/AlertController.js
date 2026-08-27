'use strict';

const createError = require('http-errors');
const ScraperRepository = require('../../../Repositories/ScraperRepository');
const CommentAnalysisService = require('../../../Services/CommentAnalysisService');
const MailService = require('../../../Services/MailService');
const ResponseService = require('../../../Helpers/ResponseService');
const HTTP_STATUS = require('../../../Constants/HttpStatus');
const { roundScore } = require('../../../Helpers/PostScoreHelper');
const { buildAlertEmail } = require('../../../Helpers/EmailAlertBuilder');
const geminiConfig = require('../../../../config/gemini');
const mailConfig = require('../../../../config/mail');

class AlertController {
    constructor() {
        this.repository = new ScraperRepository();
        this.commentAnalysisService = new CommentAnalysisService();
    }

    /**
     * @openapi
     * /alerts/gmail:
     *   post:
     *     tags: [Alerts]
     *     summary: Gửi Gmail khi hot_score và trend_score vượt ngưỡng
     *     description: |
     *       Lọc `social_posts` có `hot_score >= ALERT_HOT_THRESHOLD` **và**
     *       `trend_score >= ALERT_TREND_THRESHOLD`, phân tích comment AI (top video hot/subject),
     *       rồi gửi email tới `MAIL_MAIN` (hoặc `to` trong body).
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
            const recipient = (to || mailConfig.mailMain || '').trim();
            if (!recipient) {
                throw createError(422, 'Missing recipient. Set MAIL_MAIN or pass body.to');
            }
            if (!mailConfig.isTransportReady()) {
                throw createError(422, 'Mail transport is not configured');
            }

            const bccRaw = [...mailConfig.alertBcc, ...(Array.isArray(bodyBcc) ? bodyBcc : [])];
            const bccSeen = new Set();
            const bcc = [];
            const recipientLower = recipient.toLowerCase();
            for (const email of bccRaw) {
                const trimmed = String(email || '').trim();
                const key = trimmed.toLowerCase();
                if (!trimmed || key === recipientLower || bccSeen.has(key)) continue;
                bccSeen.add(key);
                bcc.push(trimmed);
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

            const geminiDisabled = !geminiConfig.enabled || !geminiConfig.apiKey;
            const subjectAnalyses = [];
            let videosAnalyzed = 0;
            let commentsVideos = 0;
            let contentBriefsAnalyzed = 0;

            for (const row of candidates) {
                const subjectId = Number(row.subject_id);
                const analysis = await this.commentAnalysisService.analyzeSubject(subjectId);
                videosAnalyzed += analysis.videos_analyzed || 0;
                commentsVideos += analysis.videos?.length || 0;
                contentBriefsAnalyzed += analysis.content_briefs_analyzed || 0;

                subjectAnalyses.push({
                    subjectName: row.subject?.name || `#${subjectId}`,
                    subjectStats: {
                        hot_score: row.hot_score,
                        trend_score: row.trend_score,
                    },
                    videos: analysis.videos || [],
                    geminiDisabled,
                });
            }

            const html = buildAlertEmail({
                candidates,
                subjectAnalyses,
                thresholds: {
                    hot: geminiConfig.alertHotThreshold,
                    trend: geminiConfig.alertTrendThreshold,
                },
                geminiDisabled,
            });

            const ok = await MailService.sendHtml({
                to: recipient,
                subject: `[Alert] ${candidates.length} subject(s) vượt ngưỡng hot/trend`,
                html,
                bcc: bcc.length ? bcc : undefined,
            });

            if (!ok) {
                throw createError(500, 'Failed to send Gmail');
            }

            return ResponseService.responseJson(res, HTTP_STATUS.SUCCESS, {
                sent: true,
                to: recipient,
                bcc_count: bcc.length,
                count: candidates.length,
                thresholds: {
                    hot: geminiConfig.alertHotThreshold,
                    trend: geminiConfig.alertTrendThreshold,
                },
                analysis: {
                    subjects_analyzed: subjectAnalyses.length,
                    videos_analyzed: videosAnalyzed,
                    videos_with_data: commentsVideos,
                    content_briefs_analyzed: contentBriefsAnalyzed,
                    gemini_disabled: geminiDisabled,
                },
                subjects: candidates.map((row) => ({
                    subject_id: row.subject_id,
                    name: row.subject?.name,
                    hot_score: roundScore(row.hot_score),
                    trend_score: roundScore(row.trend_score),
                    posts_count: row.posts_count,
                })),
            });
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = AlertController;
