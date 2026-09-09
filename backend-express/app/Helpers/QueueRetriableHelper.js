'use strict';

const { collectErrorText } = require('./ServiceFailureAlertHelper');
const { isDeadlockError } = require('./DbDeadlockHelper');

const NON_RETRIABLE_MESSAGE = [
    /platform-feature-disabled/i,
    /token-not-valid/i,
    /monthly usage hard limit/i,
    /usage hard limit exceeded/i,
    /quota exceeded/i,
    /billing/i,
    /payment required/i,
    /apikey.*not configured/i,
    /api_token is not configured/i,
    /keyinvalid/i,
    /keyexpired/i,
    /api key not valid/i,
    /authentication token is not valid/i,
];

const TRANSIENT_MESSAGE = [
    /econnreset/i,
    /etimedout/i,
    /enotfound/i,
    /socket hang up/i,
    /network/i,
    /timeout/i,
];

/**
 * Queue retry chỉ dùng cho lỗi tạm thời (mạng, 5xx, deadlock).
 * Lỗi quota/auth/validation không gọi lại dịch vụ ngoài.
 *
 * @param {Error|object|null|undefined} error
 * @returns {boolean}
 */
function isQueueJobRetriable(error) {
    if (!error) return false;

    if (isDeadlockError(error)) return true;

    const statusCode = Number(error.statusCode || error.status || 0);
    const text = collectErrorText(error);

    if (statusCode === 422 || statusCode === 404) return false;
    if (statusCode === 401 || statusCode === 403) return false;

    if (NON_RETRIABLE_MESSAGE.some((re) => re.test(text))) return false;

    if (statusCode === 429 || statusCode === 502 || statusCode === 503 || statusCode === 504) {
        return true;
    }

    const code = String(error.code || '').toUpperCase();
    if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENOTFOUND') {
        return true;
    }

    if (TRANSIENT_MESSAGE.some((re) => re.test(text))) return true;

    return true;
}

module.exports = {
    isQueueJobRetriable,
};
