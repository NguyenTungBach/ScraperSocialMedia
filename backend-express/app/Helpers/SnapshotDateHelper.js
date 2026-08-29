'use strict';

/**
 * Snapshot date helpers — dùng APP_TIMEZONE (mặc định Asia/Ho_Chi_Minh).
 */

function resolveTimezone() {
    return String(process.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh').trim() || 'Asia/Ho_Chi_Minh';
}

/** @returns {string} YYYY-MM-DD in APP_TIMEZONE */
function todaySnapshotDate(refDate = new Date()) {
    const d = refDate instanceof Date ? refDate : new Date(refDate);
    const base = Number.isNaN(d.getTime()) ? new Date() : d;
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: resolveTimezone(),
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return fmt.format(base);
}

/**
 * @param {unknown} value
 * @returns {string|null} YYYY-MM-DD
 */
function normalizeSnapshotDate(value) {
    if (value == null || value === '') return null;
    if (value === 'today') return todaySnapshotDate();
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return todaySnapshotDate(d);
}

module.exports = {
    normalizeSnapshotDate,
    resolveTimezone,
    todaySnapshotDate,
};
