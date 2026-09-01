'use strict';

const fs = require('fs');
const path = require('path');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logDir = process.env.LOG_PATH || path.join(__dirname, '../../storage/logs');

const jsonFileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

function parseRetentionDays(maxFiles = process.env.LOG_MAX_FILES || '14d') {
    const match = String(maxFiles).match(/^(\d+)d$/i);
    return match ? Number(match[1]) : 14;
}

/** Xóa file log cũ theo ngày trong tên (dùng cho file legacy chưa có trong audit rotate). */
function cleanupStaleApiRequestLogs() {
    const retentionDays = parseRetentionDays();
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    if (!fs.existsSync(logDir)) {
        return;
    }

    const pattern = /^api_request_(\d{4})_(\d{2})_(\d{2})\.log$/;

    for (const name of fs.readdirSync(logDir)) {
        const match = name.match(pattern);
        if (!match) {
            continue;
        }

        const fileTime = new Date(`${match[1]}-${match[2]}-${match[3]}T23:59:59.999Z`).getTime();
        if (fileTime >= cutoff) {
            continue;
        }

        try {
            fs.unlinkSync(path.join(logDir, name));
        } catch {
            // ignore missing or locked files
        }
    }
}

function createDailyRotateTransport(filename, datePattern = 'YYYY-MM-DD') {
    return new DailyRotateFile({
        dirname: logDir,
        filename,
        datePattern,
        maxFiles: process.env.LOG_MAX_FILES || '14d',
        format: jsonFileFormat,
    });
}

module.exports = {
    logDir,
    createDailyRotateTransport,
    jsonFileFormat,
    cleanupStaleApiRequestLogs,
};
