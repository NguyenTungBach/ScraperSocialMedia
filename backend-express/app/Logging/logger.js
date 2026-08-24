const path = require('path');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const { isGcpLogging } = require('./isGcpLogging');

const logDir = process.env.LOG_PATH || path.join(__dirname, '../../storage/logs');
const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const lineFormat = winston.format.printf(({ level: lv, message, timestamp, ...meta }) => {
    const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${lv}] ${message}${rest}`;
});

const gcp = isGcpLogging();

const transports = gcp
    ? [
          new winston.transports.Console({
              format: winston.format.combine(
                  winston.format.timestamp(),
                  winston.format.errors({ stack: true }),
                  winston.format.json()
              ),
          }),
      ]
    : [
          new winston.transports.Console({
              format: winston.format.combine(
                  winston.format.colorize(),
                  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                  lineFormat
              ),
          }),
          new DailyRotateFile({
              dirname: logDir,
              filename: 'app-%DATE%.log',
              datePattern: 'YYYY-MM-DD',
              maxFiles: process.env.LOG_MAX_FILES || '14d',
              format: winston.format.combine(
                  winston.format.timestamp(),
                  winston.format.errors({ stack: true }),
                  winston.format.json()
              ),
          }),
      ];

const logger = winston.createLogger({
    level,
    transports,
});

if (gcp) {
    logger.info('[GCP] Winston → stdout JSON (Cloud Logging)', { loggingMode: 'gcp' });
}

module.exports = logger;
