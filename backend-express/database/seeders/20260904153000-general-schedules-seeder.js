'use strict';

/**
 * Seed lịch mặc định (theo crontab production).
 * findOrCreate theo command — không ghi đè nếu đã có.
 */
require('dotenv').config();
const db = require('../../app/Models');

const DEFAULT_SCHEDULES = [
    {
        name: 'Metric snapshot',
        cron_expression: '0 */5 * * *',
        command: 'npm run app:metric-snapshot',
    },
    {
        name: 'Báo vượt ngưỡng',
        cron_expression: '0 17 * * *',
        command: 'npm run app:alert-gmail',
    },
    {
        name: 'Facebook scrape',
        cron_expression: '0 5 * * *',
        command: 'npm run app:facebook-scrape',
    },
    {
        name: 'TikTok scrape',
        cron_expression: '0 5 * * *',
        command: 'npm run app:tiktok-scrape',
    },
    {
        name: 'YouTube scrape',
        cron_expression: '0 5 * * *',
        command: 'npm run app:youtube-scrape',
    },
    {
        name: 'YouTube refresh tail',
        cron_expression: '0 3 */2 * *',
        command: 'npm run app:youtube-refresh-tail',
    },
];

module.exports = {
    async up() {
        const now = new Date();
        for (const row of DEFAULT_SCHEDULES) {
            const existing = await db.GeneralSchedule.findOne({
                where: { command: row.command },
            });
            if (existing) continue;

            await db.GeneralSchedule.create({
                name: row.name,
                cron_expression: row.cron_expression,
                command: row.command,
                enabled: true,
                last_status: 'idle',
                created_at: now,
                updated_at: now,
            });
        }
    },

    async down() {
        await db.GeneralSchedule.destroy({
            where: {
                command: DEFAULT_SCHEDULES.map((r) => r.command),
            },
        });
    },
};
