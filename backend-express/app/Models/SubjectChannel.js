'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class SubjectChannel extends Model {
        static associate(models) {
            SubjectChannel.belongsTo(models.Subject, {
                foreignKey: 'subject_id',
                as: 'subject',
            });
            SubjectChannel.belongsTo(models.Channel, {
                foreignKey: 'channel_id',
                as: 'channel',
            });
        }
    }

    SubjectChannel.init(
        {
            id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
            subject_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
            channel_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        },
        {
            sequelize,
            modelName: 'SubjectChannel',
            tableName: 'subject_channels',
            timestamps: true,
            underscored: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [{ unique: true, fields: ['subject_id', 'channel_id'] }],
        }
    );

    return SubjectChannel;
};
