'use strict';

const createError = require('http-errors');
const db = require('../Models');
const { normalizePlatform } = require('../Helpers/PostScoreHelper');
const { normalizeTikTokItem } = require('../Helpers/TikTokHelper');
const YouTubeService = require('./YouTubeService');
const ApifyService = require('./ApifyService');
const ScraperRepository = require('../Repositories/ScraperRepository');
const logger = require('../Logging/logger');

class PostRefreshService {
    constructor() {
        this.youtubeService = new YouTubeService();
        this.apifyService = new ApifyService();
        this.repository = new ScraperRepository();
    }

    /**
     * Cào lại metrics 1 bài — reuse ingest*Items như cào kênh (upsert nếu đã có).
     * @param {number} scraperRunId
     */
    async refreshPost(scraperRunId) {
        const id = Number(scraperRunId);
        if (!Number.isInteger(id) || id <= 0) {
            throw createError(422, 'scraper_run_id is required');
        }

        const run = await db.ScraperRun.findByPk(id, {
            include: [{ model: db.Channel, as: 'channel' }],
        });
        if (!run) {
            throw createError(404, 'scraper_run not found');
        }

        const plain = run.get ? run.get({ plain: true }) : run;
        const platform = normalizePlatform(plain.platform);
        const channel = plain.channel || null;

        if (!channel?.id) {
            throw createError(422, 'Post has no linked channel — cannot refresh');
        }

        const channelPlain = channel.get ? channel.get({ plain: true }) : channel;
        const channels = [channelPlain];

        logger.info('[post-refresh] start', {
            scraper_run_id: id,
            platform,
            platform_post_id: plain.platform_post_id,
            channel_id: channelPlain.id,
        });

        let ingest;

        if (platform === 'youtube') {
            ingest = await this.refreshYoutubePost(plain, channelPlain, channels);
        } else if (platform === 'facebook') {
            ingest = await this.refreshFacebookPost(plain, channelPlain, channels);
        } else if (platform === 'tiktok') {
            ingest = await this.refreshTikTokPost(plain, channelPlain, channels);
        } else {
            throw createError(422, `Unsupported platform for post refresh: ${plain.platform}`);
        }

        const result = {
            source: 'post_refresh',
            platform,
            scraper_run_id: id,
            channels_scraped: 0,
            channels_skipped: [],
            items_count: ingest?.items_saved ?? ingest?.upsert_stats
                ? (ingest.upsert_stats.inserted || 0) + (ingest.upsert_stats.updated || 0)
                : 0,
            upsert_stats: ingest?.upsert_stats ?? null,
            affected_subject_ids: ingest?.affected_subject_ids ?? [],
        };

        logger.info('[post-refresh] done', {
            scraper_run_id: id,
            platform,
            updated: result.upsert_stats?.updated ?? 0,
            inserted: result.upsert_stats?.inserted ?? 0,
        });

        return result;
    }

    async refreshYoutubePost(run, channel, channels) {
        const videoId = String(run.platform_post_id || '').trim();
        if (!videoId) {
            throw createError(422, 'YouTube post missing platform_post_id');
        }

        const rawVideos = await this.youtubeService.getVideoDetails([videoId]);
        const item = (rawVideos || [])[0];
        if (!item) {
            throw createError(422, 'YouTube video not found or unavailable');
        }

        return this.repository.ingestYoutubeItems({
            videos: [item],
            channels,
            channel,
        });
    }

    async refreshFacebookPost(run, channel, channels) {
        const postUrl = String(run.post_url || '').trim();
        if (!postUrl) {
            throw createError(422, 'Facebook post missing post_url');
        }

        const { run: apifyRun, items } = await this.apifyService.runFacebookScraper({
            startUrls: [postUrl],
            resultsLimit: 1,
        });

        const rawItems = (items || []).filter(Boolean);
        if (rawItems.length === 0) {
            throw createError(422, 'Không lấy được dữ liệu bài từ Facebook');
        }

        return this.repository.ingestApifyItems({
            run: apifyRun,
            items: rawItems,
            channels,
        });
    }

    async refreshTikTokPost(run, channel, channels) {
        const postUrl = String(run.post_url || '').trim();
        if (!postUrl) {
            throw createError(422, 'TikTok post missing post_url');
        }

        const { run: apifyRun, items } = await this.apifyService.runTikTokVideoScraper({
            postURLs: [postUrl],
            resultsPerPage: 1,
            scrapeRelatedVideos: false,
        });

        const rawItems = (items || []).filter((item) => item && !item.error);
        if (rawItems.length === 0) {
            throw createError(422, 'Không lấy được dữ liệu bài từ TikTok');
        }

        const videos = rawItems.map((item) => normalizeTikTokItem(item)).filter(Boolean);
        if (videos.length === 0) {
            throw createError(422, 'TikTok response could not be normalized');
        }

        return this.repository.ingestTikTokItems({
            videos,
            channels,
            channel,
            run: apifyRun,
        });
    }
}

module.exports = PostRefreshService;
