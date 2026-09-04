const ResponseService = require('../../Helpers/ResponseService');
const UserType = require('../../Constants/UserType');

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * After authenticate(): allow GET/HEAD/OPTIONS for any logged-in role;
 * mutations require admin.
 */
function requireAdminForWrites() {
    return (req, res, next) => {
        if (READ_METHODS.has(String(req.method || '').toUpperCase())) {
            return next();
        }
        if (UserType.isAdmin(req.user?.role)) {
            return next();
        }
        return ResponseService.responseJsonError(
            res,
            403,
            'Forbidden for this account type',
            null
        );
    };
}

module.exports = requireAdminForWrites;
