'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class PostTopCommentDaily extends Model {
        static associate(models) {
            PostTopCommentDaily.belongsTo(models.ScraperRun, {
                foreignKey: 'scraper_run_id',
                as: 'scraperRun',
            });
            PostTopCommentDaily.belongsTo(models.PostComment, {
                foreignKey: 'post_comment_id',
                as: 'postComment',
            });
        }
    }

    PostTopCommentDaily.init(
        {
            id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
            scraper_run_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
            snapshot_date: { type: DataTypes.DATEONLY, allowNull: false },
            rank: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
            post_comment_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
            platform_comment_id: { type: DataTypes.STRING(64), allowNull: false },
            author: { type: DataTypes.STRING(255), allowNull: true },
            text: { type: DataTypes.TEXT, allowNull: true },
            like_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            captured_at: { type: DataTypes.DATE, allowNull: false },
        },
        {
            sequelize,
            modelName: 'PostTopCommentDaily',
            tableName: 'post_top_comments_daily',
            timestamps: true,
            underscored: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                { unique: true, fields: ['scraper_run_id', 'snapshot_date', 'rank'] },
            ],
        }
    );

    return PostTopCommentDaily;
};
