require('dotenv').config();

/**
 * Thời hạn access token (jsonwebtoken `expiresIn`).
 * - `none` / `never` (không phân biệt hoa thường): **không** gắn claim `exp` — token không hết hạn về mặt JWT
 *   (tương đương Laravel jwt: `ttl` null / bỏ `exp` khỏi required_claims khi không phát hành exp).
 * - Các giá trị khác: như `24h`, `7d`, số giây — truyền thẳng cho `jwt.sign`.
 */
function resolveJwtExpiresIn() {
    const v = process.env.JWT_EXPIRES_IN;
    if (v === undefined || v === null) {
        return '24h';
    }
    const s = String(v).trim();
    if (s === '') {
        return '24h';
    }
    if (/^none$/i.test(s) || /^never$/i.test(s)) {
        return null;
    }
    return s;
}

module.exports = {
    jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key',
        expiresIn: resolveJwtExpiresIn(),
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        algorithm: 'HS256'
    },
    guards: {
        user: {
            model: 'User',
            provider: 'users'
        }
    },
    defaultGuard: 'user'
};
