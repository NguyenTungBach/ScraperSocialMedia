'use strict';

const { ApifyClient } = require('apify-client');
const createError = require('http-errors');
const apifyConfig = require('../../config/apify');
const { fireServiceFailureAlert } = require('./ServiceFailureAlertService');
const logger = require('../Logging/logger');

class ApifyService {
    constructor() {
        this.facebookActorId = apifyConfig.facebookActorId;
        this.facebookPagesActorId = apifyConfig.facebookPagesActorId;
        this.facebookCommentsActorId = apifyConfig.facebookCommentsActorId;
        this.defaultInput = apifyConfig.defaultInput;
        this.tiktokActorId = apifyConfig.tiktokActorId;
        this.tiktokCommentsActorId = apifyConfig.tiktokCommentsActorId;
        /** @deprecated dùng facebookActorId */
        this.actorId = this.facebookActorId;
    }

    getClient() {
        if (!apifyConfig.token) {
            const err = createError(
                500,
                'APIFY_API_TOKEN is not configured. Set it in Admin → Settings (key_scraps).'
            );
            logger.error('[apify] missing token', { operation: 'getClient' });
            fireServiceFailureAlert(err, {
                service: 'Apify',
                operation: 'getClient',
                source: 'Apify',
            });
            throw err;
        }
        return new ApifyClient({ token: apifyConfig.token });
    }

    async runWithAlert(operation, fn) {
        try {
            return await fn();
        } catch (error) {
            logger.error('[apify] request failed', {
                operation,
                message: error?.message,
            });
            fireServiceFailureAlert(error, {
                service: 'Apify',
                operation,
                source: 'Apify',
            });
            throw error;
        }
    }

    buildInput(overrides = {}) {
        const input = {
            ...this.defaultInput,
            ...overrides,
        };

        if (Array.isArray(overrides.startUrls)) {
            input.startUrls = overrides.startUrls.map((item) =>
                typeof item === 'string' ? { url: item } : item
            );
        }

        return input;
    }

    /**
     * Chạy Actor Facebook Posts scraper trên Apify và chờ hoàn thành.
     * @returns {{ run: object, items: object[], input: object }}
     */
    async runFacebookScraper(overrides = {}) {
        return this.runWithAlert('runFacebookScraper', async () => {
            const client = this.getClient();
            const input = this.buildInput(overrides);

            const run = await client.actor(this.facebookActorId).call(input);
            const { items } = await client.dataset(run.defaultDatasetId).listItems({
                limit: 1000,
            });

            return { run, items, input };
        });
    }

    /**
     * Facebook Pages Scraper — metadata page (followers, likes, intro…).
     * @param {{ startUrls?: Array<string|{url:string}> }} overrides
     */
    async runFacebookPagesScraper(overrides = {}) {
        const startUrls = (overrides.startUrls || [])
            .map((item) => (typeof item === 'string' ? { url: item } : item))
            .filter((item) => item?.url);

        if (startUrls.length === 0) {
            return { run: null, items: [], input: null };
        }

        return this.runWithAlert('runFacebookPagesScraper', async () => {
            const client = this.getClient();
            const input = {
                startUrls,
                maxPages: startUrls.length,
            };

            const run = await client.actor(this.facebookPagesActorId).call(input);
            const { items } = await client.dataset(run.defaultDatasetId).listItems({
                limit: 100,
            });

            return { run, items, input };
        });
    }

    /**
     * Scrape comments (+ nested replies) cho danh sách post URLs Facebook.
     */
    async runFacebookCommentsScraper(overrides = {}) {
        const postURLs = (overrides.postURLs || [])
            .map((u) => (typeof u === 'string' ? u : u?.url))
            .filter(Boolean);

        if (postURLs.length === 0) {
            return { run: null, items: [], input: null };
        }

        return this.runWithAlert('runFacebookCommentsScraper', async () => {
            const client = this.getClient();
            const commentsPerPost =
                overrides.commentsPerPost ?? apifyConfig.facebookCommentsPerPost;
            const maxReplies =
                overrides.maxRepliesPerComment ?? apifyConfig.facebookMaxRepliesPerComment;

            const resultsLimit = Number(commentsPerPost);
            if (!Number.isFinite(resultsLimit) || resultsLimit <= 0) {
                return { run: null, items: [], input: null };
            }

            const input = {
                ...apifyConfig.facebookCommentsDefaultInput,
                startUrls: postURLs.map((url) => ({ url })),
                resultsLimit: Math.floor(resultsLimit),
                includeNestedComments: Number(maxReplies) > 0,
            };

            const run = await client.actor(this.facebookCommentsActorId).call(input);
            const { items } = await client.dataset(run.defaultDatasetId).listItems({
                limit: 10000,
            });

            return { run, items, input };
        });
    }

    /**
     * Scrape TikTok profile videos (latest N), không lấy comment.
     */
    async runTikTokVideoScraper(overrides = {}) {
        return this.runWithAlert('runTikTokVideoScraper', async () => {
            const client = this.getClient();
            const input = {
                ...apifyConfig.tiktokVideoDefaultInput,
                ...overrides,
                commentsPerPost: 0,
                topLevelCommentsPerPost: 0,
                maxRepliesPerComment: 0,
            };
            if (overrides.resultsPerPage != null) {
                input.resultsPerPage = Number(overrides.resultsPerPage);
            }
            if (Array.isArray(overrides.profiles)) {
                input.profiles = overrides.profiles.map((p) =>
                    typeof p === 'string' ? p : p?.url || String(p)
                );
            }

            const run = await client.actor(this.tiktokActorId).call(input);
            const { items } = await client.dataset(run.defaultDatasetId).listItems({
                limit: 1000,
            });

            return { run, items, input };
        });
    }

    /**
     * Scrape comments (+ replies) cho danh sách postURLs TikTok.
     */
    async runTikTokCommentsScraper(overrides = {}) {
        const postURLs = (overrides.postURLs || [])
            .map((u) => (typeof u === 'string' ? u : u?.url))
            .filter(Boolean);

        if (postURLs.length === 0) {
            return { run: null, items: [], input: null };
        }

        const commentsPerPost =
            overrides.commentsPerPost ?? apifyConfig.tiktokCommentsPerPost;
        if (!Number.isFinite(Number(commentsPerPost)) || Number(commentsPerPost) <= 0) {
            return { run: null, items: [], input: null };
        }

        return this.runWithAlert('runTikTokCommentsScraper', async () => {
            const client = this.getClient();
            const topLevel =
                overrides.topLevelCommentsPerPost ?? Number(commentsPerPost);
            const input = {
                ...apifyConfig.tiktokCommentsDefaultInput,
                ...overrides,
                postURLs,
                commentsPerPost: Number(commentsPerPost),
                topLevelCommentsPerPost: Number(topLevel),
                maxRepliesPerComment:
                    overrides.maxRepliesPerComment ?? apifyConfig.tiktokMaxRepliesPerComment,
            };

            const run = await client.actor(this.tiktokCommentsActorId).call(input);
            const { items } = await client.dataset(run.defaultDatasetId).listItems({
                limit: 10000,
            });

            return { run, items, input };
        });
    }
}

module.exports = ApifyService;
