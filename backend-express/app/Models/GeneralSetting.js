'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class GeneralSetting extends Model {
        static associate() {}
    }

    GeneralSetting.init(
        {
            id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
            setting_key: { type: DataTypes.STRING(128), allowNull: false },
            setting_value: { type: DataTypes.TEXT, allowNull: true },
            group: { type: DataTypes.STRING(32), allowNull: false },
            is_secret: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 0 },
        },
        {
            sequelize,
            modelName: 'GeneralSetting',
            tableName: 'general_settings',
            timestamps: true,
            underscored: true,
            paranoid: false,
        }
    );

    return GeneralSetting;
};
