'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('scraper_runs', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
            },
            source: {
                type: Sequelize.STRING(255),
                allowNull: false,
                defaultValue: 'apify',
            },
            external_run_id: {
                type: Sequelize.STRING(255),
                allowNull: false,
            },
            scraper_id: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            platform: {
                type: Sequelize.STRING(255),
                allowNull: false,
                defaultValue: 'facebook',
            },
            subject_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: true,
                references: { model: 'subjects', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
            },
            status: {
                type: Sequelize.STRING(255),
                allowNull: false,
                defaultValue: 'RUNNING',
            },
            input: {
                type: Sequelize.JSON,
                allowNull: true,
            },
            items_count: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            started_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            finished_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            error_message: {
                type: Sequelize.TEXT,
                allowNull: true,
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

        await queryInterface.addIndex('scraper_runs', ['subject_id']);
        await queryInterface.addIndex(
            'scraper_runs',
            ['source', 'external_run_id'],
            { unique: true, name: 'scraper_runs_source_external_run_id_unique' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('scraper_runs');
    },
};
