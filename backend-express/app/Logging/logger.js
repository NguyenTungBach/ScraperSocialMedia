const winston = require('winston');
const { createDailyRotateTransport } = require('./dailyRotateTransport');
const { isGcpLogging } = require('./isGcpLogging');
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
          createDailyRotateTransport('app-%DATE%.log'),
      ];

const logger = winston.createLogger({
    level,
    transports,
});

if (gcp) {
    logger.info('[GCP] Winston → stdout JSON (Cloud Logging)', { loggingMode: 'gcp' });
}

module.exports = logger;
