const ResponseService = require('../../Helpers/ResponseService');
const UserType = require('../../Constants/UserType');

/**
 * @param {...string} allowedRoles — `users.role` (vd. `admin`, `member`)
 *
 * `admin` luôn được phép.
 */
function authorizeUserTypes(...allowedRoles) {
    const allowed = new Set(allowedRoles.map((r) => String(r).toLowerCase()));

    return (req, res, next) => {
        const role = String(req.user?.role || '').toLowerCase();
        if (UserType.isAdmin(role)) {
            return next();
        }
        if (!allowed.has(role)) {
            return ResponseService.responseJsonError(res, 403, 'Forbidden for this account type', null);
        }
        next();
    };
}

module.exports = authorizeUserTypes;
