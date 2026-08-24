const ResponseService = require('../Helpers/ResponseService');
const logger = require('../Logging/logger');

class ExceptionHandler {
    static handle(err, req, res, next) {
        logger.error(err.message, {
            stack: err.stack,
            name: err.name,
            url: req.originalUrl || req.url,
            method: req.method,
            user: req.user
                ? { id: req.user.id, user_code: req.user.user_code, role: req.user.role }
                : undefined
        });

        if (
            err.statusCode === 422 &&
            err.errors &&
            typeof err.errors === 'object' &&
            !Array.isArray(err.errors)
        ) {
            return ResponseService.responseJsonValidationError(
                res,
                err.errors,
                err.message || 'Validation error'
            );
        }

        if (err.statusCode) {
            return ResponseService.responseJsonError(res, err.statusCode, err.message, err.name || null);
        }

        if (err.name === 'SequelizeValidationError') {
            return this.handleSequelizeValidationError(err, res);
        }

        if (err.name === 'SequelizeUniqueConstraintError') {
            return this.handleSequelizeUniqueConstraintError(err, res);
        }

        if (err.name === 'SequelizeDatabaseError') {
            return this.handleSequelizeDatabaseError(err, res);
        }

        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return ResponseService.responseJsonError(
                res,
                401,
                err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token',
                'Unauthorized'
            );
        }

        const statusCode = err.statusCode || 500;
        const message =
            process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;

        return ResponseService.responseJsonError(res, statusCode, message, 'Internal Server Error');
    }

    static handleSequelizeValidationError(err, res) {
        return ResponseService.responseJsonError(res, 422, 'Validation error', 'Unprocessable Entity');
    }

    static handleSequelizeUniqueConstraintError(err, res) {
        const field = err.errors[0]?.path || 'field';
        return ResponseService.responseJsonError(res, 409, `${field} already exists`, 'Conflict');
    }

    static handleSequelizeDatabaseError(err, res) {
        return ResponseService.responseJsonError(res, 500, 'Database error', 'Internal Server Error');
    }
}

module.exports = ExceptionHandler;
