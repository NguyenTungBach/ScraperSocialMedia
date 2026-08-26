'use strict';

/**
 * Seed channels mẫu (Facebook).
 * Idempotent theo (type_channel, url).
 */
const db = require('../../app/Models');

const SAMPLE_CHANNELS = [
    {
        name: 'Facebook',
        url: 'https://www.facebook.com',
        type_channel: 'facebook',
    },
    {
        name: 'Theanh28',
        url: 'https://www.facebook.com/Theanh28',
        type_channel: 'facebook',
    },
    {
        name: 'Tin tức VTV24',
        url: 'https://www.facebook.com/tintucvtv24',
        type_channel: 'facebook',
    },
];

module.exports = {
    async up() {
        for (const row of SAMPLE_CHANNELS) {
            const existing = await db.Channel.findOne({
                where: {
                    type_channel: row.type_channel,
                    url: row.url,
                },
            });
            if (!existing) {
                await db.Channel.create(row);
            }
        }
    },

    async down() {
        for (const row of SAMPLE_CHANNELS) {
            await db.Channel.destroy({
                where: {
                    type_channel: row.type_channel,
                    url: row.url,
                },
            });
        }
    },
};
