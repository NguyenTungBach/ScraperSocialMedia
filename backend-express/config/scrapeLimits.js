'use strict';

/**
 * Default giới hạn khi tạo kênh mới (và migrate backfill).
 * Khi cào: dùng cột channels.max_posts / max_top_comments / max_replies — không đọc ENV.
 */
const maxPosts = 10;
const maxTopComments = 30;
const maxReplies = 10;

module.exports = {
    /** Số bài / video mới nhất mỗi kênh mỗi lần scrape (default tạo kênh) */
    maxPosts,
    /** Số comment gốc tối đa mỗi bài (default tạo kênh) */
    maxTopComments,
    /** Số reply tối đa mỗi comment gốc (default tạo kênh) */
    maxReplies,
};
