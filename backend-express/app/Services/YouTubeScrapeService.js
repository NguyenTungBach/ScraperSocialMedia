'use strict';

const createError = require('http-errors');
const youtubeConfig = require('../../config/youtube');
const YouTubeService = require('./YouTubeService');
const ScraperRepository = require('../Repositories/ScraperRepository');
const ChannelRepository = require('../Repositories/ChannelRepository');
const CommentRepository = require('../Repositories/CommentRepository');
const CommentAnalysisService = require('./CommentAnalysisService');
const {
    parseYoutubeChannelRef,
    toYoutubeVideoResponse,
} = require('../Helpers/YouTubeHelper');
const logger = require('../Logging/logger');

class YouTubeScrapeService {
    constructor() {
        this.youtubeService = new YouTubeService();
        this.repository = new ScraperRepository();
        this.channelRepository = new ChannelRepository();
        this.commentRepository = new CommentRepository();
        this.commentAnalysisService = new CommentAnalysisService();
    }

    /**
     * Lấy toàn bộ kênh YouTube (phân trang), hoặc theo channel_id[].
     */
    async resolveYoutubeChannels({ channel_id = [] } = {}) {
        const ids = [...new Set((channel_id || []).map(Number).filter((n) => n > 0))];

        if (ids.length > 0) {
            const channels = await this.channelRepository.findChannelsByIds({
                channel_id: ids,
            });
            const youtubeChannels = channels.filter(
                (ch) => String(ch.type_channel || '').toLowerCase() === 'youtube'
            );
            if (youtubeChannels.length === 0) {
                throw createError(
                    422,
                    'No YouTube channels found — channel_id must have type_channel=youtube'
                );
            }
            if (youtubeChannels.length !== channels.length) {
                throw createError(
                    422,
                    'One or more channel_id are not type_channel=youtube'
                );
            }
            return youtubeChannels;
        }

        const youtubeChannels = [];
        let page = 1;
        const per_page = 100;

        while (true) {
            const { rows, count, page: currentPage, per_page: limit } =
                await this.channelRepository.listChannels({
                    page,
                    per_page,
                    type_channel: 'youtube',
                });
            for (const row of rows) {
                youtubeChannels.push(typeof row.toJSON === 'function' ? row.toJSON() : row);
            }
            const totalPages = Math.max(Math.ceil(count / limit), 1);
            logger.info('[youtube-scrape] Fetched channels page', {
                page: currentPage,
                total_pages: totalPages,
                rows: rows.length,
            });
            if (page >= totalPages || rows.length === 0) break;
            page += 1;
        }

        return youtubeChannels;
    }

    /**
     * Cào video + comment kênh YouTube (cùng luồng POST /scraper/youtube/run).
     */
    async scrapeChannels({ channel_id = [], maxResults } = {}) {
        const youtubeChannels = await this.resolveYoutubeChannels({ channel_id });

        if (youtubeChannels.length === 0) {
            return {
                source: 'youtube_api',
                channels_scraped: 0,
                channels_skipped: [],
                items_count: 0,
                quota_used: 0,
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
                    threads_upserted: 0,
                    videos_with_comments: 0,
                },
                affected_subject_ids: [],
                videos: [],
            };
        }

        const max =
            maxResults != null
                ? Number(maxResults)
                : youtubeConfig.defaultMaxResults;

        const allVideos = [];
        let quotaUsed = 0;
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
            threads_upserted: 0,
            videos_with_comments: 0,
            ai_briefs_analyzed: 0,
            ai_comments_analyzed: 0,
            ai_skipped: 0,
        };
        const channelsSkipped = [];
        const affectedSubjectIds = new Set();
        let channelsScraped = 0;

        for (const channel of youtubeChannels) {
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

            const channelRef = parseYoutubeChannelRef(channel.url);
            if (!channelRef) {
                throw createError(
                    422,
                    `Cannot parse YouTube channel from url (id=${channel.id}): ${channel.url}`
                );
            }

            logger.info('[youtube-scrape] Scraping channel', {
                channel_id: channel.id,
                name: channel.name,
            });

            const { videos, quota_used, follow, videoCount, channelRaw } =
                await this.youtubeService.scrapeChannelByRef(channelRef, {
                    maxResults: max,
                });
            quotaUsed += quota_used || 3;

            await this.channelRepository.updateChannelStats(channel.id, {
                followers: follow || 0,
                post_count: videoCount || 0,
                raw_data: channelRaw || null,
            });

            const ingest = await this.repository.ingestYoutubeItems({
                videos,
                channels: [channel],
                channel,
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
                (ingest.saved_runs || []).map((r) => [r.platform_post_id, r.id])
            );

            for (const video of videos) {
                const scraperRunId = runByVideoId.get(video.platform_post_id);
                if (!scraperRunId) continue;

                try {
                    const { comments, quota_used: commentQuota } =
                        await this.youtubeService.scrapeVideoComments(
                            video.platform_post_id
                        );
                    quotaUsed += commentQuota || 0;

                    if (comments.length > 0) {
                        const commentIngest = await this.commentRepository.ingestAndRebuild(
                            scraperRunId,
                            comments
                        );
                        commentTotals.inserted += commentIngest.inserted || 0;
                        commentTotals.updated += commentIngest.updated || 0;
                        commentTotals.threads_upserted += commentIngest.threads_upserted || 0;
                        commentTotals.videos_with_comments += 1;
                    }
                } catch (commentErr) {
                    // Comment disabled or API error — skip video comments, keep video ingest.
                    if (commentErr.status !== 403) {
                        throw commentErr;
                    }
                }

                const ai =
                    await this.commentAnalysisService.analyzePostAfterScrape(scraperRunId);
                if (ai?.content_brief?.analyzed) commentTotals.ai_briefs_analyzed += 1;
                if (ai?.comments_analysis?.analyzed) {
                    commentTotals.ai_comments_analyzed += 1;
                } else if (ai?.comments_analysis?.reason === 'already_done') {
                    commentTotals.ai_skipped += 1;
                }

                allVideos.push(toYoutubeVideoResponse(video));
            }

            channelsScraped += 1;
        }

        return {
            source: 'youtube_api',
            channels_scraped: channelsScraped,
            channels_skipped: channelsSkipped,
            items_count: allVideos.length,
            quota_used: quotaUsed,
            upsert_stats: upsertTotals,
            comment_stats: commentTotals,
            affected_subject_ids: [...affectedSubjectIds],
            videos: allVideos,
        };
    }
}

module.exports = YouTubeScrapeService;
