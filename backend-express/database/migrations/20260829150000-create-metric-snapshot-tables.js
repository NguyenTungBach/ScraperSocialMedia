'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('channel_daily_snapshots', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
            },
            channel_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                references: { model: 'channels', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            snapshot_date: {
                type: Sequelize.DATEONLY,
                allowNull: false,
            },
            platform: {
                type: Sequelize.STRING(50),
                allowNull: false,
            },
            followers: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            post_count_channel: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            post_count_tracked: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            views_sum: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            likes_sum: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            comments_sum: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            shares_sum: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            angry_sum: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            captured_at: {
                type: Sequelize.DATE,
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

        await queryInterface.addIndex(
            'channel_daily_snapshots',
            ['channel_id', 'snapshot_date'],
            {
                unique: true,
                name: 'channel_daily_snapshots_channel_date_unique',
            }
        );
        await queryInterface.addIndex('channel_daily_snapshots', ['snapshot_date'], {
            name: 'channel_daily_snapshots_snapshot_date',
        });
        await queryInterface.addIndex(
            'channel_daily_snapshots',
            ['platform', 'snapshot_date'],
            { name: 'channel_daily_snapshots_platform_date' }
        );

        await queryInterface.createTable('post_daily_snapshots', {
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
            channel_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                references: { model: 'channels', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            snapshot_date: {
                type: Sequelize.DATEONLY,
                allowNull: false,
            },
            platform: {
                type: Sequelize.STRING(50),
                allowNull: false,
            },
            views: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
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
            hot_score: {
                type: Sequelize.DECIMAL(14, 2),
                allowNull: false,
                defaultValue: 0,
            },
            trend_score: {
                type: Sequelize.DECIMAL(14, 2),
                allowNull: false,
                defaultValue: 0,
            },
            captured_at: {
                type: Sequelize.DATE,
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

        await queryInterface.addIndex(
            'post_daily_snapshots',
            ['scraper_run_id', 'snapshot_date'],
            {
                unique: true,
                name: 'post_daily_snapshots_run_date_unique',
            }
        );
        await queryInterface.addIndex(
            'post_daily_snapshots',
            ['channel_id', 'snapshot_date'],
            { name: 'post_daily_snapshots_channel_date' }
        );
        await queryInterface.addIndex('post_daily_snapshots', ['snapshot_date'], {
            name: 'post_daily_snapshots_snapshot_date',
        });

        await queryInterface.createTable('post_top_comments_daily', {
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
            snapshot_date: {
                type: Sequelize.DATEONLY,
                allowNull: false,
            },
            rank: {
                type: Sequelize.TINYINT.UNSIGNED,
                allowNull: false,
            },
            post_comment_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: true,
                references: { model: 'post_comments', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
            },
            platform_comment_id: {
                type: Sequelize.STRING(64),
                allowNull: false,
            },
            author: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            text: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            like_count: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            captured_at: {
                type: Sequelize.DATE,
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

        await queryInterface.addIndex(
            'post_top_comments_daily',
            ['scraper_run_id', 'snapshot_date', 'rank'],
            {
                unique: true,
                name: 'post_top_comments_daily_run_date_rank_unique',
            }
        );
        await queryInterface.addIndex(
            'post_top_comments_daily',
            ['scraper_run_id', 'snapshot_date'],
            { name: 'post_top_comments_daily_run_date' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('post_top_comments_daily');
        await queryInterface.dropTable('post_daily_snapshots');
        await queryInterface.dropTable('channel_daily_snapshots');
    },
};
