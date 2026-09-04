/**
 * `users.role` — admin (full) | member (read-only).
 */
module.exports = {
    ADMIN: 'admin',
    MEMBER: 'member',

    ALLOWED_LOGIN_ROLES: Object.freeze(['admin', 'member']),

    isAllowedLoginRole(role) {
        const r = String(role || '').toLowerCase();
        return this.ALLOWED_LOGIN_ROLES.includes(r);
    },

    isAdmin(role) {
        return String(role || '').toLowerCase() === this.ADMIN;
    },

    isMember(role) {
        return String(role || '').toLowerCase() === this.MEMBER;
    }
};
