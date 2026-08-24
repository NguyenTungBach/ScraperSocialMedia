'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('social_posts', {
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
            scraper_run_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                references: { model: 'scraper_runs', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            subject_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: true,
                references: { model: 'subjects', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
            },
            monitor_source_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: true,
                references: { model: 'monitor_sources', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
            },
            platform_post_id: {
                type: Sequelize.STRING(255),
                allowNull: false,
            },
            post_url: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            text: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            posted_at: {
                type: Sequelize.DATE,
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
            trend_score: {
                type: Sequelize.DECIMAL(65, 30),
                allowNull: false,
                defaultValue: 0,
            },
            hot_score: {
                type: Sequelize.DECIMAL(65, 30),
                allowNull: false,
                defaultValue: 0,
            },
            sentiment: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            topics_json: {
                type: Sequelize.JSON,
                allowNull: true,
            },
            raw_data: {
                type: Sequelize.JSON,
                allowNull: false,
            },
            scraped_at: {
                type: Sequelize.DATE,
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

        await queryInterface.addIndex('social_posts', ['scraper_run_id']);
        await queryInterface.addIndex('social_posts', ['subject_id']);
        await queryInterface.addIndex('social_posts', ['monitor_source_id']);
        await queryInterface.addIndex('social_posts', ['posted_at']);
        await queryInterface.addIndex(
            'social_posts',
            ['platform', 'platform_post_id'],
            { unique: true, name: 'social_posts_platform_post_id_unique' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('social_posts');
    },
};
