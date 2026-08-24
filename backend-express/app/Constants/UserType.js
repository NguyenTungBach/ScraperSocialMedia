/**
 * AWA `users.role` — khớp Laravel `User::USER_ROLE_*`.
 */
module.exports = {
    ADMIN: 'admin',
    DRIVER: 'driver',

    ALLOWED_LOGIN_ROLES: Object.freeze(['admin', 'driver']),

    isAllowedLoginRole(role) {
        const r = String(role || '').toLowerCase();
        return this.ALLOWED_LOGIN_ROLES.includes(r);
    },

    isAdmin(role) {
        return String(role || '').toLowerCase() === this.ADMIN;
    }
};
