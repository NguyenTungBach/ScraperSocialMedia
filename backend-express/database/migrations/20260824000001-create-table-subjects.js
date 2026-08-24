'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('subjects', {
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
            normalized_name: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            item_type: {
                type: Sequelize.STRING(255),
                allowNull: false,
                defaultValue: 'person',
            },
            status: {
                type: Sequelize.STRING(255),
                allowNull: false,
                defaultValue: 'active',
            },
            source: {
                type: Sequelize.STRING(255),
                allowNull: false,
                defaultValue: 'manual',
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

        await queryInterface.addIndex('subjects', ['normalized_name']);
        await queryInterface.addIndex('subjects', ['status']);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('subjects');
    },
};
