'use strict';

/**
 * Khớp biến môi trường Laravel `.env`.
 * - `MAIL_MAILER=smtp` (mặc định): nodemailer → MAIL_HOST, MAIL_USERNAME, …
 * - `MAIL_MAILER=ses`: AWS SES API (`@aws-sdk/client-sesv2`) — **không** dùng MAIL_USERNAME/PASSWORD SMTP.
 *
 * Laravel thường có MAIL_FROM_NAME="${APP_NAME}" — Node `dotenv` **không** tự thay ${...}.
 * Hỗ trợ: thay `${VAR}` bằng process.env; nếu MAIL_FROM_ADDRESS dạng `Tên <email@...>` thì tách đúng
 * (tránh `"DriveeLink" <${APP_NAME} <a@b>>` khi copy nhầm một dòng).
 */

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
    const expandedAddr = expandEnvPlaceholders(process.env.MAIL_FROM_ADDRESS || '');
    const { displayName: parsedName, email: parsedEmail } = splitDisplayNameAndEmail(expandedAddr);
    const expandedFromName = expandEnvPlaceholders(process.env.MAIL_FROM_NAME || '').trim();
    const fromName = expandedFromName || parsedName || 'Hoyocodes';
    const fromAddress = (parsedEmail || expandedAddr.trim()).trim();
    return { fromName, fromAddress };
}

function parsePort() {
    const p = parseInt(process.env.MAIL_PORT || '587', 10);
    return Number.isFinite(p) ? p : 587;
}

function getMailerType() {
    const m = String(process.env.MAIL_MAILER || 'smtp')
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

function isConfigured() {
    const to = process.env.MAIL_MAIN && String(process.env.MAIL_MAIN).trim();
    const { fromAddress: from } = resolveFrom();
    if (!to || !from) {
        return false;
    }
    if (getMailerType() === 'ses') {
        return Boolean(sesRegion());
    }
    const host = process.env.MAIL_HOST && String(process.env.MAIL_HOST).trim();
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
    const host = process.env.MAIL_HOST && String(process.env.MAIL_HOST).trim();
    return Boolean(host);
}

module.exports = {
    getMailerType,
    sesRegion,
    isConfigured,
    isTransportReady,
    get fromAddress() {
        return resolveFrom().fromAddress;
    },
    get fromName() {
        return resolveFrom().fromName;
    },
    get mailMain() {
        return process.env.MAIL_MAIN || '';
    },
    get transportOptions() {
        const port = parsePort();
        const enc = (process.env.MAIL_ENCRYPTION || '').toLowerCase();
        const secure = enc === 'ssl' || port === 465;
        const opts = {
            host: process.env.MAIL_HOST,
            port,
            secure
        };
        if (!secure && enc === 'tls') {
            opts.requireTLS = true;
        }
        if (process.env.MAIL_USERNAME) {
            opts.auth = {
                user: process.env.MAIL_USERNAME,
                pass: process.env.MAIL_PASSWORD || ''
            };
        }
        return opts;
    }
};
