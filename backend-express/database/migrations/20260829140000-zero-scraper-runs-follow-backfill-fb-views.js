'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        // Follow thuộc kênh (channels.followers), không stamp lên bài.
        await queryInterface.sequelize.query(`
            UPDATE scraper_runs SET follow = 0 WHERE follow <> 0
        `);

        // Backfill Facebook views từ raw_data (ưu tiên viewsCount).
        await queryInterface.sequelize.query(`
            UPDATE scraper_runs
            SET views = CAST(
                COALESCE(
                    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.viewsCount')), 'null'),
                    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.views')), 'null'),
                    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.viewCount')), 'null'),
                    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.videoViewCount')), 'null'),
                    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.playCount')), 'null'),
                    '0'
                ) AS UNSIGNED
            )
            WHERE platform = 'facebook'
              AND (
                JSON_EXTRACT(raw_data, '$.viewsCount') IS NOT NULL
                OR JSON_EXTRACT(raw_data, '$.views') IS NOT NULL
                OR JSON_EXTRACT(raw_data, '$.viewCount') IS NOT NULL
                OR JSON_EXTRACT(raw_data, '$.videoViewCount') IS NOT NULL
                OR JSON_EXTRACT(raw_data, '$.playCount') IS NOT NULL
              )
        `);

        // social_posts.follow = SUM(channels.followers) qua subject_channels.
        await queryInterface.sequelize.query(`
            UPDATE social_posts sp
            SET follow = COALESCE((
                SELECT SUM(c.followers)
                FROM subject_channels sc
                INNER JOIN channels c ON c.id = sc.channel_id
                WHERE sc.subject_id = sp.subject_id
            ), 0)
        `);
    },

    async down(queryInterface) {
        // Không khôi phục follow đã stamp lên scraper_runs / views FB đã backfill.
        await queryInterface.sequelize.query(`
            UPDATE social_posts SET follow = 0
        `);
    },
};
