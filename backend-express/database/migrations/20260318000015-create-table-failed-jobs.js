'use strict';

/**
 * Bảng `failed_jobs` — Sequelize queryInterface (MySQL + Postgres).
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('failed_jobs', {
            id: {
                type: Sequelize.BIGINT,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true
            },
            uuid: {
                type: Sequelize.STRING(255),
                allowNull: false,
                unique: true
            },
            connection: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            queue: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            payload: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            exception: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            failed_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('failed_jobs');
    }
};
