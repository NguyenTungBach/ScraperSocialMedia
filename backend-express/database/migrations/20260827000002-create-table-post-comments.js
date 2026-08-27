'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('post_comments', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
            },
            scraper_run_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                references: { model: 'scraper_runs', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            platform_comment_id: {
                type: Sequelize.STRING(64),
                allowNull: false,
            },
            parent_platform_comment_id: {
                type: Sequelize.STRING(64),
                allowNull: true,
            },
            thread_key: {
                type: Sequelize.STRING(64),
                allowNull: false,
            },
            author: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            text: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            like_count: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            published_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            sort_order: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            group_type: {
                type: Sequelize.ENUM('lone', 'thread'),
                allowNull: false,
                defaultValue: 'lone',
            },
            classified_as: {
                type: Sequelize.ENUM('negative', 'normal', 'unknown'),
                allowNull: true,
            },
            sentiment: {
                type: Sequelize.ENUM('positive', 'neutral', 'negative', 'unknown'),
                allowNull: true,
            },
            category: {
                type: Sequelize.ENUM(
                    'opinion',
                    'attack',
                    'provoke',
                    'debate',
                    'argument',
                    'normal',
                    'other',
                    'unknown'
                ),
                allowNull: true,
            },
            severity: {
                type: Sequelize.ENUM('low', 'medium', 'high', 'unknown'),
                allowNull: true,
            },
            reason: {
                type: Sequelize.STRING(500),
                allowNull: true,
            },
            analysis_status: {
                type: Sequelize.ENUM('pending', 'done', 'skipped'),
                allowNull: false,
                defaultValue: 'pending',
            },
            raw_data: {
                type: Sequelize.JSON,
                allowNull: true,
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

        await queryInterface.addIndex('post_comments', ['scraper_run_id', 'platform_comment_id'], {
            unique: true,
            name: 'post_comments_run_platform_comment_unique',
        });
        await queryInterface.addIndex('post_comments', ['scraper_run_id', 'thread_key', 'sort_order'], {
            name: 'post_comments_run_thread_sort',
        });
        await queryInterface.addIndex('post_comments', ['scraper_run_id', 'group_type', 'classified_as'], {
            name: 'post_comments_run_group_classified',
        });
        await queryInterface.addIndex('post_comments', ['parent_platform_comment_id'], {
            name: 'post_comments_parent_platform_comment_id',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('post_comments');
    },
};
