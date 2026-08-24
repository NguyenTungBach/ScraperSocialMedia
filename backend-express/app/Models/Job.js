'use strict';

const { Model } = require('sequelize');

/**
 * Queue jobs table (Laravel-style database driver).
 */
module.exports = (sequelize, DataTypes) => {
    class Job extends Model {}

    Job.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true
            },
            queue: {
                type: DataTypes.STRING(255),
                allowNull: false
            },
            payload: {
                type: DataTypes.TEXT('long'),
                allowNull: false
            },
            attempts: {
                type: DataTypes.TINYINT.UNSIGNED,
                allowNull: false,
                defaultValue: 0
            },
            reserved_at: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: true
            },
            available_at: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false
            },
            created_at: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false
            }
        },
        {
            sequelize,
            modelName: 'Job',
            tableName: 'jobs',
            timestamps: false,
            underscored: true
        }
    );

    return Job;
};
