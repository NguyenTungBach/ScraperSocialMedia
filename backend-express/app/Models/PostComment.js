'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class PostComment extends Model {
        static associate(models) {
            PostComment.belongsTo(models.ScraperRun, {
                foreignKey: 'scraper_run_id',
                as: 'scraperRun',
            });
        }
    }

    PostComment.init(
        {
            id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
            scraper_run_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
            platform_comment_id: { type: DataTypes.STRING(64), allowNull: false },
            parent_platform_comment_id: { type: DataTypes.STRING(64), allowNull: true },
            thread_key: { type: DataTypes.STRING(64), allowNull: false },
            author: { type: DataTypes.STRING(255), allowNull: true },
            text: { type: DataTypes.TEXT, allowNull: false },
            like_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            published_at: { type: DataTypes.DATE, allowNull: true },
            sort_order: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            group_type: {
                type: DataTypes.ENUM('lone', 'thread'),
                allowNull: false,
                defaultValue: 'lone',
            },
            classified_as: {
                type: DataTypes.ENUM('negative', 'normal', 'unknown'),
                allowNull: true,
            },
            sentiment: {
                type: DataTypes.ENUM('positive', 'neutral', 'negative', 'unknown'),
                allowNull: true,
            },
            category: {
                type: DataTypes.ENUM(
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
                type: DataTypes.ENUM('low', 'medium', 'high', 'unknown'),
                allowNull: true,
            },
            reason: { type: DataTypes.STRING(500), allowNull: true },
            analysis_status: {
                type: DataTypes.ENUM('pending', 'done', 'skipped'),
                allowNull: false,
                defaultValue: 'pending',
            },
            raw_data: { type: DataTypes.JSON, allowNull: true },
            scraped_at: { type: DataTypes.DATE, allowNull: true },
        },
        {
            sequelize,
            modelName: 'PostComment',
            tableName: 'post_comments',
            timestamps: true,
            underscored: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        }
    );

    return PostComment;
};
