const i18next = require('i18next');
const path = require('path');
const fs = require('fs');
const appConfig = require('../../config/app');

/**
 * Translation Helper
 * Match Laravel: trans() function
 *
 * Usage:
 *   Translation.trans('api.allocation.msg.allocation_running_process')
 *   Translation.trans('api.request.success', { name: 'John' })
 */
class Translation {
    static initialized = false;
    static i18n = null;

    /**
     * Initialize i18next
     * Loads all translation files from resources/lang/{locale}/
     */
    static init() {
        if (this.initialized) return;

        const resources = {};
        const locales = ['ja', 'en'];
        const langBasePath = path.join(__dirname, '../../resources/lang');

        // Load translation files for each locale
        locales.forEach(locale => {
            resources[locale] = {};
            const langDir = path.join(langBasePath, locale);

            if (fs.existsSync(langDir)) {
                const files = fs.readdirSync(langDir).filter(f => f.endsWith('.js'));
                files.forEach(file => {
                    const namespace = file.replace('.js', '');
                    try {
                        const translations = require(path.join(langDir, file));
                        resources[locale][namespace] = translations;
                    } catch (error) {
                        console.error(`Error loading translation file ${file} for locale ${locale}:`, error.message);
                    }
                });
            }
        });

        // Initialize i18next
        i18next.init({
            lng: appConfig.locale,
            fallbackLng: appConfig.fallback_locale,
            resources: resources,
            interpolation: {
                escapeValue: false
            },
            defaultNS: 'api',
            ns: Object.keys(resources[appConfig.locale] || {}),
            nsSeparator: ':',
            keySeparator: '.'
        });

        this.i18n = i18next;
        this.initialized = true;
    }

    /**
     * Translate key
     * Match Laravel: trans('api.allocation.msg.allocation_running_process')
     *
     * @param {string} key - Translation key (dot notation, e.g., 'api.allocation.msg.allocation_running_process')
     * @param {Object} options - Translation options (for interpolation and locale override)
     * @param {string} options.locale - Optional locale override
     * @returns {string} Translated string
     *
     * @example
     * Translation.trans('api.allocation.msg.allocation_running_process')
     * Translation.trans('api.request.success')
     * Translation.trans('api.pusher.report.delivery.create', { plate_number: 'ABC123', name_drive: 'John' })
     */
    static trans(key, options = {}) {
        if (!this.initialized) {
            this.init();
        }

        if (!key) {
            return '';
        }

        // Extract namespace and key
        // 'api.allocation.msg.allocation_running_process' -> namespace: 'api', key: 'allocation.msg.allocation_running_process'
        const parts = key.split('.');
        if (parts.length === 0) {
            return key;
        }

        const namespace = parts[0]; // 'api', 'request', etc.
        const restKey = parts.slice(1).join('.'); // 'allocation.msg.allocation_running_process'

        // Extract locale from options if provided
        const locale = options.locale || appConfig.locale;
        const cleanOptions = { ...options };
        delete cleanOptions.locale; // Remove locale from options to avoid passing to i18next

        // If no restKey, use namespace as key
        const translationKey = restKey || namespace;

        try {
            // Get translation directly from resources (more reliable than i18next for locale switching)
            const resources = this.i18n.options.resources;

            if (!resources || !resources[locale] || !resources[locale][namespace]) {
                return key; // Return key if locale or namespace not found
            }

            const namespaceTranslations = resources[locale][namespace];

            // Navigate nested objects (auth.failed.mail_address) or flat Laravel keys (api "work.title.required")
            const keyParts = translationKey.split('.');
            let value;
            let found = false;

            const resolveIn = (nsObj) => {
                if (!nsObj || typeof nsObj !== 'object') {
                    return { ok: false, val: undefined };
                }
                let v = nsObj;
                let ok = true;
                for (const part of keyParts) {
                    if (v && typeof v === 'object' && part in v) {
                        v = v[part];
                    } else {
                        ok = false;
                        break;
                    }
                }
                if (ok && (typeof v === 'string' || typeof v === 'number')) {
                    return { ok: true, val: v };
                }

                // Laravel-sync hybrid style:
                // e.g. { "mes.reset_password": { text_title: "..." } }
                // key `mes.reset_password.text_title` should resolve.
                for (let i = keyParts.length - 1; i >= 1; i -= 1) {
                    const dottedPrefix = keyParts.slice(0, i).join('.');
                    if (!(dottedPrefix in nsObj)) {
                        continue;
                    }
                    let nested = nsObj[dottedPrefix];
                    let nestedOk = true;
                    for (const part of keyParts.slice(i)) {
                        if (nested && typeof nested === 'object' && part in nested) {
                            nested = nested[part];
                        } else {
                            nestedOk = false;
                            break;
                        }
                    }
                    if (nestedOk && (typeof nested === 'string' || typeof nested === 'number')) {
                        return { ok: true, val: nested };
                    }
                }

                if (translationKey in nsObj && (typeof nsObj[translationKey] === 'string' || typeof nsObj[translationKey] === 'number')) {
                    return { ok: true, val: nsObj[translationKey] };
                }
                return { ok: false, val: undefined };
            };

            const primary = resolveIn(namespaceTranslations);
            if (primary.ok) {
                value = primary.val;
                found = true;
            } else if (locale !== appConfig.fallback_locale && resources[appConfig.fallback_locale] && resources[appConfig.fallback_locale][namespace]) {
                const fb = resolveIn(resources[appConfig.fallback_locale][namespace]);
                if (fb.ok) {
                    value = fb.val;
                    found = true;
                }
            }

            if (!found || (typeof value !== 'string' && typeof value !== 'number')) {
                return key;
            }

            // If value is a string, apply interpolation
            if (typeof value === 'string' && Object.keys(cleanOptions).length > 0) {
                // Simple interpolation: replace :key with value
                let interpolated = value;
                for (const [k, v] of Object.entries(cleanOptions)) {
                    interpolated = interpolated.replace(new RegExp(`:${k}`, 'g'), String(v));
                }
                return interpolated;
            }

            return typeof value === 'string' ? value : key;
        } catch (error) {
            console.error(`Translation error for key "${key}":`, error.message);
            return key; // Return key on error
        }
    }

    /**
     * Get current locale
     * @returns {string} Current locale
     */
    static getLocale() {
        return appConfig.locale;
    }

    /**
     * Set locale (for request-specific translations)
     * @param {string} locale - Locale to set
     */
    static setLocale(locale) {
        if (this.initialized && this.i18n) {
            this.i18n.changeLanguage(locale);
        }
    }

    /**
     * Check if translation exists
     * @param {string} key - Translation key
     * @param {string} locale - Optional locale
     * @returns {boolean} True if translation exists
     */
    static exists(key, locale = null) {
        if (!this.initialized) {
            this.init();
        }

        const parts = key.split('.');
        if (parts.length === 0) {
            return false;
        }

        const namespace = parts[0];
        const restKey = parts.slice(1).join('.');
        const fullKey = restKey ? `${namespace}:${restKey}` : namespace;
        const targetLocale = locale || appConfig.locale;

        try {
            const translation = this.i18n.t(fullKey, {
                lng: targetLocale,
                ns: namespace,
                returnObjects: false,
                defaultValue: null
            });
            return translation !== null && translation !== fullKey;
        } catch (error) {
            return false;
        }
    }
}

// Auto-initialize on module load
Translation.init();

module.exports = Translation;
