require('dotenv').config();

module.exports = {
    name: process.env.APP_NAME || 'ATMC Backend',
    env: process.env.NODE_ENV || 'development',
    debug: process.env.APP_DEBUG === 'true',
    url: process.env.APP_URL || 'http://localhost:3000',
    // Support both APP_PORT and PORT for compatibility
    port: process.env.APP_PORT || process.env.PORT || 3000,
    timezone: process.env.APP_TIMEZONE || 'Asia/Tokyo',
    locale: process.env.APP_LOCALE || 'ja',
    fallback_locale: process.env.APP_FALLBACK_LOCALE || 'en'
};

