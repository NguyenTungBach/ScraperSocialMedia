/**
 * Khớp `backend/app/Helpers/ResponseService.php` + `Controller::responseJson` / `responseJsonError`.
 *
 * - responseJson: luôn HTTP 200, `code` nằm trong body (giống Laravel `response()->json($return)`).
 * - responseJsonError: HTTP status = `code`, body có message / message_content / …
 */
class ResponseService {
    /**
     * @param {Object} res
     * @param {number} code — mã nghiệp vụ (vd. 200), không dùng làm HTTP status
     * @param {Object|null} data
     * @param {string|null} message
     * @param {string|null} messageContent
     */
    static responseJson(res, code = 200, data = null, message = null, messageContent = null) {
        const c =
            code === undefined || code === null || typeof code !== 'number' ? 200 : code;

        const response = { code: c, data };
        if (message) {
            response.message = message;
        }
        if (messageContent) {
            response.message_content = messageContent;
        }

        return res.status(200).json(response);
    }

    /**
     * @param {Object} res
     * @param {number} code — HTTP status + body.code
     * @param {string|null} message — JSON `message` (Laravel: tham số 2)
     * @param {string|null} messageContent — JSON `message_content` (Laravel: tham số 3)
     * @param {string|null} internalMessage — JSON `message_internal` (non-production)
     * @param {Object|null} dataError
     */
    static responseJsonError(
        res,
        code = 500,
        message = null,
        messageContent = null,
        internalMessage = null,
        dataError = null
    ) {
        let httpCode =
            code !== undefined && code !== null && typeof code === 'number' && code >= 100 && code < 600
                ? code
                : 500;

        const response = {
            code: httpCode,
            message: message ?? 'Something went wrong',
            message_content: messageContent ?? null,
            message_internal: !['production', 'product'].includes(process.env.APP_ENV)
                ? internalMessage
                : null,
            data_error: dataError
        };

        if (httpCode < 100 || httpCode >= 600) {
            httpCode = 500;
            response.code = 500;
        }

        return res.status(httpCode).json(response);
    }

    static responseJsonSuccess(res, data, message = null) {
        return this.responseJson(res, 200, data, message);
    }

    static responseJsonCreated(res, data, message = 'Created') {
        return this.responseJson(res, 201, data, message);
    }

    static responseJsonValidationError(res, errors, message = 'Validation error') {
        const messageInternal = {};
        if (Array.isArray(errors)) {
            errors.forEach((err) => {
                const field = err.field || err.path?.[0];
                if (field) {
                    if (!messageInternal[field]) {
                        messageInternal[field] = [];
                    }
                    messageInternal[field].push(err.message);
                }
            });
        } else if (typeof errors === 'object' && errors !== null) {
            Object.keys(errors).forEach((field) => {
                const errorMessage = errors[field];
                if (Array.isArray(errorMessage)) {
                    messageInternal[field] = errorMessage;
                } else {
                    messageInternal[field] = [errorMessage];
                }
            });
        }

        const firstError =
            Array.isArray(errors) && errors.length > 0
                ? errors[0].message
                : typeof errors === 'object' && errors !== null && Object.keys(errors).length > 0
                  ? Array.isArray(errors[Object.keys(errors)[0]])
                      ? errors[Object.keys(errors)[0]][0]
                      : errors[Object.keys(errors)[0]]
                  : message;

        return res.status(422).json({
            code: 422,
            message: firstError,
            message_content: null,
            message_internal: messageInternal,
            data_error: null
        });
    }

    static responseJsonPaginated(rows, page, perPage, total) {
        return {
            result: rows,
            pagination: {
                display: rows.length,
                total_records: total,
                per_page: perPage,
                current_page: page,
                total_pages: Math.ceil(total / perPage)
            }
        };
    }

    static responseCollection(rows) {
        return {
            result: rows
        };
    }

    static toUnixTimestamp(date) {
        if (!date) {
            return null;
        }
        if (date instanceof Date) {
            return Math.floor(date.getTime() / 1000);
        }
        if (typeof date === 'string') {
            return Math.floor(new Date(date).getTime() / 1000);
        }
        return date;
    }

    static responseJsonEx(res, exception) {
        if (
            exception &&
            exception.statusCode &&
            typeof exception.statusCode === 'number' &&
            exception.statusCode >= 400 &&
            exception.statusCode < 600
        ) {
            if (exception.statusCode === 422 || exception.name === 'ValidationException') {
                return this.responseJsonValidationError(
                    res,
                    exception.errors || {},
                    exception.message || 'Validation error'
                );
            }
            const statusCode =
                exception.statusCode && typeof exception.statusCode === 'number'
                    ? exception.statusCode
                    : 500;
            const errorMessage = exception.message || 'Error';
            return this.responseJsonError(res, statusCode, errorMessage, null, exception.stack, null);
        }

        if (exception.name === 'ValidationError' || exception.statusCode === 422) {
            return this.responseJsonValidationError(
                res,
                exception.errors || {},
                exception.message || 'Validation error'
            );
        }

        if (exception.statusCode === 404 || (exception.message && exception.message.includes('not found'))) {
            return this.responseJsonError(res, 404, exception.message || 'Not found', null);
        }

        if (
            exception.statusCode === 401 ||
            exception.name === 'JsonWebTokenError' ||
            exception.name === 'TokenExpiredError'
        ) {
            return this.responseJsonError(res, 401, exception.message || 'Unauthenticated', null);
        }

        if (exception.statusCode === 403) {
            return this.responseJsonError(res, 403, exception.message || 'Access denied', null);
        }

        if (exception.name === 'SequelizeValidationError') {
            const errors = {};
            if (exception.errors) {
                exception.errors.forEach((err) => {
                    errors[err.path] = err.message;
                });
            }
            return this.responseJsonValidationError(res, errors, 'Validation error');
        }

        if (exception.name === 'SequelizeUniqueConstraintError') {
            return this.responseJsonError(res, 422, 'Duplicate entry', 'Unprocessable Entity');
        }

        const statusCode = exception.statusCode || 500;
        const message =
            process.env.NODE_ENV === 'production'
                ? 'Internal server error'
                : exception.message || 'Something went wrong';

        return this.responseJsonError(res, statusCode, message, null);
    }
}

module.exports = ResponseService;
