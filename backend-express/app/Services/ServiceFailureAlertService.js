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

/** Tránh spam mail cùng lỗi (vd. queue retry Apify quota). */
const DEFAULT_ALERT_COOLDOWN_MS = 15 * 60 * 1000;
const alertCooldownMs = Number(process.env.SERVICE_ALERT_COOLDOWN_MS) || DEFAULT_ALERT_COOLDOWN_MS;
/** @type {Map<string, number>} */
const recentAlertSentAt = new Map();

/** Promise đang gửi mail — CLI phải await trước process.exit kẻo mail bị cắt. */
const pendingAlerts = new Set();

function buildAlertDedupeKey(label, errorMessage) {
    const msg = String(errorMessage || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .slice(0, 200);
    return `${label}|${msg}`;
}

function isAlertWithinCooldown(key) {
    const lastSentAt = recentAlertSentAt.get(key);
    if (!lastSentAt) return false;
    return Date.now() - lastSentAt < alertCooldownMs;
}

function markAlertSent(key) {
    recentAlertSentAt.set(key, Date.now());
    if (recentAlertSentAt.size <= 200) return;
    const cutoff = Date.now() - alertCooldownMs;
    for (const [k, sentAt] of recentAlertSentAt) {
        if (sentAt < cutoff) recentAlertSentAt.delete(k);
    }
}

/**
 * Gửi mail bất đồng bộ — gọi tại tầng dịch vụ (Apify, YouTube, Gemini, DB…).
 * HTTP server giữ process sống nên fire-and-forget ổn; CLI dùng flushPendingServiceFailureAlerts().
 */
function fireServiceFailureAlert(error, context = {}) {
    const promise = module.exports
        .notifyFailure(error, context)
        .catch((notifyErr) => {
            logger.error(`${LOG_PREFIX} notify failed`, { message: notifyErr?.message });
        })
        .finally(() => {
            pendingAlerts.delete(promise);
        });
    pendingAlerts.add(promise);
    return promise;
}

/** Chờ mọi alert đang gửi xong (dùng trước process.exit trong CLI). */
async function flushPendingServiceFailureAlerts() {
    if (pendingAlerts.size === 0) return;
    await Promise.allSettled([...pendingAlerts]);
}

class ServiceFailureAlertService {
    /**
     * Gửi Gmail khi command/API gọi dịch vụ bị lỗi.
     * Cùng label + message trong SERVICE_ALERT_COOLDOWN_MS (mặc định 15 phút) chỉ gửi một lần.
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

        const dedupeKey = buildAlertDedupeKey(label, errorMessage);
        if (isAlertWithinCooldown(dedupeKey)) {
            logger.warn(`${LOG_PREFIX} skip duplicate email (cooldown)`, {
                label,
                cooldown_ms: alertCooldownMs,
            });
            return { notified: false, reason: 'cooldown' };
        }

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

        markAlertSent(dedupeKey);

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
module.exports.flushPendingServiceFailureAlerts = flushPendingServiceFailureAlerts;
