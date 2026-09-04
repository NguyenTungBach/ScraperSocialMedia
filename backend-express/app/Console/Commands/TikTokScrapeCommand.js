'use strict';

const createError = require('http-errors');
const TikTokScrapeService = require('../../Services/TikTokScrapeService');
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
 * Cào video + comment TikTok — mirror YouTube CLI.
 * Chạy: npm run app:tiktok-scrape
 * Env: TIKTOK_CHANNEL_IDS và/hoặc TIKTOK_CHANNEL_URLS
 * Limit cào lấy từ channels.max_posts / max_top_comments / max_replies.
 * URL được ưu tiên khi set — chỉ cào đúng kênh khớp URL (không scrape all).
 */
class TikTokScrapeCommand {
    static signature = 'app:tiktok-scrape';

    static scheduleEnabled = false;

    async handle() {
        const urls = parseChannelUrls(process.env.TIKTOK_CHANNEL_URLS);
        let channel_id = parseChannelIds(process.env.TIKTOK_CHANNEL_IDS);

        if (urls.length > 0) {
            const channelRepository = new ChannelRepository();
            const channels = await channelRepository.findChannelsByUrls({
                urls,
                type_channel: 'tiktok',
            });
            channel_id = channels.map((ch) => Number(ch.id)).filter((n) => n > 0);
            if (channel_id.length === 0) {
                throw createError(422, 'No TikTok channel matched TIKTOK_CHANNEL_URLS');
            }
            logger.info('[tiktok-scrape] Resolved channel URLs → ids', {
                urls,
                channel_id,
            });
        }

        const service = new TikTokScrapeService();
        const result = await service.scrapeChannels({ channel_id });

        logger.info('[tiktok-scrape] Scrape finished', {
            channels_scraped: result.channels_scraped,
            channels_skipped: result.channels_skipped?.length,
            items_count: result.items_count,
            upsert_stats: result.upsert_stats,
            comment_stats: result.comment_stats,
            affected_subject_ids: result.affected_subject_ids,
            video_run_id: result.video_run_id,
            comments_run_id: result.comments_run_id,
        });
        return result;
    }
}

module.exports = TikTokScrapeCommand;
