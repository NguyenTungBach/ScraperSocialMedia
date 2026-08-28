'use strict';

const { toCount } = require('./PostScoreHelper');
const { assignThreadKeys } = require('./CommentHelper');

function pickNested(item, dottedKey) {
    if (!item || typeof item !== 'object') return undefined;
    if (Object.prototype.hasOwnProperty.call(item, dottedKey)) {
        return item[dottedKey];
    }
    const parts = String(dottedKey).split('.');
    let cur = item;
    for (const part of parts) {
        if (cur == null || typeof cur !== 'object') return undefined;
        cur = cur[part];
    }
    return cur;
}

function extractVideoIdFromUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return null;
    const match = raw.match(/\/(?:video|photo)\/(\d+)/i);
    return match ? match[1] : null;
}

/**
 * Chuẩn hóa URL post TikTok (photo → video) để join comment dataset.
 */
function normalizeTikTokPostUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return null;
    return raw.replace(/\/photo\//i, '/video/').split('?')[0];
}

function buildTikTokWatchUrl(videoId, authorName) {
    if (!videoId) return null;
    const handle = String(authorName || '')
        .trim()
        .replace(/^@/, '');
    if (handle) {
        return `https://www.tiktok.com/@${handle}/video/${videoId}`;
    }
    return `https://www.tiktok.com/video/${videoId}`;
}

/**
 * @param {object} item — Apify TikTok video item (nested hoặc flatten)
 */
function normalizeTikTokItem(item) {
    if (!item || typeof item !== 'object') return null;

    const webVideoUrl =
        item.webVideoUrl ||
        item.videoWebUrl ||
        pickNested(item, 'webVideoUrl') ||
        null;
    const videoId =
        item.id ||
        item.videoId ||
        extractVideoIdFromUrl(webVideoUrl) ||
        null;

    const authorName =
        pickNested(item, 'authorMeta.name') ||
        item.authorMeta?.name ||
        item.authorMeta?.uniqueId ||
        pickNested(item, 'authorMeta.uniqueId') ||
        null;

    const text = String(item.text || item.desc || '').trim() || null;
    const title = text ? text.slice(0, 255) : null;

    const createRaw =
        item.createTimeISO ||
        item.createTime ||
        pickNested(item, 'createTimeISO') ||
        null;
    let posted_at = null;
    if (createRaw) {
        const asDate =
            typeof createRaw === 'number'
                ? new Date(createRaw > 1e12 ? createRaw : createRaw * 1000)
                : new Date(createRaw);
        posted_at = Number.isNaN(asDate.getTime()) ? null : asDate;
    }

    const post_url =
        normalizeTikTokPostUrl(webVideoUrl) || buildTikTokWatchUrl(videoId, authorName);

    if (!videoId && !post_url) return null;

    const followers =
        pickNested(item, 'authorMeta.fans') ||
        item.authorMeta?.fans ||
        item.authorMeta?.followers ||
        0;

    return {
        platform: 'tiktok',
        platform_post_id: videoId ? String(videoId) : extractVideoIdFromUrl(post_url),
        post_url,
        title,
        text,
        posted_at,
        likes: toCount(item.diggCount ?? item.likes ?? pickNested(item, 'diggCount') ?? 0),
        comments: toCount(
            item.commentCount ?? item.comments ?? pickNested(item, 'commentCount') ?? 0
        ),
        shares: toCount(item.shareCount ?? item.shares ?? pickNested(item, 'shareCount') ?? 0),
        angry_count: 0,
        views: toCount(item.playCount ?? item.views ?? pickNested(item, 'playCount') ?? 0),
        follow: toCount(followers),
        author_name: authorName ? String(authorName).replace(/^@/, '') : null,
        raw_data: item,
    };
}

function normalizeOneTikTokComment(item, { parentId = null, sortOrder = 0 } = {}) {
    if (!item || typeof item !== 'object') return null;

    const cid = item.cid || item.commentId || item.id || null;
    if (!cid) return null;

    const text = String(item.text || item.commentText || '').trim();
    if (!text) return null;

    const parent =
        parentId ||
        item.parentCid ||
        item.parentCommentId ||
        item.replyToCommentId ||
        item.replyToId ||
        null;

    const publishedRaw = item.createTimeISO || item.createTime || item.postedAt || null;
    let published_at = null;
    if (publishedRaw) {
        const asDate =
            typeof publishedRaw === 'number'
                ? new Date(publishedRaw > 1e12 ? publishedRaw : publishedRaw * 1000)
                : new Date(publishedRaw);
        published_at = Number.isNaN(asDate.getTime()) ? null : asDate;
    }

    const author =
        String(item.uniqueId || item.unique_id || item.nickname || item.author || '')
            .trim() || null;

    return {
        platform_comment_id: String(cid),
        parent_platform_comment_id: parent ? String(parent) : null,
        thread_key: String(parent || cid),
        author,
        text,
        like_count: toCount(item.diggCount ?? item.likeCount ?? item.likes ?? 0),
        published_at,
        sort_order: sortOrder,
        raw_data: item,
        video_web_url: normalizeTikTokPostUrl(
            item.videoWebUrl || item.webVideoUrl || item.videoUrl || null
        ),
    };
}

/**
 * Flatten top-level + nested replies từ dataset Comments Scraper.
 * @returns {object[]} comments đã assignThreadKeys
 */
function normalizeTikTokCommentItems(items = []) {
    const flat = [];
    let sortOrder = 0;

    for (const item of items) {
        if (!item) continue;

        const top = normalizeOneTikTokComment(item, { sortOrder: sortOrder++ });
        if (!top) continue;
        flat.push(top);

        const replies = Array.isArray(item.replies)
            ? item.replies
            : Array.isArray(item.replyComments)
              ? item.replyComments
              : [];

        for (const reply of replies) {
            const normalizedReply = normalizeOneTikTokComment(reply, {
                parentId: top.platform_comment_id,
                sortOrder: sortOrder++,
            });
            if (normalizedReply) flat.push(normalizedReply);
        }
    }

    // Flat items that already carry parent id (no nesting)
    return assignThreadKeys(flat);
}

function toTikTokVideoResponse(normalized) {
    return {
        videoId: normalized.platform_post_id,
        title: normalized.title,
        publishedAt: normalized.posted_at
            ? new Date(normalized.posted_at).toISOString()
            : null,
        viewCount: normalized.views ?? 0,
        likeCount: normalized.likes,
        commentCount: normalized.comments,
        shareCount: normalized.shares,
        follow: normalized.follow ?? 0,
        post_url: normalized.post_url,
    };
}

module.exports = {
    extractVideoIdFromUrl,
    normalizeTikTokPostUrl,
    normalizeTikTokItem,
    normalizeTikTokCommentItems,
    toTikTokVideoResponse,
};
