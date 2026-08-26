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
     * channels.list → uploads playlist ID (quota 1).
     */
    async getUploadsPlaylistId(handle) {
        const forHandle = this.normalizeHandle(handle);
        if (!forHandle) {
            throw createError(422, 'YouTube handle is required');
        }

        const data = await this.request('channels', {
            part: 'contentDetails',
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

        return {
            channelId: channel.id,
            uploadsPlaylistId: uploadsId,
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

        const { channelId, uploadsPlaylistId } =
            await this.getUploadsPlaylistId(handle);
        const videoIds = await this.getPlaylistVideoIds(uploadsPlaylistId, limit);
        const rawVideos = await this.getVideoDetails(videoIds);

        // Giữ thứ tự playlist (mới nhất trước)
        const byId = new Map(rawVideos.map((v) => [v.id, v]));
        const ordered = videoIds.map((id) => byId.get(id)).filter(Boolean);

        const videos = ordered.map((item) => normalizeYoutubeVideo(item));

        return {
            videos,
            quota_used: 3,
            channelId,
            uploadsPlaylistId,
        };
    }
}

module.exports = YouTubeService;
