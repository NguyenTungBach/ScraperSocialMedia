'use strict';

/**
 * Seed key_scraps từ process.env — key_name = đúng tên env.
 * findOrCreate: không ghi đè nếu đã có.
 */
require('dotenv').config();
const db = require('../../app/Models');
const { KEY_SCRAPS } = require('../../app/Constants/AppSettingsKeys');

module.exports = {
    async up() {
        const now = new Date();
        for (const def of KEY_SCRAPS) {
            const existing = await db.KeyScrap.findOne({ where: { key_name: def.key_name } });
            if (existing) continue;

            const raw = process.env[def.key_name];
            await db.KeyScrap.create({
                key_name: def.key_name,
                key_value: raw == null ? '' : String(raw),
                provider: def.provider,
                is_secret: def.is_secret ? 1 : 0,
                created_at: now,
                updated_at: now,
            });
        }
    },

    async down() {
        await db.KeyScrap.destroy({
            where: { key_name: KEY_SCRAPS.map((r) => r.key_name) },
        });
    },
};
