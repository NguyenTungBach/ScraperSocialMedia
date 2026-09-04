'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('key_scraps', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
            },
            key_name: {
                type: Sequelize.STRING(128),
                allowNull: false,
            },
            key_value: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            provider: {
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

        await queryInterface.addIndex('key_scraps', ['key_name'], {
            unique: true,
            name: 'key_scraps_key_name_unique',
        });
        await queryInterface.addIndex('key_scraps', ['provider'], {
            name: 'key_scraps_provider_index',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('key_scraps');
    },
};
