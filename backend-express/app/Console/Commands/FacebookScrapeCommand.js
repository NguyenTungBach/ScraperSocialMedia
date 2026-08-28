'use strict';

const createError = require('http-errors');
const apifyConfig = require('../../../config/apify');
const FacebookScrapeService = require('../../Services/FacebookScrapeService');
const ChannelRepository = require('../../Repositories/ChannelRepository');
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

function parseChannelUrls(raw) {
    const value = String(raw || '').trim();
    if (!value) return [];
    return [
        ...new Set(
            value
                .split(/[,;\n]+/)
                .map((s) => s.trim())
                .filter(Boolean)
        ),
    ];
}

/**
 * Cào bài + comment Facebook — mirror TikTok CLI.
 * Chạy: npm run app:facebook-scrape
 * Env: FACEBOOK_CHANNEL_IDS và/hoặc FACEBOOK_CHANNEL_URLS, SCRAPE_MAX_POSTS, …
 * URL được ưu tiên khi set — chỉ cào đúng kênh khớp URL (không scrape all).
 */
class FacebookScrapeCommand {
    static signature = 'app:facebook-scrape';

    static scheduleEnabled = false;

    async handle() {
        const urls = parseChannelUrls(process.env.FACEBOOK_CHANNEL_URLS);
        let channel_id = parseChannelIds(process.env.FACEBOOK_CHANNEL_IDS);

        if (urls.length > 0) {
            const channelRepository = new ChannelRepository();
            const channels = await channelRepository.findChannelsByUrls({
                urls,
                type_channel: 'facebook',
            });
            channel_id = channels.map((ch) => Number(ch.id)).filter((n) => n > 0);
            if (channel_id.length === 0) {
                throw createError(422, 'No Facebook channel matched FACEBOOK_CHANNEL_URLS');
            }
            logger.info('[facebook-scrape] Resolved channel URLs → ids', {
                urls,
                channel_id,
            });
        }

        const maxResults = apifyConfig.facebookResultsLimit;

        const service = new FacebookScrapeService();
        const result = await service.scrapeChannels({ channel_id, maxResults });

        logger.info('[facebook-scrape] Scrape finished', {
            channels_scraped: result.channels_scraped,
            channels_skipped: result.channels_skipped?.length,
            items_count: result.items_count,
            upsert_stats: result.upsert_stats,
            comment_stats: result.comment_stats,
            affected_subject_ids: result.affected_subject_ids,
            posts_run_id: result.posts_run_id,
            comments_run_id: result.comments_run_id,
        });
        return result;
    }
}

module.exports = FacebookScrapeCommand;
