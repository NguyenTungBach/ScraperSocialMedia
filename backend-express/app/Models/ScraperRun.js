'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ScraperRun extends Model {
        static associate(models) {
            ScraperRun.belongsToMany(models.Subject, {
                through: models.SubjectScraperRun,
                foreignKey: 'scraper_run_id',
                otherKey: 'subject_id',
                as: 'subjects',
            });
            ScraperRun.hasMany(models.SubjectScraperRun, {
                foreignKey: 'scraper_run_id',
                as: 'subjectScraperRuns',
            });
        }
    }

    ScraperRun.init(
        {
            id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
            platform: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'facebook' },
            platform_post_id: { type: DataTypes.STRING(255), allowNull: false },
            post_url: { type: DataTypes.STRING(255), allowNull: true },
            title: { type: DataTypes.STRING(255), allowNull: true },
            text: { type: DataTypes.TEXT, allowNull: true },
            likes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            comments: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            shares: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            angry_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            posted_at: { type: DataTypes.DATE, allowNull: true },
            scraped_at: { type: DataTypes.DATE, allowNull: true },
            source: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'apify' },
            external_run_id: { type: DataTypes.STRING(255), allowNull: true },
            scraper_id: { type: DataTypes.STRING(255), allowNull: true },
            raw_data: { type: DataTypes.JSON, allowNull: false },
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
                { unique: true, fields: ['platform', 'platform_post_id'] },
            ],
        }
    );

    return ScraperRun;
};
