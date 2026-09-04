'use strict';

/**
 * Seed general_settings từ process.env — setting_key = đúng tên env.
 * findOrCreate: không ghi đè nếu đã có.
 */
require('dotenv').config();
const db = require('../../app/Models');
const { GENERAL_SETTINGS } = require('../../app/Constants/AppSettingsKeys');

module.exports = {
    async up() {
        const now = new Date();
        for (const def of GENERAL_SETTINGS) {
            const existing = await db.GeneralSetting.findOne({
                where: { setting_key: def.setting_key },
            });
            if (existing) continue;

            const raw = process.env[def.setting_key];
            await db.GeneralSetting.create({
                setting_key: def.setting_key,
                setting_value: raw == null ? '' : String(raw),
                group: def.group,
                is_secret: def.is_secret ? 1 : 0,
                created_at: now,
                updated_at: now,
            });
        }
    },

    async down() {
        await db.GeneralSetting.destroy({
            where: { setting_key: GENERAL_SETTINGS.map((r) => r.setting_key) },
        });
    },
};
