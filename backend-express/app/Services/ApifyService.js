'use strict';

const { ApifyClient } = require('apify-client');
const createError = require('http-errors');
const apifyConfig = require('../../config/apify');

class ApifyService {
    constructor() {
        this.actorId = apifyConfig.facebookActorId;
        this.defaultInput = apifyConfig.defaultInput;
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
     * Chạy Actor Facebook scraper trên Apify và chờ hoàn thành.
     * @returns {{ run: object, items: object[] }}
     */
    async runFacebookScraper(overrides = {}) {
        const client = this.getClient();
        const input = this.buildInput(overrides);

        const run = await client.actor(this.actorId).call(input);
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        return { run, items, input };
    }

    async getRun(runId) {
        const client = this.getClient();
        return client.run(runId).get();
    }

    async getRunItems(runId) {
        const client = this.getClient();
        const run = await client.run(runId).get();
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        return { run, items };
    }
}

module.exports = ApifyService;
