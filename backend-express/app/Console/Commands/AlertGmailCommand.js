'use strict';

const createError = require('http-errors');
const AlertService = require('../../Services/AlertService');
const logger = require('../../Logging/logger');

function parseBcc(raw) {
    const value = String(raw || '').trim();
    if (!value) return null;
    return value
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

/**
 * Gửi alert Gmail — dùng cho GitHub Actions (Gmail SMTP trên runner, không qua Render).
 * Chạy: npm run app:alert-gmail
 * Env tuỳ chọn: ALERT_SUBJECT_ID, ALERT_TO, ALERT_BCC
 */
class AlertGmailCommand {
    static signature = 'app:alert-gmail';

    static scheduleEnabled = false;

    async handle() {
        const subjectRaw = String(process.env.ALERT_SUBJECT_ID || '').trim();
        let subject_id = null;
        if (subjectRaw) {
            subject_id = Number(subjectRaw);
            if (!Number.isInteger(subject_id) || subject_id <= 0) {
                throw createError(422, `Invalid ALERT_SUBJECT_ID: ${subjectRaw}`);
            }
        }

        const to = String(process.env.ALERT_TO || '').trim() || null;
        const bcc = parseBcc(process.env.ALERT_BCC);

        const service = new AlertService();
        const result = await service.runGmailAlert({ subject_id, to, bcc });

        logger.info('[alert] Gmail alert finished', result);
        return result;
    }
}

module.exports = AlertGmailCommand;
