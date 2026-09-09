'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        const sequelize = queryInterface.sequelize;
        const dialect = sequelize.getDialect();

        if (dialect === 'postgres') {
            await sequelize.query(`
                ALTER TABLE scraper_runs
                DROP CONSTRAINT IF EXISTS scraper_runs_channel_id_fkey;
            `);
            await sequelize.query(`
                ALTER TABLE scraper_runs
                ADD CONSTRAINT scraper_runs_channel_id_fkey
                FOREIGN KEY (channel_id) REFERENCES channels(id)
                ON UPDATE CASCADE ON DELETE CASCADE;
            `);
            return;
        }

        const [rows] = await sequelize.query(`
            SELECT CONSTRAINT_NAME AS name
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'scraper_runs'
              AND COLUMN_NAME = 'channel_id'
              AND REFERENCED_TABLE_NAME IS NOT NULL
            LIMIT 1
        `);
        const fkName = rows[0]?.name;
        if (fkName) {
            await sequelize.query(`ALTER TABLE scraper_runs DROP FOREIGN KEY \`${fkName}\``);
        }
        await sequelize.query(`
            ALTER TABLE scraper_runs
            ADD CONSTRAINT scraper_runs_channel_id_fkey
            FOREIGN KEY (channel_id) REFERENCES channels(id)
            ON UPDATE CASCADE ON DELETE CASCADE
        `);
    },

    async down(queryInterface) {
        const sequelize = queryInterface.sequelize;
        const dialect = sequelize.getDialect();

        if (dialect === 'postgres') {
            await sequelize.query(`
                ALTER TABLE scraper_runs
                DROP CONSTRAINT IF EXISTS scraper_runs_channel_id_fkey;
            `);
            await sequelize.query(`
                ALTER TABLE scraper_runs
                ADD CONSTRAINT scraper_runs_channel_id_fkey
                FOREIGN KEY (channel_id) REFERENCES channels(id)
                ON UPDATE CASCADE ON DELETE SET NULL;
            `);
            return;
        }

        await sequelize.query(`
            ALTER TABLE scraper_runs
            DROP FOREIGN KEY scraper_runs_channel_id_fkey
        `).catch(() => null);
        await sequelize.query(`
            ALTER TABLE scraper_runs
            ADD CONSTRAINT scraper_runs_channel_id_fkey
            FOREIGN KEY (channel_id) REFERENCES channels(id)
            ON UPDATE CASCADE ON DELETE SET NULL
        `);
    },
};
