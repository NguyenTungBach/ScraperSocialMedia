'use strict';

/**
 * In-memory map of app settings (key_scraps + general_settings).
 * Keys are exact env names (e.g. APIFY_API_TOKEN).
 */
const logger = require('../Logging/logger');

/** @type {Map<string, string>} */
let cache = new Map();
let loaded = false;
let loadPromise = null;

function get(key) {
    if (!key) return '';
    const v = cache.get(String(key));
    return v == null ? '' : String(v);
}

function getAll() {
    return Object.fromEntries(cache.entries());
}

function isLoaded() {
    return loaded;
}

async function load() {
    if (loadPromise) {
        return loadPromise;
    }
    loadPromise = (async () => {
        const db = require('../Models');
        const next = new Map();

        const [keyRows, settingRows] = await Promise.all([
            db.KeyScrap.findAll({ attributes: ['key_name', 'key_value'] }),
            db.GeneralSetting.findAll({ attributes: ['setting_key', 'setting_value'] }),
        ]);

        for (const row of keyRows) {
            next.set(row.key_name, row.key_value == null ? '' : String(row.key_value));
        }
        for (const row of settingRows) {
            next.set(row.setting_key, row.setting_value == null ? '' : String(row.setting_value));
        }

        cache = next;
        loaded = true;
        logger.info('SettingsCache loaded', { keys: cache.size });
    })();

    try {
        await loadPromise;
    } finally {
        loadPromise = null;
    }
}

async function ensureLoaded() {
    if (loaded) return;
    await load();
}

module.exports = {
    get,
    getAll,
    isLoaded,
    load,
    ensureLoaded,
};
