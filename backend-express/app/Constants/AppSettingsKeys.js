'use strict';

/** Whitelist — tên key = đúng tên biến env. */
const KEY_SCRAPS = [
    { key_name: 'APIFY_API_TOKEN', provider: 'apify', is_secret: true },
    { key_name: 'YOUTUBE_API_KEY', provider: 'youtube', is_secret: true },
    { key_name: 'GEMINI_API_KEY', provider: 'gemini', is_secret: true },
    { key_name: 'GEMINI_MODEL', provider: 'gemini', is_secret: false },
    { key_name: 'GEMINI_FALLBACK_MODELS', provider: 'gemini', is_secret: false },
    { key_name: 'GEMINI_MAX_RETRIES', provider: 'gemini', is_secret: false },
    { key_name: 'GEMINI_RETRY_DELAY_MS', provider: 'gemini', is_secret: false },
];

const GENERAL_SETTINGS = [
    { setting_key: 'ALERT_TREND_THRESHOLD', group: 'alert', is_secret: false },
    { setting_key: 'ALERT_HOT_THRESHOLD', group: 'alert', is_secret: false },
    { setting_key: 'MAIL_MAILER', group: 'mail', is_secret: false },
    { setting_key: 'MAIL_HOST', group: 'mail', is_secret: false },
    { setting_key: 'MAIL_PORT', group: 'mail', is_secret: false },
    { setting_key: 'MAIL_USERNAME', group: 'mail', is_secret: false },
    { setting_key: 'MAIL_PASSWORD', group: 'mail', is_secret: true },
    { setting_key: 'MAIL_ENCRYPTION', group: 'mail', is_secret: false },
    { setting_key: 'MAIL_FROM_ADDRESS', group: 'mail', is_secret: false },
    { setting_key: 'MAIL_FROM_NAME', group: 'mail', is_secret: false },
    { setting_key: 'MAIL_MAIN', group: 'mail', is_secret: false },
    { setting_key: 'MAIL_ALERT_BCC', group: 'mail', is_secret: false },
];

const KEY_SCRAP_NAMES = KEY_SCRAPS.map((r) => r.key_name);
const GENERAL_SETTING_KEYS = GENERAL_SETTINGS.map((r) => r.setting_key);
const KEY_SCRAP_SECRET_SET = new Set(KEY_SCRAPS.filter((r) => r.is_secret).map((r) => r.key_name));
const GENERAL_SETTING_SECRET_SET = new Set(
    GENERAL_SETTINGS.filter((r) => r.is_secret).map((r) => r.setting_key)
);

module.exports = {
    KEY_SCRAPS,
    GENERAL_SETTINGS,
    KEY_SCRAP_NAMES,
    GENERAL_SETTING_KEYS,
    KEY_SCRAP_SECRET_SET,
    GENERAL_SETTING_SECRET_SET,
};
