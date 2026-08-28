'use strict';

const { toCount, normalizeApifyItem } = require('./PostScoreHelper');
const { assignThreadKeys } = require('./CommentHelper');

/**
 * Chuẩn hóa URL bài Facebook (bỏ query/hash) để join comment dataset.
 */
function normalizeFacebookPostUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return null;
    try {
        const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
        parsed.search = '';
        parsed.hash = '';
        return parsed.toString().replace(/\/+$/, '');
    } catch {
        return raw.split(/[?#]/)[0].replace(/\/+$/, '') || null;
    }
}

function extractCommentIdFromUrl(url) {
    const raw = String(url || '');
    const reply = raw.match(/[?&]reply_comment_id=(\d+)/i);
    if (reply) return reply[1];
    const comment = raw.match(/[?&]comment_id=(\d+)/i);
    return comment ? comment[1] : null;
}

function extractParentCommentIdFromUrl(url) {
    const raw = String(url || '');
    if (!/[?&]reply_comment_id=/i.test(raw)) return null;
    const parent = raw.match(/[?&]comment_id=(\d+)/i);
    return parent ? parent[1] : null;
}

/**
 * @param {object} item — Apify facebook-comments-scraper row
 */
function normalizeOneFacebookComment(item, { parentId = null, sortOrder = 0 } = {}) {
    if (!item || typeof item !== 'object') return null;

    const cid =
        item.commentId ||
        item.comment_id ||
        extractCommentIdFromUrl(item.commentUrl) ||
        item.id ||
        null;
    if (!cid) return null;

    const text = String(item.text || item.commentText || '').trim();
    if (!text) return null;

    const parent =
        parentId ||
        item.replyToCommentId ||
        item.parentCommentId ||
        item.parentId ||
        extractParentCommentIdFromUrl(item.commentUrl) ||
        null;

    const publishedRaw = item.date || item.createdAt || item.publishedAt || null;
    let published_at = null;
    if (publishedRaw) {
        const asDate = new Date(publishedRaw);
        published_at = Number.isNaN(asDate.getTime()) ? null : asDate;
    }

    const author =
        String(item.profileName || item.authorName || item.author || '').trim() || null;

    const postUrl = normalizeFacebookPostUrl(
        item.facebookUrl || item.inputUrl || item.postUrl || null
    );

    return {
        platform_comment_id: String(cid),
        parent_platform_comment_id: parent ? String(parent) : null,
        thread_key: String(parent || cid),
        author,
        text,
        like_count: toCount(item.likesCount ?? item.likes ?? item.likeCount ?? 0),
        published_at,
        sort_order: sortOrder,
        raw_data: item,
        post_url: postUrl,
        facebook_post_id: item.facebookId ? String(item.facebookId) : null,
        threading_depth: toCount(item.threadingDepth ?? 0),
    };
}

/**
 * Flatten comments (+ nested replies nếu actor trả mảng replies).
 * @returns {object[]} comments đã assignThreadKeys
 */
function normalizeFacebookCommentItems(items = []) {
    const flat = [];
    let sortOrder = 0;

    for (const item of items) {
        if (!item) continue;

        const top = normalizeOneFacebookComment(item, { sortOrder: sortOrder++ });
        if (!top) continue;
        flat.push(top);

        const replies = Array.isArray(item.replies)
            ? item.replies
            : Array.isArray(item.replyComments)
              ? item.replyComments
              : [];

        for (const reply of replies) {
            const normalizedReply = normalizeOneFacebookComment(reply, {
                parentId: top.platform_comment_id,
                sortOrder: sortOrder++,
            });
            if (normalizedReply) flat.push(normalizedReply);
        }
    }

    return assignThreadKeys(flat);
}

function toFacebookPostResponse(normalized) {
    return {
        postId: normalized.platform_post_id,
        title: normalized.title,
        publishedAt: normalized.posted_at
            ? new Date(normalized.posted_at).toISOString()
            : null,
        likeCount: normalized.likes,
        commentCount: normalized.comments,
        shareCount: normalized.shares,
        angryCount: normalized.angry_count,
        viewCount: normalized.views ?? 0,
        post_url: normalized.post_url,
    };
}

module.exports = {
    normalizeFacebookPostUrl,
    normalizeFacebookCommentItems,
    normalizeApifyItem,
    toFacebookPostResponse,
};
