'use strict';

require('dotenv').config();

/**
 * Giới hạn cào chung cho mọi nền tảng (YouTube, TikTok, Facebook, …).
 *
 * Env mới (ưu tiên):
 *   SCRAPE_MAX_POSTS
 *   SCRAPE_MAX_TOP_COMMENTS
 *   SCRAPE_MAX_REPLIES
 *
 * Legacy (fallback tạm): YOUTUBE_MAX_*, APIFY_TIKTOK_*, APIFY_FACEBOOK_RESULTS_LIMIT
 */
function toPositiveInt(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Math.floor(n);
}

const maxPosts = toPositiveInt(
    process.env.SCRAPE_MAX_POSTS ??
        process.env.YOUTUBE_MAX_RESULTS ??
        process.env.APIFY_TIKTOK_RESULTS_PER_PAGE ??
        process.env.APIFY_FACEBOOK_RESULTS_LIMIT,
    10
);

const maxTopComments = toPositiveInt(
    process.env.SCRAPE_MAX_TOP_COMMENTS ??
        process.env.APIFY_TIKTOK_COMMENTS_PER_POST ??
        process.env.YOUTUBE_MAX_TOP_COMMENTS,
    30
);

const maxReplies = toPositiveInt(
    process.env.SCRAPE_MAX_REPLIES ??
        process.env.APIFY_TIKTOK_MAX_REPLIES_PER_COMMENT ??
        process.env.YOUTUBE_MAX_REPLIES,
    10
);

module.exports = {
    /** Số bài / video mới nhất mỗi kênh mỗi lần scrape */
    maxPosts,
    /** Số comment gốc tối đa mỗi bài */
    maxTopComments,
    /** Số reply tối đa mỗi comment gốc */
    maxReplies,
};
