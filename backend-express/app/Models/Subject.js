'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Subject extends Model {
        static associate(models) {
            Subject.hasMany(models.MonitorSource, {
                foreignKey: 'subject_id',
                as: 'monitorSources',
            });
            Subject.hasMany(models.ScraperRun, {
                foreignKey: 'subject_id',
                as: 'scraperRuns',
            });
            Subject.hasMany(models.SocialPost, {
                foreignKey: 'subject_id',
                as: 'posts',
            });
        }
    }

    Subject.init(
        {
            id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
            name: { type: DataTypes.STRING(255), allowNull: false },
            normalized_name: { type: DataTypes.STRING(255), allowNull: true },
            item_type: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'person' },
            status: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'active' },
            source: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'manual' },
        },
        {
            sequelize,
            modelName: 'Subject',
            tableName: 'subjects',
            timestamps: true,
            underscored: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        }
    );

    return Subject;
};
