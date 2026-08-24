'use strict';

/**
 * Bảng `jobs` — Sequelize queryInterface (MySQL + Postgres).
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('jobs', {
            id: {
                type: Sequelize.BIGINT,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true
            },
            queue: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            payload: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            attempts: {
                type: Sequelize.SMALLINT,
                allowNull: false
            },
            reserved_at: {
                type: Sequelize.INTEGER,
                allowNull: true
            },
            available_at: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            created_at: {
                type: Sequelize.INTEGER,
                allowNull: false
            }
        });

        await queryInterface.addIndex('jobs', ['queue'], {
            name: 'jobs_queue_index'
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('jobs');
    }
};
