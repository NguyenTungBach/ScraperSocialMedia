'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('general_schedules', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
            },
            name: {
                type: Sequelize.STRING(191),
                allowNull: false,
            },
            cron_expression: {
                type: Sequelize.STRING(64),
                allowNull: false,
            },
            command: {
                type: Sequelize.STRING(255),
                allowNull: false,
            },
            enabled: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            last_run_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            last_finished_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            last_status: {
                type: Sequelize.STRING(32),
                allowNull: false,
                defaultValue: 'idle',
            },
            last_error: {
                type: Sequelize.TEXT,
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

        await queryInterface.addIndex('general_schedules', ['enabled'], {
            name: 'general_schedules_enabled_index',
        });
        await queryInterface.addIndex('general_schedules', ['command'], {
            name: 'general_schedules_command_index',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('general_schedules');
    },
};
