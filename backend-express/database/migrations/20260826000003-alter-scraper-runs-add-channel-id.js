'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('scraper_runs', 'channel_id', {
            type: Sequelize.BIGINT.UNSIGNED,
            allowNull: true,
            references: { model: 'channels', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        });

        await queryInterface.addIndex('scraper_runs', ['channel_id']);
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('scraper_runs', ['channel_id']);
        await queryInterface.removeColumn('scraper_runs', 'channel_id');
    },
};
