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

/**
 * Giữ thứ tự comment gốc như nền tảng trả về (Top / Hàng đầu / Phù hợp nhất),
 * reply trong mỗi thread theo thời gian tăng dần; gán lại sort_order.
 * Gọi sau assignThreadKeys.
 */
function finalizePlatformCommentOrder(comments = []) {
    const list = Array.isArray(comments) ? comments : [];
    const roots = list.filter((c) => !c.parent_platform_comment_id);
    let nextOrder = 0;
    const ordered = [];

    for (const root of roots) {
        root.sort_order = nextOrder++;
        ordered.push(root);
        const replies = list
            .filter(
                (c) =>
                    c.parent_platform_comment_id &&
                    (c.thread_key === root.platform_comment_id ||
                        c.parent_platform_comment_id === root.platform_comment_id)
            )
            .sort((a, b) => {
                const aMs = a.published_at ? new Date(a.published_at).getTime() : 0;
                const bMs = b.published_at ? new Date(b.published_at).getTime() : 0;
                if (aMs !== bMs) return aMs - bMs;
                return (a.sort_order ?? 0) - (b.sort_order ?? 0);
            });
        for (const reply of replies) {
            reply.sort_order = nextOrder++;
            ordered.push(reply);
        }
    }

    const kept = new Set(ordered.map((c) => c.platform_comment_id));
    for (const orphan of list) {
        if (kept.has(orphan.platform_comment_id)) continue;
        orphan.sort_order = nextOrder++;
        ordered.push(orphan);
    }

    return ordered;
}

function buildGeminiPayload(scraperRun, comments) {
    return {
        video: {
            video_id: scraperRun.platform_post_id,
            title: scraperRun.title || '',
            text: scraperRun.text || '',
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

function toPlainComment(row) {
    return typeof row.toJSON === 'function' ? row.toJSON() : row;
}

/** Lone hoặc thread đã gửi Gemini nhưng thiếu kết quả phân loại. */
function isIncompleteAnalysisRecord(record) {
    if (!record) return false;
    if (record.analysis_status === 'pending') return true;
    if (record.analysis_status !== 'done') return false;
    return !record.classified_as && !record.reason;
}

/**
 * Nhóm comment pending thành đơn vị phân tích: 1 lone hoặc 1 thread (giữ nguyên cả chuỗi).
 */
function groupCommentsIntoAnalysisUnits(comments = []) {
    const units = [];
    const seenThreads = new Set();

    for (const row of comments) {
        const plain = toPlainComment(row);
        if (plain.group_type === 'lone') {
            units.push({ type: 'lone', threadKey: null, comments: [plain] });
            continue;
        }
        if (plain.group_type !== 'thread' || seenThreads.has(plain.thread_key)) continue;

        seenThreads.add(plain.thread_key);
        const threadComments = comments
            .map(toPlainComment)
            .filter((c) => c.group_type === 'thread' && c.thread_key === plain.thread_key);
        units.push({
            type: 'thread',
            threadKey: plain.thread_key,
            comments: threadComments,
        });
    }

    return units;
}

/** Chia đơn vị phân tích thành các chunk (mặc định 10 đơn vị/chunk). */
function chunkAnalysisUnits(units = [], chunkSize = 10) {
    const size = Math.max(Number(chunkSize) || 10, 1);
    const chunks = [];
    let current = [];

    for (const unit of units) {
        if (current.length >= size) {
            chunks.push(current);
            current = [];
        }
        current.push(unit);
    }

    if (current.length > 0) chunks.push(current);
    return chunks;
}

function flattenAnalysisUnits(units = []) {
    return units.flatMap((unit) => unit.comments);
}

module.exports = {
    toCount,
    normalizeYoutubeCommentItem,
    assignThreadKeys,
    finalizePlatformCommentOrder,
    buildGeminiPayload,
    isIncompleteAnalysisRecord,
    groupCommentsIntoAnalysisUnits,
    chunkAnalysisUnits,
    flattenAnalysisUnits,
};
