'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('channels', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
            },
            name: {
                type: Sequelize.STRING(255),
                allowNull: false,
            },
            url: {
                type: Sequelize.STRING(512),
                allowNull: false,
            },
            type_channel: {
                type: Sequelize.STRING(50),
                allowNull: false,
                defaultValue: 'facebook',
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
        });

        await queryInterface.addIndex('channels', ['type_channel', 'url'], {
            unique: true,
            name: 'channels_type_url_unique',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('channels');
    },
};
