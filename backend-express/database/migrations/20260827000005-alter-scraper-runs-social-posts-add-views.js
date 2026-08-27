'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('scraper_runs', 'views', {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
            after: 'follow',
        });

        await queryInterface.addColumn('social_posts', 'views', {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
            after: 'follow',
        });

        // Backfill YouTube views từ raw_data (MySQL JSON).
        await queryInterface.sequelize.query(`
            UPDATE scraper_runs
            SET views = CAST(
                COALESCE(
                    JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.statistics.viewCount')),
                    JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.viewCount')),
                    '0'
                ) AS UNSIGNED
            )
            WHERE platform = 'youtube'
              AND (
                JSON_EXTRACT(raw_data, '$.statistics.viewCount') IS NOT NULL
                OR JSON_EXTRACT(raw_data, '$.viewCount') IS NOT NULL
              )
        `);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('social_posts', 'views');
        await queryInterface.removeColumn('scraper_runs', 'views');
    },
};
