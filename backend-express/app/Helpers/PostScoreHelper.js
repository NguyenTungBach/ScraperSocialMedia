'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');

function toCount(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'bigint') {
        const n = Number(value);
        return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    }
    if (typeof value === 'string') {
        const n = Number(value.trim());
        return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    }
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
 * Facebook (mặc định):
 *   trend = likes×1 + comments×2 + shares×3
 *   hot   = likes×1 + comments×2 + shares×3 + angry×4
 *
 * YouTube:
 *   view_w = floor(views / 100)
 *   trend  = likes×1 + comments×2 + view_w×3
 *   hot    = likes×1 + comments×3 + view_w×3
 */
function toNumber(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'bigint') {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    }
    const n = Number(typeof value === 'string' ? value.trim() : value);
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

function normalizePlatform(platform) {
    const p = String(platform || '')
        .trim()
        .toLowerCase();
    if (p === 'youtube' || p === 'yt') return 'youtube';
    if (p === 'facebook' || p === 'fb') return 'facebook';
    if (p === 'tiktok' || p === 'tt') return 'tiktok';
    return p || 'facebook';
}

/** Proxy lan tỏa YouTube / TikTok thay / kèm shares. */
function youtubeViewWeight(views = 0) {
    return Math.floor(toCount(views) / 100);
}

/**
 * @param {{ likes?: number, comments?: number, shares?: number, angry_count?: number, views?: number, platform?: string }} input
 */
function calculateScores({
    likes = 0,
    comments = 0,
    shares = 0,
    angry_count = 0,
    views = 0,
    platform = 'facebook',
} = {}) {
    const l = toCount(likes);
    const c = toCount(comments);
    const plat = normalizePlatform(platform);

    if (plat === 'youtube') {
        const viewW = youtubeViewWeight(views);
        return {
            trend_score: roundScore(l * 1 + c * 2 + viewW * 3),
            hot_score: roundScore(l * 1 + c * 3 + viewW * 3),
        };
    }

    if (plat === 'tiktok') {
        const viewW = youtubeViewWeight(views);
        const s = toCount(shares);
        return {
            trend_score: roundScore(l * 1 + c * 2 + s * 3 + viewW * 2),
            hot_score: roundScore(l * 1 + c * 3 + s * 3 + viewW * 2),
        };
    }

    const s = toCount(shares);
    const a = toCount(angry_count);
    return {
        trend_score: roundScore(l * 1 + c * 2 + s * 3),
        hot_score: roundScore(l * 1 + c * 2 + s * 3 + a * 4),
    };
}

/**
 * Cộng điểm theo từng nhóm platform (sum metrics rồi apply công thức platform đó).
 * @param {Array<{ platform?: string, likes?: number, comments?: number, shares?: number, angry_count?: number, views?: number }>} runs
 */
function calculateScoresFromRuns(runs = []) {
    const byPlatform = new Map();

    for (const run of runs) {
        if (!run) continue;
        const plat = normalizePlatform(run.platform);
        const bucket = byPlatform.get(plat) || {
            likes: 0,
            comments: 0,
            shares: 0,
            angry_count: 0,
            views: 0,
        };
        bucket.likes += toCount(run.likes);
        bucket.comments += toCount(run.comments);
        bucket.shares += toCount(run.shares);
        bucket.angry_count += toCount(run.angry_count);
        bucket.views += toCount(run.views);
        byPlatform.set(plat, bucket);
    }

    let hot_score = 0;
    let trend_score = 0;
    for (const [plat, bucket] of byPlatform) {
        const scores = calculateScores({ ...bucket, platform: plat });
        hot_score += scores.hot_score;
        trend_score += scores.trend_score;
    }

    return {
        hot_score: roundScore(hot_score),
        trend_score: roundScore(trend_score),
    };
}

/**
 * Suy platform từ channels của subject (youtube-only / facebook-only / mixed).
 */
function resolveSubjectPlatform(subject) {
    const channels = subject?.channels || [];
    const types = channels
        .map((ch) =>
            normalizePlatform(ch.type_channel || ch.typeChannel || ch.type || ch.platform)
        )
        .filter(Boolean);
    if (types.length === 0) return null;
    if (types.every((t) => t === 'youtube')) return 'youtube';
    if (types.every((t) => t === 'facebook')) return 'facebook';
    if (types.every((t) => t === 'tiktok')) return 'tiktok';
    return 'mixed';
}

/**
 * Thảo luận ≈ bình luận + số bài.
 * FB: tương tác = likes+comments+shares; cảm xúc từ likes vs angry.
 * YT: tương tác = likes+comments; cảm xúc = 0 (tạm, chưa có angry).
 * TT: tương tác = likes+comments+shares.
 */
function deriveEngagementMetrics(row = {}) {
    const likes = toCount(row.likes);
    const comments = toCount(row.comments);
    const shares = toCount(row.shares);
    const angry = toCount(row.angry_count);
    const postsCount = toCount(row.posts_count);
    const hotScore = roundScore(row.hot_score);
    const trendScore = roundScore(row.trend_score);

    let platform = row.platform ? normalizePlatform(row.platform) : null;
    if (!platform && row.subject) {
        platform = resolveSubjectPlatform(row.subject);
    }
    // Heuristic: có views, không shares/angry → youtube
    if (!platform && toCount(row.views) > 0 && shares === 0 && angry === 0) {
        platform = 'youtube';
    }
    if (!platform) platform = 'facebook';

    const discussion = comments + postsCount;
    let interaction;
    let sentiment;

    if (platform === 'youtube') {
        interaction = likes + comments;
        sentiment = 0;
    } else if (platform === 'tiktok') {
        interaction = likes + comments + shares;
        sentiment = 0;
    } else if (platform === 'mixed') {
        interaction = likes + comments + shares;
        const denom = likes + angry;
        sentiment = denom === 0 ? 0 : (likes - angry) / denom;
    } else {
        interaction = likes + comments + shares;
        const denom = likes + angry;
        sentiment = denom === 0 ? 0 : (likes - angry) / denom;
    }

    return {
        discussion,
        interaction,
        sentiment: Math.round(sentiment * 100) / 100,
        hot_score: hotScore,
        trend_score: trendScore,
        platform,
    };
}

/**
 * Uptrend: đạt ngưỡng hot hoặc trend (đang nóng / tương tác mạnh).
 * Downtrend: chưa đạt ngưỡng (còn lại).
 */
function classifyTrendDirection(row, { hotThreshold, trendThreshold } = {}) {
    const hot = roundScore(row.hot_score);
    const trend = roundScore(row.trend_score);
    const hotTh = Number(hotThreshold) || 800;
    const trendTh = Number(trendThreshold) || 500;

    if (hot >= hotTh || trend >= trendTh) return 'up';
    return 'down';
}

function isNewSocialPost(row, withinHours = 48) {
    const raw = row?.created_at || row?.createdAt;
    if (!raw) return false;
    const created = new Date(raw);
    if (Number.isNaN(created.getTime())) return false;
    return Date.now() - created.getTime() <= withinHours * 60 * 60 * 1000;
}

/**
 * Tháng lịch chứa `refDate` (local server): [start, end) — end = đầu tháng sau.
 */
function getCalendarMonthRange(refDate = new Date()) {
    const d = refDate instanceof Date ? refDate : new Date(refDate);
    const base = Number.isNaN(d.getTime()) ? new Date() : d;
    const start = new Date(base.getFullYear(), base.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 1, 0, 0, 0, 0);
    return { start, end };
}

/** Parse YYYY-MM-DD → Date local 00:00:00, hoặc null nếu invalid. */
function parseDateOnly(value) {
    if (value == null || value === '') return null;
    const raw = String(value).trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!m) {
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    const y = Number(m[1]);
    const month = Number(m[2]) - 1;
    const day = Number(m[3]);
    const d = new Date(y, month, day, 0, 0, 0, 0);
    if (d.getFullYear() !== y || d.getMonth() !== month || d.getDate() !== day) return null;
    return d;
}

/**
 * Cửa sổ posted_at từ query date_from / date_to (YYYY-MM-DD, inclusive).
 * Không truyền gì → tháng lịch hiện tại.
 * Chỉ date_from → từ ngày đó đến cuối tháng của date_from.
 * Chỉ date_to → từ đầu tháng của date_to đến hết ngày date_to.
 * end trả về exclusive (đầu ngày kế tiếp sau date_to).
 */
function resolvePostedAtRange({ date_from, date_to, refDate = new Date() } = {}) {
    const from = parseDateOnly(date_from);
    const to = parseDateOnly(date_to);

    if (!from && !to) {
        return getCalendarMonthRange(refDate);
    }

    let start;
    let endExclusive;

    if (from && to) {
        start = from;
        endExclusive = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1, 0, 0, 0, 0);
        if (endExclusive.getTime() <= start.getTime()) {
            endExclusive = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 0, 0, 0, 0);
        }
    } else if (from) {
        start = from;
        endExclusive = new Date(from.getFullYear(), from.getMonth() + 1, 1, 0, 0, 0, 0);
    } else {
        const monthStart = new Date(to.getFullYear(), to.getMonth(), 1, 0, 0, 0, 0);
        start = monthStart;
        endExclusive = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1, 0, 0, 0, 0);
    }

    return { start, end: endExclusive };
}

/** YYYY-MM-DD local từ Date. */
function formatDateOnly(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Bài có posted_at ∈ [start, end).
 * Thiếu / invalid posted_at → false.
 */
function isWithinPostedAtRange(postedAt, { start, end } = {}) {
    if (postedAt == null) return false;
    const posted = postedAt instanceof Date ? postedAt : new Date(postedAt);
    if (Number.isNaN(posted.getTime())) return false;
    const t = posted.getTime();
    if (start && t < start.getTime()) return false;
    if (end && t >= end.getTime()) return false;
    return true;
}

/** Sequelize where fragment cho scraper_runs.posted_at. */
function buildPostedAtWhere({ start, end } = {}) {
    const where = {};
    if (start && end) {
        where.posted_at = { [Op.gte]: start, [Op.lt]: end };
    } else if (start) {
        where.posted_at = { [Op.gte]: start };
    } else if (end) {
        where.posted_at = { [Op.lt]: end };
    }
    return where;
}

function normalizeApifyItem(item) {
    const likes = pickCount(item, ['likes', 'likeCount', 'reactions']) ?? 0;
    const comments = pickCount(item, ['comments', 'commentCount', 'commentsCount']) ?? 0;
    const shares = pickCount(item, ['shares', 'shareCount', 'sharesCount']) ?? 0;
    const angry_count = pickAngryCount(item);
    const views =
        pickCount(item, ['views', 'viewCount', 'videoViewCount', 'playCount']) ?? 0;

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
        views: toCount(views),
        follow: 0,
        raw_data: item,
    };
}

module.exports = {
    buildPlatformPostId,
    buildPostedAtWhere,
    calculateScores,
    calculateScoresFromRuns,
    classifyTrendDirection,
    deriveEngagementMetrics,
    formatDateOnly,
    formatScore,
    getCalendarMonthRange,
    isNewSocialPost,
    isWithinPostedAtRange,
    normalizeApifyItem,
    normalizePlatform,
    parseDateOnly,
    pickInputUrl,
    resolvePostedAtRange,
    resolveSubjectPlatform,
    roundScore,
    toCount,
    toNumber,
    youtubeViewWeight,
};
