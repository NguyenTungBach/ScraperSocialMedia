'use strict';

const createError = require('http-errors');
const youtubeConfig = require('../../config/youtube');
const { normalizeYoutubeVideo } = require('../Helpers/YouTubeHelper');

class YouTubeService {
    ensureApiKey() {
        if (!youtubeConfig.apiKey) {
            throw createError(
                500,
                'YOUTUBE_API_KEY is not configured. Add it to your .env file.'
            );
        }
    }

    /**
     * GET YouTube Data API v3 endpoint với query params + API key.
     */
    async request(endpoint, params = {}) {
        this.ensureApiKey();

        const url = new URL(`${youtubeConfig.baseUrl}/${endpoint}`);
        url.searchParams.set('key', youtubeConfig.apiKey);
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null || value === '') continue;
            url.searchParams.set(key, String(value));
        }

        const response = await fetch(url.toString(), { method: 'GET' });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw this.mapYoutubeError(response.status, payload);
        }

        return payload;
    }

    mapYoutubeError(status, payload) {
        const reason = payload?.error?.errors?.[0]?.reason || '';
        const message =
            payload?.error?.message ||
            `YouTube API error (HTTP ${status}${reason ? `: ${reason}` : ''})`;

        if (reason === 'channelNotFound' || status === 404) {
            return createError(404, message);
        }
        if (reason === 'quotaExceeded' || status === 429) {
            return createError(429, message);
        }
        if (reason === 'keyInvalid' || reason === 'keyExpired') {
            return createError(500, `YouTube API key invalid: ${message}`);
        }
        return createError(status >= 400 && status < 600 ? status : 502, message);
    }

    normalizeHandle(handle) {
        const raw = String(handle || '').trim();
        if (!raw) return '';
        return raw.startsWith('@') ? raw.slice(1) : raw;
    }

    /**
     * channels.list → uploads playlist ID + subscriberCount (quota 1).
     */
    async getUploadsPlaylistId(handle) {
        const forHandle = this.normalizeHandle(handle);
        if (!forHandle) {
            throw createError(422, 'YouTube handle is required');
        }

        const data = await this.request('channels', {
            part: 'contentDetails,statistics',
            forHandle,
        });

        const channel = data?.items?.[0];
        const uploadsId =
            channel?.contentDetails?.relatedPlaylists?.uploads || null;

        if (!uploadsId) {
            throw createError(
                404,
                `YouTube channel not found or has no uploads playlist: @${forHandle}`
            );
        }

        const subscriberCount = Number(channel?.statistics?.subscriberCount ?? 0);

        return {
            channelId: channel.id,
            uploadsPlaylistId: uploadsId,
            follow: Number.isFinite(subscriberCount) ? Math.max(0, Math.floor(subscriberCount)) : 0,
        };
    }

    /**
     * playlistItems.list → video IDs mới nhất (quota 1).
     */
    async getPlaylistVideoIds(playlistId, maxResults = 10) {
        const limit = Math.min(Math.max(Number(maxResults) || 10, 1), 50);
        const data = await this.request('playlistItems', {
            part: 'snippet',
            playlistId,
            maxResults: limit,
        });

        const ids = [];
        for (const item of data?.items || []) {
            const videoId = item?.snippet?.resourceId?.videoId;
            if (videoId) ids.push(videoId);
        }
        return ids;
    }

    /**
     * videos.list batch → snippet + statistics (quota 1).
     */
    async getVideoDetails(videoIds = []) {
        const ids = [...new Set((videoIds || []).filter(Boolean))];
        if (ids.length === 0) return [];

        const data = await this.request('videos', {
            part: 'snippet,statistics',
            id: ids.join(','),
        });

        return data?.items || [];
    }

    /**
     * Orchestrate 3 bước API → mảng video đã normalize.
     * @returns {{ videos: object[], quota_used: number, channelId: string, uploadsPlaylistId: string }}
     */
    async scrapeChannelByHandle(handle, { maxResults } = {}) {
        const limit =
            maxResults != null
                ? Math.min(Math.max(Number(maxResults) || 10, 1), 50)
                : youtubeConfig.defaultMaxResults;

        const { channelId, uploadsPlaylistId, follow } =
            await this.getUploadsPlaylistId(handle);
        const videoIds = await this.getPlaylistVideoIds(uploadsPlaylistId, limit);
        const rawVideos = await this.getVideoDetails(videoIds);

        // Giữ thứ tự playlist (mới nhất trước)
        const byId = new Map(rawVideos.map((v) => [v.id, v]));
        const ordered = videoIds.map((id) => byId.get(id)).filter(Boolean);

        const videos = ordered.map((item) =>
            normalizeYoutubeVideo(item, { follow: follow || 0 })
        );

        return {
            videos,
            quota_used: 3,
            channelId,
            uploadsPlaylistId,
            follow: follow || 0,
        };
    }

    /**
     * commentThreads.list → top-level comments (quota 1).
     */
    async getCommentThreads(videoId, maxResults = 20) {
        const limit = Math.min(Math.max(Number(maxResults) || 20, 1), 100);
        try {
            const data = await this.request('commentThreads', {
                part: 'snippet,replies',
                videoId,
                maxResults: limit,
                order: 'relevance',
                textFormat: 'plainText',
            });
            return data?.items || [];
        } catch (err) {
            if (err.status === 403 || err.message?.includes('commentsDisabled')) {
                return [];
            }
            throw err;
        }
    }

    /**
     * comments.list → replies of a top-level comment (quota 1).
     */
    async getCommentReplies(parentId, maxResults = 10) {
        const limit = Math.min(Math.max(Number(maxResults) || 10, 1), 100);
        const data = await this.request('comments', {
            part: 'snippet',
            parentId,
            maxResults: limit,
            textFormat: 'plainText',
        });
        return data?.items || [];
    }

    /**
     * Scrape comments for one video: maxTop top-level + maxReplies per thread.
     * @returns {{ comments: object[], quota_used: number, disabled: boolean }}
     */
    async scrapeVideoComments(videoId, { maxTop, maxReplies } = {}) {
        const topLimit = maxTop ?? youtubeConfig.maxTopComments;
        const replyLimit = maxReplies ?? youtubeConfig.maxReplies;
        let quotaUsed = 0;

        const threads = await this.getCommentThreads(videoId, topLimit);
        quotaUsed += 1;

        if (threads.length === 0) {
            return { comments: [], quota_used: quotaUsed, disabled: false };
        }

        const { normalizeYoutubeCommentItem, assignThreadKeys } = require('../Helpers/CommentHelper');
        const flat = [];
        let sortOrder = 0;

        for (const thread of threads) {
            const top = normalizeYoutubeCommentItem(thread, { sortOrder: sortOrder++ });
            if (!top) continue;

            const topId = top.platform_comment_id;
            top.thread_key = topId;
            top.parent_platform_comment_id = null;
            flat.push(top);

            const embedded = thread?.replies?.comments || [];
            const embeddedNormalized = [];
            for (const reply of embedded) {
                const row = normalizeYoutubeCommentItem(reply, {
                    parentId: topId,
                    threadKey: topId,
                    sortOrder: sortOrder++,
                });
                if (row) embeddedNormalized.push(row);
            }
            flat.push(...embeddedNormalized);

            const totalReplies = toCount(thread?.snippet?.totalReplyCount);
            if (totalReplies > embeddedNormalized.length && embeddedNormalized.length < replyLimit) {
                const extra = await this.getCommentReplies(topId, replyLimit);
                quotaUsed += 1;
                const existingIds = new Set(flat.map((c) => c.platform_comment_id));
                for (const reply of extra) {
                    if (existingIds.has(reply.id)) continue;
                    const row = normalizeYoutubeCommentItem(reply, {
                        parentId: topId,
                        threadKey: topId,
                        sortOrder: sortOrder++,
                    });
                    if (row) {
                        flat.push(row);
                        existingIds.add(row.platform_comment_id);
                    }
                    if (flat.filter((c) => c.parent_platform_comment_id === topId).length >= replyLimit) {
                        break;
                    }
                }
            } else if (embeddedNormalized.length > replyLimit) {
                const keepIds = new Set(
                    embeddedNormalized.slice(0, replyLimit).map((c) => c.platform_comment_id)
                );
                for (let i = flat.length - 1; i >= 0; i -= 1) {
                    if (
                        flat[i].parent_platform_comment_id === topId &&
                        !keepIds.has(flat[i].platform_comment_id)
                    ) {
                        flat.splice(i, 1);
                    }
                }
            }
        }

        assignThreadKeys(flat);
        return { comments: flat, quota_used: quotaUsed, disabled: false };
    }
}

function toCount(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
}

module.exports = YouTubeService;
