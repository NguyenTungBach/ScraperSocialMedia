'use strict';

const crypto = require('crypto');

function toCount(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, Math.floor(value));
    }
    return 0;
}

function pickPostId(item) {
    return item.postId || item.post_id || item.id || item.legacyId || null;
}

function pickPostUrl(item) {
    return item.url || item.postUrl || item.post_url || item.link || null;
}

function pickInputUrl(item) {
    return (
        item.inputUrl ||
        item.input_url ||
        item.facebookUrl ||
        item.pageUrl ||
        item.page_url ||
        item.user?.url ||
        item.author?.url ||
        null
    );
}

function pickText(item) {
    return item.text || item.message || item.caption || item.content || null;
}

function pickPostedAt(item) {
    const raw = item.time || item.timestamp || item.postTime || item.postedAt || item.date;
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
}

function pickCount(item, keys) {
    for (const key of keys) {
        const value = item[key];
        if (typeof value === 'number') return value;
        if (value && typeof value === 'object' && typeof value.count === 'number') {
            return value.count;
        }
    }
    return null;
}

function pickAngryCount(item) {
    const reactions = item.reactions || item.reactionCounts || item.reactionsCount;
    if (!reactions || typeof reactions !== 'object') {
        return pickCount(item, ['angry', 'angryCount', 'angryReactions']) || 0;
    }

    const angry =
        reactions.angry ??
        reactions.ANGRY ??
        reactions.Angry ??
        reactions['👿'] ??
        null;

    if (typeof angry === 'number') return angry;
    if (angry && typeof angry === 'object' && typeof angry.count === 'number') {
        return angry.count;
    }

    return 0;
}

function buildPlatformPostId(item) {
    const postId = pickPostId(item);
    if (postId) return String(postId);

    const postUrl = pickPostUrl(item);
    if (postUrl) {
        return `url:${crypto.createHash('sha256').update(postUrl).digest('hex').slice(0, 32)}`;
    }

    const text = pickText(item) || '';
    const postedAt = pickPostedAt(item)?.toISOString() || '';
    const inputUrl = pickInputUrl(item) || '';
    const fingerprint = `${inputUrl}|${postedAt}|${text.slice(0, 200)}`;
    return `fp:${crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 32)}`;
}

function calculateScores({ likes = 0, comments = 0, shares = 0, angry_count = 0 }) {
    const l = toCount(likes);
    const c = toCount(comments);
    const s = toCount(shares);
    const a = toCount(angry_count);

    return {
        trend_score: l * 1 + c * 2 + s * 3,
        hot_score: s * 3 + c * 2 + a * 4 + l * 1,
    };
}

function normalizeApifyItem(item) {
    const likes = pickCount(item, ['likes', 'likeCount', 'reactions']) ?? 0;
    const comments = pickCount(item, ['comments', 'commentCount', 'commentsCount']) ?? 0;
    const shares = pickCount(item, ['shares', 'shareCount', 'sharesCount']) ?? 0;
    const angry_count = pickAngryCount(item);
    const engagement = { likes, comments, shares, angry_count };
    const scores = calculateScores(engagement);

    return {
        platform: 'facebook',
        platform_post_id: buildPlatformPostId(item),
        post_url: pickPostUrl(item),
        text: pickText(item),
        posted_at: pickPostedAt(item),
        input_url: pickInputUrl(item),
        ...engagement,
        ...scores,
        raw_data: item,
    };
}

module.exports = {
    buildPlatformPostId,
    calculateScores,
    normalizeApifyItem,
    pickInputUrl,
};
