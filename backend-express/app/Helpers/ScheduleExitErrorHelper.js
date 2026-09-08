'use strict';

/** Prefix on stderr so ScheduleRunner can pick up a human-readable last_error. */
const SCHEDULE_ERROR_PREFIX = '__SCHEDULE_ERROR__:';

const MAX_LAST_ERROR_LEN = 2000;

/**
 * Map raw DB/runtime errors to messages shown on /schedules.
 * @param {string} [message]
 * @returns {string|null}
 */
function formatCommandFailureForSchedule(message) {
    const raw = String(message || '').trim();
    if (!raw) return null;

    if (/deadlock/i.test(raw)) {
        return (
            'MySQL deadlock: nhiều lệnh cào ghi DB cùng lúc (scraper_runs / social_posts). ' +
            'Chạy lại (Run now) hoặc lệch giờ cron FB/YT/TT (vd. 05:00 / 05:15 / 05:30). ' +
            `Chi tiết: ${raw}`
        );
    }

    return raw;
}

/**
 * @param {string} message
 */
function writeScheduleExitError(message) {
    const text = String(message || '').trim();
    if (!text) return;
    process.stderr.write(`${SCHEDULE_ERROR_PREFIX}${text}\n`);
}

/**
 * @param {string} stderr
 * @returns {string|null}
 */
function parseScheduleErrorFromStderr(stderr) {
    const text = String(stderr || '');
    const lines = text.split(/\r?\n/);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
        const line = lines[i];
        const idx = line.indexOf(SCHEDULE_ERROR_PREFIX);
        if (idx >= 0) {
            return line.slice(idx + SCHEDULE_ERROR_PREFIX.length).trim() || null;
        }
    }
    return null;
}

/**
 * @param {{ code: number|null, signal: NodeJS.Signals|null, stderr?: string }} params
 * @returns {string}
 */
function resolveScheduleLastError({ code, signal, stderr = '' }) {
    const parsed = parseScheduleErrorFromStderr(stderr);
    if (parsed) {
        return parsed.length > MAX_LAST_ERROR_LEN
            ? `${parsed.slice(0, MAX_LAST_ERROR_LEN - 1)}…`
            : parsed;
    }

    const stderrText = String(stderr || '');
    if (/deadlock/i.test(stderrText)) {
        const match = stderrText.match(/Deadlock[^\n]*/i);
        const formatted = formatCommandFailureForSchedule(match ? match[0] : stderrText);
        if (formatted) {
            return formatted.length > MAX_LAST_ERROR_LEN
                ? `${formatted.slice(0, MAX_LAST_ERROR_LEN - 1)}…`
                : formatted;
        }
    }

    const codePart = code == null ? 'unknown' : String(code);
    return `Process exited with code ${codePart}${signal ? ` signal ${signal}` : ''}`;
}

module.exports = {
    SCHEDULE_ERROR_PREFIX,
    formatCommandFailureForSchedule,
    writeScheduleExitError,
    parseScheduleErrorFromStderr,
    resolveScheduleLastError,
};
