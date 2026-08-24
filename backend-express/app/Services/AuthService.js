const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const authConfig = require('../../config/auth');
const db = require('../Models');
const UserType = require('../Constants/UserType');
const UserStatus = require('../Constants/UserStatus');
const AuthRepository = require('../Repositories/AuthRepository');

const authRepository = new AuthRepository();

class AuthService {
    generateToken(payload, expiresInOverride = undefined) {
        const opts = { algorithm: authConfig.jwt.algorithm };
        const effective =
            expiresInOverride !== undefined && expiresInOverride !== null
                ? expiresInOverride
                : authConfig.jwt.expiresIn;
        if (effective != null && effective !== '') {
            opts.expiresIn = effective;
        }
        return jwt.sign(payload, authConfig.jwt.secret, opts);
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, authConfig.jwt.secret, {
                algorithms: [authConfig.jwt.algorithm]
            });
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }

    async verifyPassword(password, hashedPassword) {
        return bcrypt.compare(password, hashedPassword);
    }

    /**
     * Login — khớp Laravel `AuthRepository::doLogin` (user_code + password).
     */
    async loginUser(userCode, password) {
        const code = String(userCode).trim();
        const user = await db.User.findOne({
            where: { user_code: code }
        });

        if (!user) {
            throw new Error('Login failed');
        }

        const st = Number(user.status);
        if (st === UserStatus.OFF) {
            throw new Error('Account is not allowed to login');
        }

        if (!UserType.isAllowedLoginRole(user.role)) {
            throw new Error('This account type cannot sign in here');
        }

        const isValidPassword = await this.verifyPassword(password, user.password);
        if (!isValidPassword) {
            throw new Error('Invalid credentials');
        }

        const payload = {
            id: user.id,
            user_code: user.user_code,
            role: String(user.role)
        };

        const token = this.generateToken(payload);
        await authRepository.setJwtActive(user, token);

        const profile = authRepository.toPublicUser(user);

        return {
            access_token: `Bearer ${token}`,
            profile
        };
    }

    async logout(user) {
        if (user) {
            await authRepository.clearJwtActive(user);
        }
    }
}

module.exports = new AuthService();
