'use strict';

const MailService = require('./MailService');
const mailConfig = require('../../config/mail');
const {
    inferServices,
    buildServiceFailureEmail,
    collectErrorText,
} = require('../Helpers/ServiceFailureAlertHelper');
const logger = require('../Logging/logger');

const LOG_PREFIX = '[service-failure-alert]';

/** Gửi mail bất đồng bộ — gọi tại tầng dịch vụ (Apify, YouTube, Gemini, DB…). */
function fireServiceFailureAlert(error, context = {}) {
    void module.exports.notifyFailure(error, context).catch((notifyErr) => {
        logger.error(`${LOG_PREFIX} notify failed`, { message: notifyErr?.message });
    });
}

class ServiceFailureAlertService {
    /**
     * Gửi Gmail khi command/API gọi dịch vụ bị lỗi. Không cooldown — mỗi lần lỗi gửi một lần.
     *
     * @param {Error|object|string|null|undefined} error
     * @param {{ command?: string, url?: string, method?: string, source?: string }} [context]
     */
    async notifyFailure(error, context = {}) {
        const errorMessage =
            typeof error === 'string' ? error : collectErrorText(error) || String(error?.message || '');
        const services = inferServices(error, context);
        const statusCode = error?.statusCode ?? null;

        logger.error(`${LOG_PREFIX} failure detected`, {
            source: context.source || context.command || context.url || 'unknown',
            services,
            statusCode,
            message: errorMessage,
        });

        if (!mailConfig.isTransportReady()) {
            logger.warn(`${LOG_PREFIX} mail transport not configured — skip email`, { services });
            return { notified: false, reason: 'mail_not_configured' };
        }

        const recipient = String(mailConfig.mailMain || '').trim();
        if (!recipient) {
            logger.warn(`${LOG_PREFIX} MAIL_MAIN not set — skip email`, { services });
            return { notified: false, reason: 'no_recipient' };
        }

        const label =
            [context.service, context.operation].filter(Boolean).join(' / ') ||
            (context.method && context.url ? `${context.method} ${context.url}` : null) ||
            context.source ||
            'service-call';

        const html = buildServiceFailureEmail({
            services,
            context,
            errorMessage,
            statusCode,
        });

        const subject = `[Alert] Lỗi dịch vụ — ${label}`;

        const ok = await MailService.sendHtml({
            to: recipient,
            subject,
            html,
            bcc: mailConfig.alertBcc.length ? mailConfig.alertBcc : undefined,
        });

        if (!ok) {
            logger.error(`${LOG_PREFIX} send failed`, { label, services });
            return { notified: false, reason: 'send_failed' };
        }

        logger.info(`${LOG_PREFIX} email sent`, {
            to: recipient,
            bcc_count: mailConfig.alertBcc.length,
            label,
            services,
        });
        return { notified: true, services, label };
    }
}

module.exports = new ServiceFailureAlertService();
module.exports.fireServiceFailureAlert = fireServiceFailureAlert;
