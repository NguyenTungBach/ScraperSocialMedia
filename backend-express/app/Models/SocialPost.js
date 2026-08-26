'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class SocialPost extends Model {
        static associate(models) {
            SocialPost.belongsTo(models.Subject, {
                foreignKey: 'subject_id',
                as: 'subject',
            });
        }
    }

    SocialPost.init(
        {
            id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
            subject_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
            likes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            angry_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            comments: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            shares: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            trend_score: {
                type: DataTypes.DECIMAL(65, 30),
                allowNull: false,
                defaultValue: 0,
                get() {
                    const n = Number(this.getDataValue('trend_score'));
                    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
                },
            },
            hot_score: {
                type: DataTypes.DECIMAL(65, 30),
                allowNull: false,
                defaultValue: 0,
                get() {
                    const n = Number(this.getDataValue('hot_score'));
                    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
                },
            },
            posts_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            computed_at: { type: DataTypes.DATE, allowNull: true },
        },
        {
            sequelize,
            modelName: 'SocialPost',
            tableName: 'social_posts',
            timestamps: true,
            underscored: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                { unique: true, fields: ['subject_id'] },
                { fields: ['hot_score'] },
            ],
        }
    );

    return SocialPost;
};
