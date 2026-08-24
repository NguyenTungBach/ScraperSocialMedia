/**
 * Application exception base class
 */
class AppException extends Error {
    constructor(message, statusCode = 500, code = null) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Validation exception
 */
class ValidationException extends AppException {
    constructor(message, errors = []) {
        super(message, 422, 'VALIDATION_ERROR');
        this.errors = errors;
    }
}

/**
 * Authentication exception
 */
class AuthenticationException extends AppException {
    constructor(message = 'Unauthenticated') {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}

/**
 * Authorization exception
 */
class AuthorizationException extends AppException {
    constructor(message = 'Unauthorized') {
        super(message, 403, 'AUTHORIZATION_ERROR');
    }
}

/**
 * Resource not found exception
 */
class NotFoundException extends AppException {
    constructor(message = 'Resource not found') {
        super(message, 404, 'NOT_FOUND');
    }
}

/**
 * Business logic exception
 */
class BusinessLogicException extends AppException {
    constructor(message, statusCode = 400) {
        super(message, statusCode, 'BUSINESS_LOGIC_ERROR');
    }
}

module.exports = {
    AppException,
    ValidationException,
    AuthenticationException,
    AuthorizationException,
    NotFoundException,
    BusinessLogicException
};
