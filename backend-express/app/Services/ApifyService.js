'use strict';

const { ApifyClient } = require('apify-client');
const createError = require('http-errors');
const apifyConfig = require('../../config/apify');

class ApifyService {
    constructor() {
        this.facebookActorId = apifyConfig.facebookActorId;
        this.facebookCommentsActorId = apifyConfig.facebookCommentsActorId;
        this.defaultInput = apifyConfig.defaultInput;
        this.tiktokActorId = apifyConfig.tiktokActorId;
        this.tiktokCommentsActorId = apifyConfig.tiktokCommentsActorId;
        /** @deprecated dùng facebookActorId */
        this.actorId = this.facebookActorId;
    }

    getClient() {
        if (!apifyConfig.token) {
            throw createError(
                500,
                'APIFY_API_TOKEN is not configured. Add it to your .env file.'
            );
        }
        return new ApifyClient({ token: apifyConfig.token });
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
        const client = this.getClient();
        const input = this.buildInput(overrides);

        const run = await client.actor(this.facebookActorId).call(input);
        const { items } = await client.dataset(run.defaultDatasetId).listItems({
            limit: 1000,
        });

        return { run, items, input };
    }

    /**
     * Scrape comments (+ nested replies) cho danh sách post URLs Facebook.
     * @param {{
     *   postURLs?: string[],
     *   commentsPerPost?: number,
     *   maxRepliesPerComment?: number,
     * }} overrides
     */
    async runFacebookCommentsScraper(overrides = {}) {
        const client = this.getClient();
        const postURLs = (overrides.postURLs || [])
            .map((u) => (typeof u === 'string' ? u : u?.url))
            .filter(Boolean);

        if (postURLs.length === 0) {
            return { run: null, items: [], input: null };
        }

        const commentsPerPost =
            overrides.commentsPerPost ?? apifyConfig.facebookCommentsPerPost;
        const maxReplies =
            overrides.maxRepliesPerComment ?? apifyConfig.facebookMaxRepliesPerComment;

        const input = {
            ...apifyConfig.facebookCommentsDefaultInput,
            startUrls: postURLs.map((url) => ({ url })),
            resultsLimit: Number(commentsPerPost) || apifyConfig.facebookCommentsPerPost,
            includeNestedComments: Number(maxReplies) > 0,
        };

        const run = await client.actor(this.facebookCommentsActorId).call(input);
        const { items } = await client.dataset(run.defaultDatasetId).listItems({
            limit: 10000,
        });

        return { run, items, input };
    }

    /**
     * Scrape TikTok profile videos (latest N), không lấy comment.
     * @param {{ profiles?: string[], resultsPerPage?: number }} overrides
     */
    async runTikTokVideoScraper(overrides = {}) {
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
    }

    /**
     * Scrape comments (+ replies) cho danh sách postURLs TikTok.
     * @param {{ postURLs?: string[], commentsPerPost?: number, maxRepliesPerComment?: number }} overrides
     */
    async runTikTokCommentsScraper(overrides = {}) {
        const client = this.getClient();
        const postURLs = (overrides.postURLs || [])
            .map((u) => (typeof u === 'string' ? u : u?.url))
            .filter(Boolean);

        if (postURLs.length === 0) {
            return { run: null, items: [], input: null };
        }

        const input = {
            ...apifyConfig.tiktokCommentsDefaultInput,
            ...overrides,
            postURLs,
            commentsPerPost:
                overrides.commentsPerPost ?? apifyConfig.tiktokCommentsPerPost,
            maxRepliesPerComment:
                overrides.maxRepliesPerComment ?? apifyConfig.tiktokMaxRepliesPerComment,
        };

        const run = await client.actor(this.tiktokCommentsActorId).call(input);
        const { items } = await client.dataset(run.defaultDatasetId).listItems({
            limit: 10000,
        });

        return { run, items, input };
    }
}

module.exports = ApifyService;
