'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('async_status_jobs', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
            },
            job_type: {
                type: Sequelize.STRING(64),
                allowNull: false,
            },
            scope_key: {
                type: Sequelize.STRING(255),
                allowNull: false,
            },
            status: {
                type: Sequelize.STRING(32),
                allowNull: false,
                defaultValue: 'pending',
            },
            queue_job_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: true,
            },
            attempts: {
                type: Sequelize.TINYINT.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            error_message: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            requested_by_user_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: true,
            },
            payload_json: {
                type: Sequelize.JSON,
                allowNull: true,
            },
            result_json: {
                type: Sequelize.JSON,
                allowNull: true,
            },
            started_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            finished_at: {
                type: Sequelize.DATE,
                allowNull: true,
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

        await queryInterface.addIndex('async_status_jobs', ['job_type', 'scope_key', 'status'], {
            name: 'async_status_jobs_type_scope_status_index',
        });
        await queryInterface.addIndex('async_status_jobs', ['queue_job_id'], {
            name: 'async_status_jobs_queue_job_id_index',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('async_status_jobs');
    },
};
