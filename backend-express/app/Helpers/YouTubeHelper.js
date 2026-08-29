'use strict';

const { toCount } = require('./PostScoreHelper');

/**
 * Parse tham chiếu kênh YouTube từ URL / chuỗi.
 * Hỗ trợ:
 *   https://www.youtube.com/@taca
 *   https://www.youtube.com/c/nguoivietonline
 *   https://www.youtube.com/channel/UCxxxx
 *   https://www.youtube.com/user/SomeUser
 *   @taca | taca
 *
 * @returns {{ kind: 'handle'|'id'|'username'|'custom', value: string } | null}
 */
function parseYoutubeChannelRef(url) {
    const raw = String(url || '').trim();
    if (!raw) return null;

    const bareAt = raw.match(/^@([A-Za-z0-9._-]+)$/);
    if (bareAt) return { kind: 'handle', value: bareAt[1] };

    if (/^UC[\w-]{20,}$/.test(raw)) {
        return { kind: 'id', value: raw };
    }

    if (/^[A-Za-z0-9._-]+$/.test(raw) && !raw.includes('.')) {
        return { kind: 'handle', value: raw };
    }

    let pathname = raw;
    try {
        const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
        pathname = parsed.pathname || '';
    } catch {
        pathname = raw;
    }

    const path = pathname.replace(/\/+$/, '');

    const atPath = path.match(/\/@([A-Za-z0-9._-]+)/i);
    if (atPath) return { kind: 'handle', value: atPath[1] };

    const channelId = path.match(/\/channel\/(UC[\w-]{20,})/i);
    if (channelId) return { kind: 'id', value: channelId[1] };

    const user = path.match(/\/user\/([A-Za-z0-9._-]+)/i);
    if (user) return { kind: 'username', value: user[1] };

    const custom = path.match(/\/c\/([A-Za-z0-9._-]+)/i);
    if (custom) return { kind: 'custom', value: custom[1] };

    const atAnywhere = raw.match(/@([A-Za-z0-9._-]+)/);
    if (atAnywhere) return { kind: 'handle', value: atAnywhere[1] };

    return null;
}

/**
 * @deprecated Dùng parseYoutubeChannelRef.
 * @returns {string|null} handle không có @
 */
function extractHandleFromUrl(url) {
    const ref = parseYoutubeChannelRef(url);
    if (!ref) return null;
    if (ref.kind === 'handle' || ref.kind === 'custom' || ref.kind === 'username') {
        return ref.value;
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
 * @param {object} video
 * @param {object} [extras] — giữ tương thích gọi cũ; follow không còn stamp lên bài
 */
function normalizeYoutubeVideo(video, extras = {}) {
    void extras;
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
        views: toCount(Number(statistics.viewCount ?? video?.viewCount ?? video?.views ?? 0)),
        // Subscribers thuộc kênh (channels.followers), không stamp lên bài
        follow: 0,
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
        viewCount: normalized.views ?? 0,
        likeCount: normalized.likes,
        commentCount: normalized.comments,
        follow: normalized.follow ?? 0,
        post_url: normalized.post_url,
    };
}

module.exports = {
    buildWatchUrl,
    extractHandleFromUrl,
    normalizeYoutubeVideo,
    parseYoutubeChannelRef,
    toYoutubeVideoResponse,
};
