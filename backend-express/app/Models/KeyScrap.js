'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class KeyScrap extends Model {
        static associate() {}
    }

    KeyScrap.init(
        {
            id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
            key_name: { type: DataTypes.STRING(128), allowNull: false },
            key_value: { type: DataTypes.TEXT, allowNull: true },
            provider: { type: DataTypes.STRING(32), allowNull: false },
            is_secret: { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 0 },
        },
        {
            sequelize,
            modelName: 'KeyScrap',
            tableName: 'key_scraps',
            timestamps: true,
            underscored: true,
            paranoid: false,
        }
    );

    return KeyScrap;
};
