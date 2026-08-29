'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ChannelDailySnapshot extends Model {
        static associate(models) {
            ChannelDailySnapshot.belongsTo(models.Channel, {
                foreignKey: 'channel_id',
                as: 'channel',
            });
        }
    }

    ChannelDailySnapshot.init(
        {
            id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
            channel_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
            snapshot_date: { type: DataTypes.DATEONLY, allowNull: false },
            platform: { type: DataTypes.STRING(50), allowNull: false },
            followers: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
            post_count_channel: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            post_count_tracked: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            views_sum: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
            likes_sum: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
            comments_sum: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
            shares_sum: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
            angry_sum: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
            captured_at: { type: DataTypes.DATE, allowNull: false },
        },
        {
            sequelize,
            modelName: 'ChannelDailySnapshot',
            tableName: 'channel_daily_snapshots',
            timestamps: true,
            underscored: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [{ unique: true, fields: ['channel_id', 'snapshot_date'] }],
        }
    );

    return ChannelDailySnapshot;
};
