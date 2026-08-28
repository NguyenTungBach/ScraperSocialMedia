'use strict';

const youtubeConfig = require('../../../config/youtube');
const YouTubeScrapeService = require('../../Services/YouTubeScrapeService');
const logger = require('../../Logging/logger');

function parseChannelIds(raw) {
    const value = String(raw || '').trim();
    if (!value) return [];
    return [
        ...new Set(
            value
                .split(/[,;\s]+/)
                .map((s) => Number(s.trim()))
                .filter((n) => Number.isInteger(n) && n > 0)
        ),
    ];
}

/**
 * Cào video YouTube — chạy trực tiếp trên GitHub runner (không gọi API Render).
 * Chạy: npm run app:youtube-scrape
 * Env tuỳ chọn: YOUTUBE_CHANNEL_IDS (vd. 1,2,3 — trống = tất cả kênh youtube),
 *   SCRAPE_MAX_POSTS
 */
class YoutubeScrapeCommand {
    static signature = 'app:youtube-scrape';

    static scheduleEnabled = false;

    async handle() {
        const channel_id = parseChannelIds(process.env.YOUTUBE_CHANNEL_IDS);
        const maxResults = youtubeConfig.defaultMaxResults;

        const service = new YouTubeScrapeService();
        const result = await service.scrapeChannels({ channel_id, maxResults });

        logger.info('[youtube-scrape] Scrape finished', {
            channels_scraped: result.channels_scraped,
            channels_skipped: result.channels_skipped?.length,
            items_count: result.items_count,
            quota_used: result.quota_used,
            upsert_stats: result.upsert_stats,
            comment_stats: result.comment_stats,
            affected_subject_ids: result.affected_subject_ids,
        });
        return result;
    }
}

module.exports = YoutubeScrapeCommand;
