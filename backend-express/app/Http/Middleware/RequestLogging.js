const winston = require('winston');
const { isGcpLogging } = require('../../Logging/isGcpLogging');
const { createDailyRotateTransport, jsonFileFormat, cleanupStaleApiRequestLogs } = require('../../Logging/dailyRotateTransport');

/**
 * Request logging middleware
 * Log requests and responses
 */
class RequestLogging {
    constructor() {
        this.logger = this.getLogger();
    }

    /**
     * Get logger instance
     */
    getLogger() {
        if (isGcpLogging()) {
            return winston.createLogger({
                level: 'info',
                defaultMeta: { loggingMode: 'gcp', channel: 'api_request' },
                transports: [
                    new winston.transports.Console({
                        format: jsonFileFormat,
                    }),
                ],
            });
        }

        cleanupStaleApiRequestLogs();

        return winston.createLogger({
            level: 'info',
            transports: [createDailyRotateTransport('api_request_%DATE%.log', 'YYYY_MM_DD')],
        });
    }

    /**
     * Log request
     */
    logRequest(req, res, next) {
        const user = req.user;
        const userIdentifier = user ? user.login_id || `User:${user.id}` : null;

        const url = req.url;
        const queryString = req.url.split('?')[1] || '';
        const method = req.method;
        const ip = req.ip || req.connection.remoteAddress;
        const headers = this.getHeadersFromRequest(req);
        const body = req.body ? JSON.stringify(req.body) : '';

        const methodUrlString = `${ip} ${method} ${url}`;

        // Mask Authorization header
        if (headers.Authorization || headers.authorization) {
            const authHeader = headers.Authorization || headers.authorization;
            headers.Authorization = userIdentifier ? `${userIdentifier}-xxxxxxx` : 'xxxxxxx';
            delete headers.authorization;
        }

        this.logger.info(
            {
                type: 'request',
                user: userIdentifier,
                method,
                url,
                queryString,
                ip,
                headers,
                body,
            },
            `Incoming request: ${userIdentifier ? `User: ${userIdentifier}` : ''}`
        );

        // Log response when complete
        const originalSend = res.send;
        const self = this;
        res.send = function (data) {
            const responseBody = typeof data === 'string' ? data : JSON.stringify(data);
            self.logger.info(
                {
                    type: 'response',
                    user: userIdentifier,
                    statusCode: res.statusCode,
                    body: responseBody,
                },
                `Outgoing response: ${userIdentifier ? `User: ${userIdentifier}` : ''}`
            );
            originalSend.call(this, data);
        };

        next();
    }

    /**
     * Get headers from request
     */
    getHeadersFromRequest(req) {
        const headers = {};
        Object.keys(req.headers).forEach(key => {
            headers[key] = req.headers[key];
        });
        return headers;
    }
}

// Create singleton instance
const requestLogging = new RequestLogging();

module.exports = requestLogging.logRequest.bind(requestLogging);
