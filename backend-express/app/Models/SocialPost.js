'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class SocialPost extends Model {
        static associate(models) {
            SocialPost.belongsTo(models.ScraperRun, {
                foreignKey: 'scraper_run_id',
                as: 'scraperRun',
            });
            SocialPost.belongsTo(models.Subject, {
                foreignKey: 'subject_id',
                as: 'subject',
            });
            SocialPost.belongsTo(models.MonitorSource, {
                foreignKey: 'monitor_source_id',
                as: 'monitorSource',
            });
        }
    }

    SocialPost.init(
        {
            id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
            platform: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'facebook' },
            scraper_run_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
            subject_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
            monitor_source_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
            platform_post_id: { type: DataTypes.STRING(255), allowNull: false },
            post_url: { type: DataTypes.STRING(255), allowNull: true },
            text: { type: DataTypes.TEXT, allowNull: true },
            posted_at: { type: DataTypes.DATE, allowNull: true },
            likes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            comments: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            shares: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            angry_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            trend_score: { type: DataTypes.DECIMAL(65, 30), allowNull: false, defaultValue: 0 },
            hot_score: { type: DataTypes.DECIMAL(65, 30), allowNull: false, defaultValue: 0 },
            sentiment: { type: DataTypes.STRING(255), allowNull: true },
            topics_json: { type: DataTypes.JSON, allowNull: true },
            raw_data: { type: DataTypes.JSON, allowNull: false },
            scraped_at: { type: DataTypes.DATE, allowNull: true },
        },
        {
            sequelize,
            modelName: 'SocialPost',
            tableName: 'social_posts',
            timestamps: true,
            underscored: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                { fields: ['scraper_run_id'] },
                { fields: ['subject_id'] },
                { fields: ['posted_at'] },
                { unique: true, fields: ['platform', 'platform_post_id'] },
            ],
        }
    );

    return SocialPost;
};
