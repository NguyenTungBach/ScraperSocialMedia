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

function pickTitle(item) {
    return item.title || item.headline || null;
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

/**
 * trend = likes×1 + comments×2 + shares×3
 * hot   = shares×3 + comments×2 + angry×4 + likes×1
 */
function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

/** DECIMAL/string từ DB → number, tối đa 2 chữ số thập phân (vd: 143 hoặc 143.25). */
function roundScore(value) {
    return Math.round(toNumber(value) * 100) / 100;
}

/** Hiển thị score (email/HTML): luôn 2 chữ số thập phân. */
function formatScore(value) {
    return roundScore(value).toFixed(2);
}

function calculateScores({ likes = 0, comments = 0, shares = 0, angry_count = 0 }) {
    const l = toCount(likes);
    const c = toCount(comments);
    const s = toCount(shares);
    const a = toCount(angry_count);

    return {
        trend_score: roundScore(l * 1 + c * 2 + s * 3),
        hot_score: roundScore(s * 3 + c * 2 + a * 4 + l * 1),
    };
}

/**
 * Thảo luận ≈ bình luận + số bài (proxy khi chưa có volume thảo luận thật).
 * Tương tác = likes + comments + shares.
 * Cảm xúc ∈ [-1, 1] từ likes vs angry.
 */
function deriveEngagementMetrics(row = {}) {
    const likes = toCount(row.likes);
    const comments = toCount(row.comments);
    const shares = toCount(row.shares);
    const angry = toCount(row.angry_count);
    const postsCount = toCount(row.posts_count);
    const hotScore = roundScore(row.hot_score);
    const trendScore = roundScore(row.trend_score);

    const discussion = comments + postsCount;
    const interaction = likes + comments + shares;
    const denom = likes + angry;
    const sentiment = denom === 0 ? 0 : (likes - angry) / denom;

    return {
        discussion,
        interaction,
        sentiment: Math.round(sentiment * 100) / 100,
        hot_score: hotScore,
        trend_score: trendScore,
    };
}

/**
 * Uptrend: đạt ngưỡng hot hoặc trend (đang nóng / tương tác mạnh).
 * Downtrend: cả hai điểm dưới 25% ngưỡng (engagement thấp / nguội).
 * Neutral: còn lại.
 */
function classifyTrendDirection(row, { hotThreshold, trendThreshold } = {}) {
    const hot = roundScore(row.hot_score);
    const trend = roundScore(row.trend_score);
    const hotTh = Number(hotThreshold) || 800;
    const trendTh = Number(trendThreshold) || 500;

    if (hot >= hotTh || trend >= trendTh) return 'up';
    if (hot < hotTh * 0.25 && trend < trendTh * 0.25) return 'down';
    return 'neutral';
}

function isNewSocialPost(row, withinHours = 48) {
    const raw = row?.created_at || row?.createdAt;
    if (!raw) return false;
    const created = new Date(raw);
    if (Number.isNaN(created.getTime())) return false;
    return Date.now() - created.getTime() <= withinHours * 60 * 60 * 1000;
}

function normalizeApifyItem(item) {
    const likes = pickCount(item, ['likes', 'likeCount', 'reactions']) ?? 0;
    const comments = pickCount(item, ['comments', 'commentCount', 'commentsCount']) ?? 0;
    const shares = pickCount(item, ['shares', 'shareCount', 'sharesCount']) ?? 0;
    const angry_count = pickAngryCount(item);

    return {
        platform: 'facebook',
        platform_post_id: buildPlatformPostId(item),
        post_url: pickPostUrl(item),
        input_url: pickInputUrl(item),
        title: pickTitle(item),
        text: pickText(item),
        posted_at: pickPostedAt(item),
        likes: toCount(likes),
        comments: toCount(comments),
        shares: toCount(shares),
        angry_count: toCount(angry_count),
        raw_data: item,
    };
}

module.exports = {
    buildPlatformPostId,
    calculateScores,
    classifyTrendDirection,
    deriveEngagementMetrics,
    formatScore,
    isNewSocialPost,
    normalizeApifyItem,
    pickInputUrl,
    roundScore,
    toCount,
    toNumber,
};
