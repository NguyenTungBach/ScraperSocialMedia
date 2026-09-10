'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Subject extends Model {
        static associate(models) {
            Subject.belongsToMany(models.Channel, {
                through: models.SubjectChannel,
                foreignKey: 'subject_id',
                otherKey: 'channel_id',
                as: 'channels',
            });
            Subject.hasMany(models.SubjectChannel, {
                foreignKey: 'subject_id',
                as: 'subjectChannels',
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
            source: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'gemini' },
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
