'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Channel extends Model {
        static associate(models) {
            Channel.belongsToMany(models.Subject, {
                through: models.SubjectChannel,
                foreignKey: 'channel_id',
                otherKey: 'subject_id',
                as: 'subjects',
            });
            Channel.hasMany(models.SubjectChannel, {
                foreignKey: 'channel_id',
                as: 'subjectChannels',
            });
            Channel.hasMany(models.ScraperRun, {
                foreignKey: 'channel_id',
                as: 'scraperRuns',
            });
        }
    }

    Channel.init(
        {
            id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
            name: { type: DataTypes.STRING(255), allowNull: false },
            url: { type: DataTypes.STRING(512), allowNull: false },
            type_channel: {
                type: DataTypes.STRING(50),
                allowNull: false,
                defaultValue: 'facebook',
            },
        },
        {
            sequelize,
            modelName: 'Channel',
            tableName: 'channels',
            timestamps: true,
            underscored: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        }
    );

    return Channel;
};
