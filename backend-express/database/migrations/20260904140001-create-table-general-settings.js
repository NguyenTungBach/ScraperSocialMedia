'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('general_settings', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
            },
            setting_key: {
                type: Sequelize.STRING(128),
                allowNull: false,
            },
            setting_value: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            group: {
                type: Sequelize.STRING(32),
                allowNull: false,
            },
            is_secret: {
                type: Sequelize.TINYINT(1),
                allowNull: false,
                defaultValue: 0,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        await queryInterface.addIndex('general_settings', ['setting_key'], {
            unique: true,
            name: 'general_settings_setting_key_unique',
        });
        await queryInterface.addIndex('general_settings', ['group'], {
            name: 'general_settings_group_index',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('general_settings');
    },
};
