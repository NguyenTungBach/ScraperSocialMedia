'use strict';

const db = require('../Models');
const SettingsCache = require('./SettingsCache');
const {
    KEY_SCRAPS,
    GENERAL_SETTINGS,
    KEY_SCRAP_NAMES,
    GENERAL_SETTING_KEYS,
    KEY_SCRAP_SECRET_SET,
    GENERAL_SETTING_SECRET_SET,
} = require('../Constants/AppSettingsKeys');

function looksMasked(value) {
    return typeof value === 'string' && value.startsWith('••••');
}

function shouldSkipSecretUpdate(key, value, secretSet) {
    if (!secretSet.has(key)) return false;
    if (value == null) return true;
    const s = String(value);
    if (s === '') return true;
    if (looksMasked(s)) return true;
    return false;
}

class AppSettingsService {
    async getForAdmin() {
        const [keyRows, settingRows] = await Promise.all([
            db.KeyScrap.findAll({ order: [['provider', 'ASC'], ['key_name', 'ASC']] }),
            db.GeneralSetting.findAll({ order: [['group', 'ASC'], ['setting_key', 'ASC']] }),
        ]);

        const keys = {};
        for (const row of keyRows) {
            keys[row.key_name] = row.key_value == null ? '' : String(row.key_value);
        }

        const settings = {};
        for (const row of settingRows) {
            settings[row.setting_key] =
                row.setting_value == null ? '' : String(row.setting_value);
        }

        return {
            keys,
            settings,
            meta: {
                key_providers: Object.fromEntries(KEY_SCRAPS.map((r) => [r.key_name, r.provider])),
                setting_groups: Object.fromEntries(
                    GENERAL_SETTINGS.map((r) => [r.setting_key, r.group])
                ),
                key_secrets: [...KEY_SCRAP_SECRET_SET],
                setting_secrets: [...GENERAL_SETTING_SECRET_SET],
            },
        };
    }

    /**
     * @param {{ keys?: Record<string, string>, settings?: Record<string, string> }} payload
     */
    async updateFromAdmin(payload = {}) {
        const keysPayload = payload.keys && typeof payload.keys === 'object' ? payload.keys : {};
        const settingsPayload =
            payload.settings && typeof payload.settings === 'object' ? payload.settings : {};

        const now = new Date();
        const keyUpdates = [];
        for (const [name, value] of Object.entries(keysPayload)) {
            if (!KEY_SCRAP_NAMES.includes(name)) continue;
            if (shouldSkipSecretUpdate(name, value, KEY_SCRAP_SECRET_SET)) continue;
            keyUpdates.push(
                db.KeyScrap.update(
                    { key_value: value == null ? '' : String(value), updated_at: now },
                    { where: { key_name: name } }
                )
            );
        }

        const settingUpdates = [];
        for (const [name, value] of Object.entries(settingsPayload)) {
            if (!GENERAL_SETTING_KEYS.includes(name)) continue;
            if (shouldSkipSecretUpdate(name, value, GENERAL_SETTING_SECRET_SET)) continue;
            settingUpdates.push(
                db.GeneralSetting.update(
                    { setting_value: value == null ? '' : String(value), updated_at: now },
                    { where: { setting_key: name } }
                )
            );
        }

        await Promise.all([...keyUpdates, ...settingUpdates]);
        await SettingsCache.load();
        return this.getForAdmin();
    }
}

module.exports = AppSettingsService;
