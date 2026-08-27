'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class CommentThread extends Model {
        static associate(models) {
            CommentThread.belongsTo(models.ScraperRun, {
                foreignKey: 'scraper_run_id',
                as: 'scraperRun',
            });
            CommentThread.belongsTo(models.PostComment, {
                foreignKey: 'root_comment_id',
                as: 'rootComment',
            });
        }
    }

    CommentThread.init(
        {
            id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
            scraper_run_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
            thread_key: { type: DataTypes.STRING(64), allowNull: false },
            root_comment_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
            comment_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            classified_as: {
                type: DataTypes.ENUM('negative', 'debate', 'unknown'),
                allowNull: true,
            },
            has_negativity: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
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
            analyzed_at: { type: DataTypes.DATE, allowNull: true },
        },
        {
            sequelize,
            modelName: 'CommentThread',
            tableName: 'comment_threads',
            timestamps: true,
            underscored: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        }
    );

    return CommentThread;
};
