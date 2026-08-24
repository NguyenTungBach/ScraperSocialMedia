'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ScraperRun extends Model {
        static associate(models) {
            ScraperRun.belongsTo(models.Subject, {
                foreignKey: 'subject_id',
                as: 'subject',
            });
            ScraperRun.hasMany(models.SocialPost, {
                foreignKey: 'scraper_run_id',
                as: 'posts',
            });
        }
    }

    ScraperRun.init(
        {
            id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
            source: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'apify' },
            external_run_id: { type: DataTypes.STRING(255), allowNull: false },
            scraper_id: { type: DataTypes.STRING(255), allowNull: true },
            platform: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'facebook' },
            subject_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
            status: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'RUNNING' },
            input: { type: DataTypes.JSON, allowNull: true },
            items_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            started_at: { type: DataTypes.DATE, allowNull: true },
            finished_at: { type: DataTypes.DATE, allowNull: true },
            error_message: { type: DataTypes.TEXT, allowNull: true },
        },
        {
            sequelize,
            modelName: 'ScraperRun',
            tableName: 'scraper_runs',
            timestamps: true,
            underscored: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                { unique: true, fields: ['source', 'external_run_id'] },
            ],
        }
    );

    return ScraperRun;
};
