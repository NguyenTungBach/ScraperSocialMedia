'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('scraper_runs', 'content_brief', {
            type: Sequelize.TEXT,
            allowNull: true,
        });
        await queryInterface.addColumn('scraper_runs', 'content_brief_status', {
            type: Sequelize.ENUM('not_start', 'pending', 'done', 'skipped'),
            allowNull: false,
            defaultValue: 'not_start',
        });
        await queryInterface.addColumn('scraper_runs', 'content_brief_at', {
            type: Sequelize.DATE,
            allowNull: true,
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('scraper_runs', 'content_brief_at');
        await queryInterface.removeColumn('scraper_runs', 'content_brief_status');
        await queryInterface.removeColumn('scraper_runs', 'content_brief');
    },
};
