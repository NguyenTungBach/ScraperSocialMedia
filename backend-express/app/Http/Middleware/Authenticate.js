const AuthService = require('../../Services/AuthService');
const ResponseService = require('../../Helpers/ResponseService');
const db = require('../../Models');
const UserType = require('../../Constants/UserType');

/**
 * JWT payload: `{ id, user_code, role }` — khớp AWA users.
 */
const authenticate = () => {
    return async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return ResponseService.responseJsonError(res, 401, 'Token not provided', null);
            }

            const token = authHeader.substring(7);

            let decoded;
            try {
                decoded = AuthService.verifyToken(token);
            } catch (error) {
                return ResponseService.responseJsonError(res, 401, 'Invalid or expired token', null);
            }

            if (!decoded.id) {
                return ResponseService.responseJsonError(res, 401, 'Invalid token payload', null);
            }

            const user = await db.User.findByPk(decoded.id, {
                attributes: { exclude: ['remember_token'] }
            });

            if (!user) {
                return ResponseService.responseJsonError(res, 404, 'User not found', null);
            }

            if (!UserType.isAllowedLoginRole(user.role)) {
                return ResponseService.responseJsonError(res, 403, 'Account role not allowed', null);
            }

            if (decoded.role != null && String(decoded.role) !== String(user.role)) {
                return ResponseService.responseJsonError(res, 401, 'Token stale', null);
            }

            req.user = user;
            next();
        } catch (error) {
            return next(error);
        }
    };
};

module.exports = authenticate;
