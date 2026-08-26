'use strict';

/**
 * Seed subject mẫu + map subject_channels với channel_id 1, 2, 3.
 * Chạy sau channels-seeder.
 */
const db = require('../../app/Models');

const SAMPLE_SUBJECT = {
    name: 'Sample Subject',
    normalized_name: 'sample subject',
    item_type: 'person',
    status: 'active',
    source: 'manual',
};

const CHANNEL_IDS = [1, 2, 3];

module.exports = {
    async up() {
        let subject = await db.Subject.findOne({
            where: { name: SAMPLE_SUBJECT.name, source: 'manual' },
        });
        if (!subject) {
            subject = await db.Subject.create(SAMPLE_SUBJECT);
        }

        for (const channel_id of CHANNEL_IDS) {
            const channel = await db.Channel.findByPk(channel_id);
            if (!channel) continue;

            const existing = await db.SubjectChannel.findOne({
                where: {
                    subject_id: subject.id,
                    channel_id,
                },
            });
            if (!existing) {
                await db.SubjectChannel.create({
                    subject_id: subject.id,
                    channel_id,
                });
            }
        }
    },

    async down() {
        const subject = await db.Subject.findOne({
            where: { name: SAMPLE_SUBJECT.name, source: 'manual' },
        });
        if (!subject) return;

        await db.SubjectChannel.destroy({
            where: {
                subject_id: subject.id,
                channel_id: CHANNEL_IDS,
            },
        });
    },
};
