'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class GeneralSchedule extends Model {
        static associate() {}
    }

    GeneralSchedule.init(
        {
            id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
            name: { type: DataTypes.STRING(191), allowNull: false },
            cron_expression: { type: DataTypes.STRING(64), allowNull: false },
            command: { type: DataTypes.STRING(255), allowNull: false },
            enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            last_run_at: { type: DataTypes.DATE, allowNull: true },
            last_finished_at: { type: DataTypes.DATE, allowNull: true },
            last_status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'idle' },
            last_error: { type: DataTypes.TEXT, allowNull: true },
        },
        {
            sequelize,
            modelName: 'GeneralSchedule',
            tableName: 'general_schedules',
            timestamps: true,
            underscored: true,
            paranoid: false,
        }
    );

    return GeneralSchedule;
};
