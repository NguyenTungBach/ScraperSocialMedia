'use strict';

const { toCount } = require('./PostScoreHelper');

/**
 * Parse @handle từ URL kênh YouTube.
 * Hỗ trợ: https://www.youtube.com/@taca, https://youtube.com/@taca/videos, @taca, taca
 * @returns {string|null} handle không có @ (vd. "taca")
 */
function extractHandleFromUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return null;

    const atMatch = raw.match(/@([A-Za-z0-9._-]+)/);
    if (atMatch) return atMatch[1];

    // Pure handle không có URL / @
    if (/^[A-Za-z0-9._-]+$/.test(raw) && !raw.includes('.')) {
        return raw;
    }

    return null;
}

function buildWatchUrl(videoId) {
    const id = String(videoId || '').trim();
    if (!id) return null;
    return `https://www.youtube.com/watch?v=${id}`;
}

/**
 * Map item từ videos.list sang shape ingest (giống normalizeApifyItem).
 */
function normalizeYoutubeVideo(video) {
    const videoId = video?.id || video?.videoId || null;
    const snippet = video?.snippet || {};
    const statistics = video?.statistics || {};

    const publishedRaw = snippet.publishedAt || video?.publishedAt || null;
    let posted_at = null;
    if (publishedRaw) {
        const date = new Date(publishedRaw);
        posted_at = Number.isNaN(date.getTime()) ? null : date;
    }

    return {
        platform: 'youtube',
        platform_post_id: videoId ? String(videoId) : null,
        post_url: buildWatchUrl(videoId),
        title: snippet.title || video?.title || null,
        text: snippet.description || null,
        posted_at,
        likes: toCount(Number(statistics.likeCount ?? video?.likeCount ?? 0)),
        comments: toCount(Number(statistics.commentCount ?? video?.commentCount ?? 0)),
        shares: 0,
        angry_count: 0,
        viewCount: toCount(Number(statistics.viewCount ?? video?.viewCount ?? 0)),
        raw_data: video,
    };
}

/**
 * Shape gọn cho response API (không lưu DB).
 */
function toYoutubeVideoResponse(normalized) {
    return {
        videoId: normalized.platform_post_id,
        title: normalized.title,
        publishedAt: normalized.posted_at
            ? new Date(normalized.posted_at).toISOString()
            : null,
        viewCount: normalized.viewCount ?? 0,
        likeCount: normalized.likes,
        commentCount: normalized.comments,
        post_url: normalized.post_url,
    };
}

module.exports = {
    buildWatchUrl,
    extractHandleFromUrl,
    normalizeYoutubeVideo,
    toYoutubeVideoResponse,
};
