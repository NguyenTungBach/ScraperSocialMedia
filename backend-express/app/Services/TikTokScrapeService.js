'use strict';

const createError = require('http-errors');
const apifyConfig = require('../../config/apify');
const ApifyService = require('./ApifyService');
const ScraperRepository = require('../Repositories/ScraperRepository');
const ChannelRepository = require('../Repositories/ChannelRepository');
const CommentRepository = require('../Repositories/CommentRepository');
const {
    normalizeTikTokItem,
    normalizeTikTokCommentItems,
    normalizeTikTokPostUrl,
    extractVideoIdFromUrl,
    toTikTokVideoResponse,
} = require('../Helpers/TikTokHelper');
const logger = require('../Logging/logger');

class TikTokScrapeService {
    constructor() {
        this.apifyService = new ApifyService();
        this.repository = new ScraperRepository();
        this.channelRepository = new ChannelRepository();
        this.commentRepository = new CommentRepository();
    }

    async resolveTikTokChannels({ channel_id = [] } = {}) {
        const ids = [...new Set((channel_id || []).map(Number).filter((n) => n > 0))];

        if (ids.length > 0) {
            const channels = await this.channelRepository.findChannelsByIds({
                channel_id: ids,
            });
            const tiktokChannels = channels.filter(
                (ch) => String(ch.type_channel || '').toLowerCase() === 'tiktok'
            );
            if (tiktokChannels.length === 0) {
                throw createError(
                    422,
                    'No TikTok channels found — channel_id must have type_channel=tiktok'
                );
            }
            if (tiktokChannels.length !== channels.length) {
                throw createError(
                    422,
                    'One or more channel_id are not type_channel=tiktok'
                );
            }
            return tiktokChannels;
        }

        const tiktokChannels = [];
        let page = 1;
        const per_page = 100;

        while (true) {
            const { rows, count, page: currentPage, per_page: limit } =
                await this.channelRepository.listChannels({
                    page,
                    per_page,
                    type_channel: 'tiktok',
                });
            for (const row of rows) {
                tiktokChannels.push(typeof row.toJSON === 'function' ? row.toJSON() : row);
            }
            const totalPages = Math.max(Math.ceil(count / limit), 1);
            if (page >= totalPages || rows.length === 0) break;
            page += 1;
        }

        return tiktokChannels;
    }

    /**
     * 1 API flow: latest N videos (upsert) + comments 30 / replies 10 (insert-only).
     */
    async scrapeChannels({
        channel_id = [],
        maxResults,
        commentsPerPost,
        maxRepliesPerComment,
    } = {}) {
        const tiktokChannels = await this.resolveTikTokChannels({ channel_id });

        const empty = {
            source: 'apify',
            platform: 'tiktok',
            channels_scraped: 0,
            channels_skipped: [],
            items_count: 0,
            upsert_stats: {
                inserted: 0,
                updated: 0,
                skipped: 0,
                links_created: 0,
                unmatched_channel: 0,
            },
            comment_stats: {
                inserted: 0,
                updated: 0,
                skipped: 0,
                threads_upserted: 0,
                videos_with_comments: 0,
            },
            affected_subject_ids: [],
            videos: [],
            video_run_id: null,
            comments_run_id: null,
        };

        if (tiktokChannels.length === 0) {
            return empty;
        }

        const resultsPerPage =
            maxResults != null ? Number(maxResults) : apifyConfig.tiktokResultsPerPage;

        const upsertTotals = {
            inserted: 0,
            updated: 0,
            skipped: 0,
            links_created: 0,
            unmatched_channel: 0,
        };
        const commentTotals = {
            inserted: 0,
            updated: 0,
            skipped: 0,
            threads_upserted: 0,
            videos_with_comments: 0,
        };
        const channelsSkipped = [];
        const affectedSubjectIds = new Set();
        const allVideos = [];
        let channelsScraped = 0;
        let videoRunId = null;
        let commentsRunId = null;

        for (const channel of tiktokChannels) {
            const linkedSubjectIds = await this.channelRepository.listSubjectIdsForChannel(
                channel.id
            );
            if (linkedSubjectIds.length === 0) {
                channelsSkipped.push({
                    channel_id: channel.id,
                    name: channel.name,
                    reason: 'no_subject_link',
                });
                continue;
            }

            if (!channel.url) {
                throw createError(
                    422,
                    `TikTok channel missing url (id=${channel.id})`
                );
            }

            logger.info('[tiktok-scrape] Scraping videos', {
                channel_id: channel.id,
                name: channel.name,
                url: channel.url,
            });

            const { run: videoRun, items: rawVideos } =
                await this.apifyService.runTikTokVideoScraper({
                    profiles: [channel.url],
                    resultsPerPage,
                });
            videoRunId = videoRun?.id || videoRunId;

            const authorMeta =
                (rawVideos || []).find((item) => item?.authorMeta)?.authorMeta || null;
            if (authorMeta) {
                await this.channelRepository.updateChannelStats(channel.id, {
                    followers: authorMeta.fans ?? authorMeta.followers ?? 0,
                    post_count: authorMeta.video ?? 0,
                    raw_data: authorMeta,
                });
            }

            const videos = (rawVideos || [])
                .map((item) => normalizeTikTokItem(item))
                .filter((v) => v?.platform_post_id);

            const ingest = await this.repository.ingestTikTokItems({
                videos,
                channels: [channel],
                channel,
                run: videoRun,
            });

            upsertTotals.inserted += ingest.upsert_stats.inserted;
            upsertTotals.updated += ingest.upsert_stats.updated;
            upsertTotals.skipped += ingest.upsert_stats.skipped;
            upsertTotals.links_created += ingest.upsert_stats.links_created;
            upsertTotals.unmatched_channel += ingest.upsert_stats.unmatched_channel;

            for (const sid of ingest.affected_subject_ids || []) {
                affectedSubjectIds.add(sid);
            }

            const runByVideoId = new Map(
                (ingest.saved_runs || []).map((r) => [String(r.platform_post_id), r])
            );
            const postURLs = [];
            for (const video of videos) {
                const url = normalizeTikTokPostUrl(video.post_url);
                if (url) postURLs.push(url);
                allVideos.push(toTikTokVideoResponse(video));
            }

            if (postURLs.length === 0) {
                channelsScraped += 1;
                continue;
            }

            logger.info('[tiktok-scrape] Scraping comments', {
                channel_id: channel.id,
                post_count: postURLs.length,
            });

            const { run: commentsRun, items: rawComments } =
                await this.apifyService.runTikTokCommentsScraper({
                    postURLs,
                    commentsPerPost:
                        commentsPerPost ?? apifyConfig.tiktokCommentsPerPost,
                    maxRepliesPerComment:
                        maxRepliesPerComment ?? apifyConfig.tiktokMaxRepliesPerComment,
                });
            commentsRunId = commentsRun?.id || commentsRunId;

            const comments = normalizeTikTokCommentItems(rawComments || []);
            const byVideoId = new Map();
            for (const comment of comments) {
                const vid =
                    extractVideoIdFromUrl(comment.video_web_url) ||
                    extractVideoIdFromUrl(comment.raw_data?.videoWebUrl);
                if (!vid) continue;
                const bucket = byVideoId.get(vid) || [];
                bucket.push(comment);
                byVideoId.set(vid, bucket);
            }

            for (const [videoId, videoComments] of byVideoId) {
                const saved = runByVideoId.get(String(videoId));
                if (!saved?.id || videoComments.length === 0) continue;

                const commentIngest = await this.commentRepository.ingestAndRebuild(
                    saved.id,
                    videoComments,
                    { insertOnly: true }
                );
                commentTotals.inserted += commentIngest.inserted || 0;
                commentTotals.updated += commentIngest.updated || 0;
                commentTotals.skipped += commentIngest.skipped || 0;
                commentTotals.threads_upserted += commentIngest.threads_upserted || 0;
                if ((commentIngest.inserted || 0) > 0 || (commentIngest.skipped || 0) > 0) {
                    commentTotals.videos_with_comments += 1;
                }
            }

            channelsScraped += 1;
        }

        return {
            source: 'apify',
            platform: 'tiktok',
            channels_scraped: channelsScraped,
            channels_skipped: channelsSkipped,
            items_count: allVideos.length,
            upsert_stats: upsertTotals,
            comment_stats: commentTotals,
            affected_subject_ids: [...affectedSubjectIds],
            videos: allVideos,
            video_run_id: videoRunId,
            comments_run_id: commentsRunId,
        };
    }
}

module.exports = TikTokScrapeService;
