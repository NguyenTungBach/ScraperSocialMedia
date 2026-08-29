'use strict';

const createError = require('http-errors');
const apifyConfig = require('../../config/apify');
const ApifyService = require('./ApifyService');
const ScraperRepository = require('../Repositories/ScraperRepository');
const ChannelRepository = require('../Repositories/ChannelRepository');
const CommentRepository = require('../Repositories/CommentRepository');
const {
    normalizeFacebookPostUrl,
    normalizeFacebookCommentItems,
    toFacebookPostResponse,
} = require('../Helpers/FacebookHelper');
const { normalizeApifyItem } = require('../Helpers/PostScoreHelper');
const logger = require('../Logging/logger');

class FacebookScrapeService {
    constructor() {
        this.apifyService = new ApifyService();
        this.repository = new ScraperRepository();
        this.channelRepository = new ChannelRepository();
        this.commentRepository = new CommentRepository();
    }

    async resolveFacebookChannels({ channel_id = [] } = {}) {
        const ids = [...new Set((channel_id || []).map(Number).filter((n) => n > 0))];

        if (ids.length > 0) {
            const channels = await this.channelRepository.findChannelsByIds({
                channel_id: ids,
            });
            const facebookChannels = channels.filter(
                (ch) => String(ch.type_channel || '').toLowerCase() === 'facebook'
            );
            if (facebookChannels.length === 0) {
                throw createError(
                    422,
                    'No Facebook channels found — channel_id must have type_channel=facebook'
                );
            }
            if (facebookChannels.length !== channels.length) {
                throw createError(
                    422,
                    'One or more channel_id are not type_channel=facebook'
                );
            }
            return facebookChannels;
        }

        const facebookChannels = [];
        let page = 1;
        const per_page = 100;

        while (true) {
            const { rows, count, page: currentPage, per_page: limit } =
                await this.channelRepository.listChannels({
                    page,
                    per_page,
                    type_channel: 'facebook',
                });
            for (const row of rows) {
                facebookChannels.push(
                    typeof row.toJSON === 'function' ? row.toJSON() : row
                );
            }
            const totalPages = Math.max(Math.ceil(count / limit), 1);
            if (page >= totalPages || rows.length === 0) break;
            page += 1;
        }

        return facebookChannels;
    }

    /**
     * 1 API flow: latest N posts (upsert) + comments (insert-only).
     */
    async scrapeChannels({
        channel_id = [],
        maxResults,
        commentsPerPost,
        maxRepliesPerComment,
    } = {}) {
        const facebookChannels = await this.resolveFacebookChannels({ channel_id });

        const empty = {
            source: 'apify',
            platform: 'facebook',
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
                posts_with_comments: 0,
            },
            affected_subject_ids: [],
            posts: [],
            posts_run_id: null,
            comments_run_id: null,
        };

        if (facebookChannels.length === 0) {
            return empty;
        }

        const resultsLimit =
            maxResults != null ? Number(maxResults) : apifyConfig.facebookResultsLimit;

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
            posts_with_comments: 0,
        };
        const channelsSkipped = [];
        const affectedSubjectIds = new Set();
        const allPosts = [];
        let channelsScraped = 0;
        let postsRunId = null;
        let commentsRunId = null;

        for (const channel of facebookChannels) {
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
                    `Facebook channel missing url (id=${channel.id})`
                );
            }

            logger.info('[facebook-scrape] Scraping page profile', {
                channel_id: channel.id,
                name: channel.name,
                url: channel.url,
            });

            try {
                const { items: pageItems } =
                    await this.apifyService.runFacebookPagesScraper({
                        startUrls: [channel.url],
                    });
                const page = (pageItems || [])[0] || null;
                if (page) {
                    await this.channelRepository.updateChannelStats(channel.id, {
                        followers: page.followers ?? page.likes ?? 0,
                        post_count: 0,
                        raw_data: page,
                    });
                }
            } catch (pageErr) {
                logger.warn('[facebook-scrape] Page profile scrape failed', {
                    channel_id: channel.id,
                    message: pageErr.message,
                });
            }

            logger.info('[facebook-scrape] Scraping posts', {
                channel_id: channel.id,
                name: channel.name,
                url: channel.url,
            });

            const { run: postsRun, items: rawPosts } =
                await this.apifyService.runFacebookScraper({
                    startUrls: [channel.url],
                    resultsLimit,
                });
            postsRunId = postsRun?.id || postsRunId;

            const posts = (rawPosts || [])
                .map((item) => normalizeApifyItem(item))
                .filter((p) => p?.platform_post_id);

            const ingest = await this.repository.ingestApifyItems({
                run: postsRun,
                items: rawPosts || [],
                channels: [channel],
            });

            upsertTotals.inserted += ingest.upsert_stats.inserted;
            upsertTotals.updated += ingest.upsert_stats.updated;
            upsertTotals.skipped += ingest.upsert_stats.skipped;
            upsertTotals.links_created += ingest.upsert_stats.links_created;
            upsertTotals.unmatched_channel += ingest.upsert_stats.unmatched_channel;

            for (const sid of ingest.affected_subject_ids || []) {
                affectedSubjectIds.add(sid);
            }

            const runByPostKey = new Map();
            for (const row of ingest.saved_runs || []) {
                if (row.platform_post_id) {
                    runByPostKey.set(`id:${row.platform_post_id}`, row);
                }
                const normUrl = normalizeFacebookPostUrl(row.post_url);
                if (normUrl) {
                    runByPostKey.set(`url:${normUrl}`, row);
                }
            }

            const postURLs = [];
            for (const post of posts) {
                const url = normalizeFacebookPostUrl(post.post_url);
                if (url) postURLs.push(url);
                allPosts.push(toFacebookPostResponse(post));
            }

            if (postURLs.length === 0) {
                channelsScraped += 1;
                continue;
            }

            logger.info('[facebook-scrape] Scraping comments', {
                channel_id: channel.id,
                post_count: postURLs.length,
            });

            const { run: commentsRun, items: rawComments } =
                await this.apifyService.runFacebookCommentsScraper({
                    postURLs,
                    commentsPerPost:
                        commentsPerPost ?? apifyConfig.facebookCommentsPerPost,
                    maxRepliesPerComment:
                        maxRepliesPerComment ?? apifyConfig.facebookMaxRepliesPerComment,
                });
            commentsRunId = commentsRun?.id || commentsRunId;

            const comments = normalizeFacebookCommentItems(rawComments || []);
            const byPostKey = new Map();
            for (const comment of comments) {
                const keys = [];
                if (comment.facebook_post_id) {
                    keys.push(`id:${comment.facebook_post_id}`);
                }
                if (comment.post_url) {
                    keys.push(`url:${comment.post_url}`);
                }
                for (const key of keys) {
                    const bucket = byPostKey.get(key) || [];
                    bucket.push(comment);
                    byPostKey.set(key, bucket);
                }
            }

            const ingestedRunIds = new Set();
            for (const [key, postComments] of byPostKey) {
                const saved = runByPostKey.get(key);
                if (!saved?.id || postComments.length === 0) continue;
                if (ingestedRunIds.has(saved.id)) continue;
                ingestedRunIds.add(saved.id);

                const commentIngest = await this.commentRepository.ingestAndRebuild(
                    saved.id,
                    postComments,
                    { insertOnly: true }
                );
                commentTotals.inserted += commentIngest.inserted || 0;
                commentTotals.updated += commentIngest.updated || 0;
                commentTotals.skipped += commentIngest.skipped || 0;
                commentTotals.threads_upserted += commentIngest.threads_upserted || 0;
                if ((commentIngest.inserted || 0) > 0 || (commentIngest.skipped || 0) > 0) {
                    commentTotals.posts_with_comments += 1;
                }
            }

            channelsScraped += 1;
        }

        return {
            source: 'apify',
            platform: 'facebook',
            channels_scraped: channelsScraped,
            channels_skipped: channelsSkipped,
            items_count: allPosts.length,
            upsert_stats: upsertTotals,
            comment_stats: commentTotals,
            affected_subject_ids: [...affectedSubjectIds],
            posts: allPosts,
            posts_run_id: postsRunId,
            comments_run_id: commentsRunId,
        };
    }
}

module.exports = FacebookScrapeService;
