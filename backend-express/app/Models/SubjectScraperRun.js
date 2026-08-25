'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class SubjectScraperRun extends Model {
        static associate(models) {
            SubjectScraperRun.belongsTo(models.Subject, {
                foreignKey: 'subject_id',
                as: 'subject',
            });
            SubjectScraperRun.belongsTo(models.ScraperRun, {
                foreignKey: 'scraper_run_id',
                as: 'scraperRun',
            });
        }
    }

    SubjectScraperRun.init(
        {
            id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
            subject_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
            scraper_run_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        },
        {
            sequelize,
            modelName: 'SubjectScraperRun',
            tableName: 'subjects_scraper_runs',
            timestamps: true,
            underscored: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                { unique: true, fields: ['subject_id', 'scraper_run_id'] },
            ],
        }
    );

    return SubjectScraperRun;
};
