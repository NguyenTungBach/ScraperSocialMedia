'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('comment_threads', {
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
            thread_key: {
                type: Sequelize.STRING(64),
                allowNull: false,
            },
            root_comment_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: true,
                references: { model: 'post_comments', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
            },
            comment_count: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            classified_as: {
                type: Sequelize.ENUM('negative', 'debate', 'unknown'),
                allowNull: true,
            },
            has_negativity: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
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
            analyzed_at: {
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

        await queryInterface.addIndex('comment_threads', ['scraper_run_id', 'thread_key'], {
            unique: true,
            name: 'comment_threads_run_thread_key_unique',
        });
        await queryInterface.addIndex('comment_threads', ['scraper_run_id', 'classified_as'], {
            name: 'comment_threads_run_classified',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('comment_threads');
    },
};
