'use strict';

const { escapeHtml } = require('./EmailAlertBuilder');

const SERVICE_HINTS = [
    {
        name: 'Apify',
        test(text) {
            if (/APIFY_API_TOKEN/i.test(text)) return true;
            if (/apify/i.test(text)) return true;
            if (/authentication token is not valid/i.test(text)) return true;
            if (/token-not-valid/i.test(text)) return true;
            return false;
        },
    },
    {
        name: 'YouTube',
        test(text) {
            if (/YOUTUBE_API_KEY/i.test(text)) return true;
            if (/youtube/i.test(text)) return true;
            if (/keyInvalid|keyExpired/i.test(text)) return true;
            return false;
        },
    },
    {
        name: 'Gemini',
        test(text) {
            if (/GEMINI_API_KEY/i.test(text)) return true;
            if (/gemini/i.test(text)) return true;
            if (/generativelanguage\.googleapis\.com/i.test(text)) return true;
            if (/API_KEY_INVALID/i.test(text)) return true;
            if (/api key not valid/i.test(text) && !/youtube/i.test(text)) return true;
            return false;
        },
    },
    {
        name: 'Database',
        test(text) {
            if (/sequelize/i.test(text)) return true;
            if (/ECONNREFUSED.*3306|mysql|ER_/i.test(text)) return true;
            if (/database error|connection.*refused/i.test(text)) return true;
            return false;
        },
    },
    {
        name: 'Mail',
        test(text) {
            if (/mail transport|failed to send gmail|smtp failed|ses failed/i.test(text)) return true;
            return false;
        },
    },
];

const HTTP_SERVICE_ROUTE = /\/(scraper|alerts|subjects|comments|compare-report)\b/i;

function collectErrorText(error) {
    const parts = [];
    if (error?.message) parts.push(String(error.message));
    if (error?.name) parts.push(String(error.name));
    if (error?.type) parts.push(String(error.type));
    if (error?.code) parts.push(String(error.code));
    if (error?.reason) parts.push(String(error.reason));
    if (Array.isArray(error?.errors)) {
        for (const item of error.errors) {
            if (item?.message) parts.push(String(item.message));
            if (item?.reason) parts.push(String(item.reason));
        }
    }
    if (error?.error?.message) parts.push(String(error.error.message));
    if (error?.error?.type) parts.push(String(error.error.type));
    return parts.join('\n');
}

function isAuthTokenError(error) {
    const text = collectErrorText(error).toLowerCase();
    const name = String(error?.name || '').toLowerCase();
    if (name === 'jsonwebtokenerror' || name === 'tokenexpirederror') return true;
    if (text.includes('jsonwebtoken')) return true;
    if (text.includes('token expired') && !text.includes('api')) return true;
    if (text.includes('invalid token') && !text.includes('apify') && !text.includes('api')) {
        return true;
    }
    return false;
}

/**
 * @param {Error|object|string|null|undefined} error
 * @returns {string[]}
 */
function detectServicesFromError(error) {
    if (!error || isAuthTokenError(error)) return [];

    const text = typeof error === 'string' ? error : collectErrorText(error);
    if (!text.trim()) return [];

    const matched = [];
    const seen = new Set();
    for (const hint of SERVICE_HINTS) {
        if (hint.test(text) && !seen.has(hint.name)) {
            seen.add(hint.name);
            matched.push(hint.name);
        }
    }
    return matched;
}

/**
 * @param {Error|object} error
 * @param {{ service?: string, operation?: string, url?: string, method?: string }} context
 * @returns {string[]}
 */
function inferServices(error, context = {}) {
    const fromContext = context.service ? [context.service] : [];
    const fromError = detectServicesFromError(error);
    return [...new Set([...fromContext, ...fromError])];
}

/**
 * HTTP API: chỉ báo khi route gọi dịch vụ scrape/alert/AI hoặc lỗi 5xx dịch vụ.
 */
function shouldNotifyHttpError(err, req) {
    if (!err || isAuthTokenError(err)) return false;

    const status = Number(err.statusCode) || 500;
    if (status === 401 || status === 422) return false;

    const url = String(req?.originalUrl || req?.url || '');
    if (HTTP_SERVICE_ROUTE.test(url)) {
        return status >= 500 || status === 429 || status === 502 || status === 503;
    }

    if (String(err.name || '').startsWith('Sequelize') && status >= 500) {
        return true;
    }

    return detectServicesFromError(err).length > 0;
}

function buildServiceFailureEmail({
    services = [],
    context = {},
    errorMessage = '',
    statusCode = null,
} = {}) {
    const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const contextLines = [];
    if (context.service) contextLines.push(`Dịch vụ: ${context.service}`);
    if (context.operation) contextLines.push(`Thao tác: ${context.operation}`);
    if (context.method && context.url) {
        contextLines.push(`Request: ${context.method} ${context.url}`);
    } else if (context.url) {
        contextLines.push(`URL: ${context.url}`);
    }

    const serviceText =
        services.length > 0
            ? services.map((s) => escapeHtml(s)).join(', ')
            : 'Không xác định';

    const contextHtml =
        contextLines.length > 0
            ? `<p style="color:#475569;margin:12px 0;">${contextLines.map((line) => escapeHtml(line)).join('<br/>')}</p>`
            : '';

    const statusHtml =
        statusCode != null
            ? `<p style="margin:8px 0;color:#475569;">HTTP status: <b>${escapeHtml(statusCode)}</b></p>`
            : '';

    return `
      <div style="font-family:Arial,sans-serif;color:#0f172a;max-width:720px;">
        <h2 style="color:#b91c1c;">ScraperSocialMedia — Lỗi dịch vụ</h2>
        <p>Hệ thống gặp lỗi khi gọi dịch vụ bên ngoài hoặc xử lý dữ liệu.</p>
        <p style="color:#64748b;font-size:13px;">Thời gian: ${escapeHtml(now)}</p>
        ${contextHtml}
        <p style="margin:12px 0;">Dịch vụ liên quan: <b>${serviceText}</b></p>
        ${statusHtml}
        ${
            errorMessage
                ? `<div style="margin-top:16px;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
              <div style="font-size:11px;font-weight:700;color:#b91c1c;text-transform:uppercase;margin-bottom:6px;">Chi tiết lỗi</div>
              <pre style="margin:0;font-size:12px;color:#334155;white-space:pre-wrap;word-break:break-word;">${escapeHtml(errorMessage)}</pre>
            </div>`
                : ''
        }
        <p style="margin-top:20px;color:#64748b;font-size:13px;">
          Kiểm tra log GitHub Actions / server và cấu hình biến môi trường (APIFY_API_TOKEN, YOUTUBE_API_KEY, GEMINI_API_KEY, DB_*, MAIL_*).
        </p>
      </div>
    `;
}

module.exports = {
    detectServicesFromError,
    inferServices,
    shouldNotifyHttpError,
    buildServiceFailureEmail,
    collectErrorText,
};
