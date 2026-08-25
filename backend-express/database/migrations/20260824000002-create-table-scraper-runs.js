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
            platform: {
                type: Sequelize.STRING(255),
                allowNull: false,
                defaultValue: 'facebook',
            },
            platform_post_id: {
                type: Sequelize.STRING(255),
                allowNull: false,
            },
            post_url: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            title: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            text: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            likes: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            comments: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            shares: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            angry_count: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            posted_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            scraped_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            source: {
                type: Sequelize.STRING(255),
                allowNull: false,
                defaultValue: 'apify',
            },
            external_run_id: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            scraper_id: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            raw_data: {
                type: Sequelize.JSON,
                allowNull: false,
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

        await queryInterface.addIndex('scraper_runs', ['posted_at']);
        await queryInterface.addIndex('scraper_runs', ['external_run_id']);
        await queryInterface.addIndex(
            'scraper_runs',
            ['platform', 'platform_post_id'],
            { unique: true, name: 'scraper_runs_platform_post_id_unique' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('scraper_runs');
    },
};
