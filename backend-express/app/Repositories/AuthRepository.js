const bcrypt = require('bcryptjs');
const db = require('../Models');

/**
 * @param {import('sequelize').Model} userRow
 * @returns {object}
 */
function toPublicUser(userRow) {
    const plain = userRow.get({ plain: true });
    delete plain.password;
    delete plain.remember_token;
    delete plain.jwt_active;
    return plain;
}

class AuthRepository {
    toPublicUser(userRow) {
        return toPublicUser(userRow);
    }

    async getProfile(userId) {
        const user = await db.User.findByPk(userId, {
            attributes: { exclude: ['password', 'remember_token', 'jwt_active'] }
        });
        if (!user) {
            return null;
        }
        return toPublicUser(user);
    }

    async forgetPassword(_mailAddress) {
        const err = new Error('Password reset is not available for AWA schema');
        err.statusCode = 501;
        throw err;
    }

    async resetPassword(_payload) {
        const err = new Error('Password reset is not available for AWA schema');
        err.statusCode = 501;
        throw err;
    }

    async checkPassword(user, plainPassword) {
        return bcrypt.compare(String(plainPassword), user.password);
    }

    async changePassword(user, newPassword) {
        user.password = String(newPassword);
        await user.save();
        return user;
    }

    /**
     * Lưu JWT đang active vào `users.jwt_active` (AWA).
     * @param {import('sequelize').Model} user
     * @param {string} token — raw JWT (không prefix Bearer)
     */
    async setJwtActive(user, token) {
        user.jwt_active = String(token);
        await user.save();
    }

    async clearJwtActive(user) {
        user.jwt_active = null;
        await user.save();
    }
}

module.exports = AuthRepository;
