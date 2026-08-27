'use strict';

function toCount(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
}

function normalizeYoutubeCommentItem(item, { parentId = null, threadKey = null, sortOrder = 0 } = {}) {
    const snippet = item?.snippet || {};
    const topLevel = item?.snippet?.topLevelComment?.snippet ? item.snippet.topLevelComment : item;
    const commentSnippet = topLevel?.snippet || snippet;
    const commentId = topLevel?.id || item?.id || null;
    if (!commentId) return null;

    const parent =
        parentId ||
        commentSnippet.parentId ||
        topLevel?.snippet?.parentId ||
        null;

    const rootKey = threadKey || (parent ? null : commentId);
    const resolvedThreadKey = threadKey || parent || commentId;

    const text =
        String(commentSnippet.textOriginal || commentSnippet.textDisplay || '').trim();
    if (!text) return null;

    const publishedAt = commentSnippet.publishedAt
        ? new Date(commentSnippet.publishedAt)
        : null;

    return {
        platform_comment_id: String(commentId),
        parent_platform_comment_id: parent ? String(parent) : null,
        thread_key: String(resolvedThreadKey),
        author: String(commentSnippet.authorDisplayName || '').trim() || null,
        text,
        like_count: toCount(commentSnippet.likeCount),
        published_at: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
        sort_order: sortOrder,
        raw_data: item,
        _root_key_hint: rootKey,
    };
}

function assignThreadKeys(comments) {
    const byId = new Map(comments.map((c) => [c.platform_comment_id, c]));
    for (const comment of comments) {
        if (!comment.parent_platform_comment_id) {
            comment.thread_key = comment.platform_comment_id;
            continue;
        }
        let cursor = comment.parent_platform_comment_id;
        let rootId = cursor;
        const visited = new Set();
        while (cursor && !visited.has(cursor)) {
            visited.add(cursor);
            const parent = byId.get(cursor);
            if (!parent || !parent.parent_platform_comment_id) {
                rootId = cursor;
                break;
            }
            cursor = parent.parent_platform_comment_id;
        }
        comment.thread_key = rootId;
    }
    return comments;
}

function buildGeminiPayload(scraperRun, comments) {
    return {
        video: {
            video_id: scraperRun.platform_post_id,
            title: scraperRun.title || '',
            post_url: scraperRun.post_url || '',
        },
        comments: comments.map((c) => ({
            comment_id: c.platform_comment_id,
            parent_id: c.parent_platform_comment_id,
            author: c.author || '',
            text: c.text,
        })),
    };
}

module.exports = {
    toCount,
    normalizeYoutubeCommentItem,
    assignThreadKeys,
    buildGeminiPayload,
};
