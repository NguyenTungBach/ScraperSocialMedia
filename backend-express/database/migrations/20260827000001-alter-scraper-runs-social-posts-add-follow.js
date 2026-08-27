'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('scraper_runs', 'follow', {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
            after: 'angry_count',
        });

        await queryInterface.addColumn('social_posts', 'follow', {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
            after: 'shares',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('social_posts', 'follow');
        await queryInterface.removeColumn('scraper_runs', 'follow');
    },
};
