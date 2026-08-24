'use strict';

const { Model } = require('sequelize');

/**
 * Failed queue jobs (Laravel-style failed_jobs).
 */
module.exports = (sequelize, DataTypes) => {
    class FailedJob extends Model {}

    FailedJob.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true
            },
            uuid: {
                type: DataTypes.STRING(255),
                allowNull: false,
                unique: true
            },
            connection: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            queue: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            payload: {
                type: DataTypes.TEXT('long'),
                allowNull: false
            },
            exception: {
                type: DataTypes.TEXT('long'),
                allowNull: false
            },
            failed_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            }
        },
        {
            sequelize,
            modelName: 'FailedJob',
            tableName: 'failed_jobs',
            timestamps: false,
            underscored: true
        }
    );

    return FailedJob;
};
