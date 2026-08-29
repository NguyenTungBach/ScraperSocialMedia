'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('channels', 'followers', {
            type: Sequelize.BIGINT.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
        });
        await queryInterface.addColumn('channels', 'video_count', {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
        });
        await queryInterface.addColumn('channels', 'raw_data', {
            type: Sequelize.JSON,
            allowNull: true,
            defaultValue: null,
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('channels', 'raw_data');
        await queryInterface.removeColumn('channels', 'video_count');
        await queryInterface.removeColumn('channels', 'followers');
    },
};
