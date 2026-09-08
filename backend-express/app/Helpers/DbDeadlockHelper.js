'use strict';

const logger = require('../Logging/logger');

/** Lần chạy đầu + 2 retry. */
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 50;

function isDeadlockError(error) {
    if (!error) return false;
    if (/deadlock/i.test(String(error.message || ''))) return true;
    const parent = error.parent || error.original;
    return parent?.code === 'ER_LOCK_DEADLOCK' || parent?.errno === 1213;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry fn when MySQL deadlock aborts the transaction.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ maxAttempts?: number, baseDelayMs?: number, label?: string }} [options]
 * @returns {Promise<T>}
 */
async function withDeadlockRetry(fn, options = {}) {
    const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    const label = options.label || 'transaction';

    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const canRetry = isDeadlockError(error) && attempt < maxAttempts;
            if (!canRetry) throw error;

            const delayMs = baseDelayMs * attempt + Math.floor(Math.random() * baseDelayMs);
            logger.warn('[db-deadlock] retry', {
                label,
                attempt,
                maxAttempts,
                delay_ms: delayMs,
                error: error.message,
            });
            await sleep(delayMs);
        }
    }
    throw lastError;
}

module.exports = {
    withDeadlockRetry,
    isDeadlockError,
};
