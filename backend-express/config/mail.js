'use strict';

/**
 * Mail config — MAIL_* lấy từ general_settings (SettingsCache).
 * AWS SES credentials vẫn đọc process.env.
 *
 * Laravel thường có MAIL_FROM_NAME="${APP_NAME}" — Node `dotenv` **không** tự thay ${...}.
 * Hỗ trợ: thay `${VAR}` bằng process.env; nếu MAIL_FROM_ADDRESS dạng `Tên <email@...>` thì tách đúng.
 */

const SettingsCache = require('../app/Services/SettingsCache');

function setting(name, fallback = '') {
    const v = SettingsCache.get(name);
    return v !== '' && v != null ? v : fallback;
}

/**
 * Giống Laravel: `${APP_NAME}` → giá trị env (chỉ [A-Z0-9_]).
 * @param {string} s
 */
function expandEnvPlaceholders(s) {
    if (!s || typeof s !== 'string') {
        return '';
    }
    return s.replace(/\$\{([A-Z0-9_]+)\}/g, (_, key) =>
        process.env[key] != null ? String(process.env[key]) : ''
    );
}

/**
 * @param {string} raw đã expand placeholder
 * @returns {{ displayName: string | null, email: string }}
 */
function splitDisplayNameAndEmail(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) {
        return { displayName: null, email: '' };
    }
    const lt = trimmed.lastIndexOf('<');
    const gt = trimmed.lastIndexOf('>');
    if (lt !== -1 && gt > lt) {
        const email = trimmed.slice(lt + 1, gt).trim();
        let displayName = trimmed.slice(0, lt).trim();
        if (
            (displayName.startsWith('"') && displayName.endsWith('"')) ||
            (displayName.startsWith("'") && displayName.endsWith("'"))
        ) {
            displayName = displayName.slice(1, -1);
        }
        return { displayName: displayName || null, email };
    }
    return { displayName: null, email: trimmed };
}

function resolveFrom() {
    const expandedAddr = expandEnvPlaceholders(setting('MAIL_FROM_ADDRESS') || '');
    const { displayName: parsedName, email: parsedEmail } = splitDisplayNameAndEmail(expandedAddr);
    const expandedFromName = expandEnvPlaceholders(setting('MAIL_FROM_NAME') || '').trim();
    const fromName = expandedFromName || parsedName || 'Hoyocodes';
    const fromAddress = (parsedEmail || expandedAddr.trim()).trim();
    return { fromName, fromAddress };
}

function parsePort() {
    const p = parseInt(setting('MAIL_PORT', '587'), 10);
    return Number.isFinite(p) ? p : 587;
}

/** Danh sách email phân tách bằng dấu phẩy hoặc chấm phẩy (MAIL_ALERT_BCC / BCC_MAIL). */
function parseEmailList(raw) {
    if (!raw || typeof raw !== 'string') {
        return [];
    }
    const seen = new Set();
    const out = [];
    for (const part of raw.split(/[,;]+/)) {
        const email = part.trim();
        if (!email) continue;
        const key = email.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(email);
    }
    return out;
}

function getMailerType() {
    const m = String(setting('MAIL_MAILER', 'smtp'))
        .toLowerCase()
        .trim();
    return m === 'ses' ? 'ses' : 'smtp';
}

function sesRegion() {
    return (
        (process.env.AWS_SES_DEFAULT_REGION && String(process.env.AWS_SES_DEFAULT_REGION).trim()) ||
        (process.env.AWS_DEFAULT_REGION && String(process.env.AWS_DEFAULT_REGION).trim()) ||
        'ap-northeast-1'
    );
}

function hasSesCredentials() {
    const accessKeyId = process.env.AWS_SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
    return Boolean(accessKeyId && secretAccessKey && sesRegion());
}

function isSmtpConnectionError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();
    return (
        code === 'etimedout' ||
        code === 'econnrefused' ||
        code === 'econnreset' ||
        code === 'esocket' ||
        message.includes('connection timeout') ||
        message.includes('timeout') ||
        message.includes('connect econnrefused') ||
        message.includes('socket hang up')
    );
}

function isConfigured() {
    const to = setting('MAIL_MAIN') && String(setting('MAIL_MAIN')).trim();
    const { fromAddress: from } = resolveFrom();
    if (!to || !from) {
        return false;
    }
    if (getMailerType() === 'ses') {
        return Boolean(sesRegion());
    }
    const host = setting('MAIL_HOST') && String(setting('MAIL_HOST')).trim();
    return Boolean(host);
}

/** Gửi tới địa chỉ bất kỳ (account alert): chỉ cần From + SMTP host hoặc SES region — không bắt buộc MAIL_MAIN */
function isTransportReady() {
    const { fromAddress: from } = resolveFrom();
    if (!from) {
        return false;
    }
    if (getMailerType() === 'ses') {
        return Boolean(sesRegion());
    }
    const host = setting('MAIL_HOST') && String(setting('MAIL_HOST')).trim();
    return Boolean(host);
}

module.exports = {
    getMailerType,
    sesRegion,
    hasSesCredentials,
    isSmtpConnectionError,
    isConfigured,
    isTransportReady,
    parseEmailList,
    get fromAddress() {
        return resolveFrom().fromAddress;
    },
    get fromName() {
        return resolveFrom().fromName;
    },
    get mailMain() {
        return setting('MAIL_MAIN') || '';
    },
    /** BCC alert — MAIL_ALERT_BCC từ general_settings (phân tách bằng dấu phẩy). Alias env BCC_MAIL. */
    get alertBcc() {
        const raw = setting('MAIL_ALERT_BCC') || process.env.BCC_MAIL || '';
        return parseEmailList(raw);
    },
    get transportOptions() {
        const port = parsePort();
        const enc = (setting('MAIL_ENCRYPTION') || '').toLowerCase();
        const secure = enc === 'ssl' || port === 465;
        const opts = {
            host: setting('MAIL_HOST') || undefined,
            port,
            secure,
            connectionTimeout: Number(process.env.MAIL_CONNECTION_TIMEOUT_MS) || 20_000,
            greetingTimeout: Number(process.env.MAIL_GREETING_TIMEOUT_MS) || 20_000,
            socketTimeout: Number(process.env.MAIL_SOCKET_TIMEOUT_MS) || 60_000,
        };
        if (!secure && enc === 'tls') {
            opts.requireTLS = true;
        }
        const username = setting('MAIL_USERNAME');
        if (username) {
            const rawPass = String(setting('MAIL_PASSWORD') || '').trim();
            const pass = rawPass
                .replace(/^["']|["']$/g, '')
                .replace(/\s+/g, '');
            opts.auth = {
                user: String(username).trim(),
                pass,
            };
        }
        return opts;
    },
};
