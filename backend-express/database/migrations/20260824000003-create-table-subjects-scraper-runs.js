'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('subjects_scraper_runs', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
            },
            subject_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                references: { model: 'subjects', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            scraper_run_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                references: { model: 'scraper_runs', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
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

        await queryInterface.addIndex('subjects_scraper_runs', ['subject_id']);
        await queryInterface.addIndex('subjects_scraper_runs', ['scraper_run_id']);
        await queryInterface.addIndex(
            'subjects_scraper_runs',
            ['subject_id', 'scraper_run_id'],
            { unique: true, name: 'subjects_scraper_runs_subject_run_unique' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('subjects_scraper_runs');
    },
};
