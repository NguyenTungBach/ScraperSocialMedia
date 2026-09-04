'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class AsyncStatusJob extends Model {
        static associate() {}
    }

    AsyncStatusJob.init(
        {
            id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
            job_type: { type: DataTypes.STRING(64), allowNull: false },
            scope_key: { type: DataTypes.STRING(255), allowNull: false },
            status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'pending' },
            queue_job_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
            attempts: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
            error_message: { type: DataTypes.TEXT, allowNull: true },
            requested_by_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
            payload_json: { type: DataTypes.JSON, allowNull: true },
            result_json: { type: DataTypes.JSON, allowNull: true },
            started_at: { type: DataTypes.DATE, allowNull: true },
            finished_at: { type: DataTypes.DATE, allowNull: true },
        },
        {
            sequelize,
            modelName: 'AsyncStatusJob',
            tableName: 'async_status_jobs',
            timestamps: true,
            underscored: true,
            paranoid: false,
        }
    );

    return AsyncStatusJob;
};
