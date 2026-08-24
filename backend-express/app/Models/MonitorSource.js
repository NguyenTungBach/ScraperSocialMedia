'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class MonitorSource extends Model {
        static associate(models) {
            MonitorSource.belongsTo(models.Subject, {
                foreignKey: 'subject_id',
                as: 'subject',
            });
            MonitorSource.hasMany(models.SocialPost, {
                foreignKey: 'monitor_source_id',
                as: 'posts',
            });
        }
    }

    MonitorSource.init(
        {
            id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
            subject_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
            platform: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'facebook' },
            source_type: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'page' },
            source_url: { type: DataTypes.STRING(255), allowNull: false },
            display_name: { type: DataTypes.STRING(255), allowNull: true },
            priority: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 1 },
            is_active: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
        },
        {
            sequelize,
            modelName: 'MonitorSource',
            tableName: 'monitor_sources',
            timestamps: true,
            underscored: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        }
    );

    return MonitorSource;
};
