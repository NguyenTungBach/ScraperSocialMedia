'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class PostDailySnapshot extends Model {
        static associate(models) {
            PostDailySnapshot.belongsTo(models.ScraperRun, {
                foreignKey: 'scraper_run_id',
                as: 'scraperRun',
            });
            PostDailySnapshot.belongsTo(models.Channel, {
                foreignKey: 'channel_id',
                as: 'channel',
            });
        }
    }

    PostDailySnapshot.init(
        {
            id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
            scraper_run_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
            channel_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
            snapshot_date: { type: DataTypes.DATEONLY, allowNull: false },
            platform: { type: DataTypes.STRING(50), allowNull: false },
            views: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
            likes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            comments: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            shares: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            angry_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            hot_score: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
            trend_score: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
            captured_at: { type: DataTypes.DATE, allowNull: false },
        },
        {
            sequelize,
            modelName: 'PostDailySnapshot',
            tableName: 'post_daily_snapshots',
            timestamps: true,
            underscored: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [{ unique: true, fields: ['scraper_run_id', 'snapshot_date'] }],
        }
    );

    return PostDailySnapshot;
};
