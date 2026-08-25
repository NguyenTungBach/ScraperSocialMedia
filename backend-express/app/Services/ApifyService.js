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

    /**
     * Danh sách lịch sử Actor runs trên Apify (tương đương console.apify.com/actors/runs).
     */
    async listActorRuns({ limit = 20, offset = 0, status = null, desc = true } = {}) {
        const client = this.getClient();
        const options = {
            limit: Math.min(Math.max(Number(limit) || 20, 1), 100),
            offset: Math.max(Number(offset) || 0, 0),
            desc: desc !== false,
        };
        if (status) {
            options.status = status;
        }

        const result = await client.actor(this.actorId).runs().list(options);
        const items = (result.items || []).map((run) => ({
            ...run,
            console_url: `https://console.apify.com/actors/${run.actId || this.actorId}/runs/${run.id}`,
            dataset_url: run.defaultDatasetId
                ? `https://console.apify.com/storage/datasets/${run.defaultDatasetId}`
                : null,
        }));

        return {
            items,
            total: result.total ?? items.length,
            count: result.count ?? items.length,
            offset: result.offset ?? options.offset,
            limit: result.limit ?? options.limit,
            actor_id: this.actorId,
        };
    }

    async getRun(runId) {
        const client = this.getClient();
        const run = await client.run(runId).get();
        if (!run) {
            throw createError(404, `Apify run not found: ${runId}`);
        }
        return run;
    }

    /**
     * Lấy dataset items của một Apify run đã có (không chạy Actor mới → không tốn credit scrape).
     */
    async getRunItems(runId) {
        const client = this.getClient();
        const run = await this.getRun(runId);

        if (!run.defaultDatasetId) {
            throw createError(400, `Apify run ${runId} has no dataset yet (status: ${run.status})`);
        }

        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        return { run, items };
    }
}

module.exports = ApifyService;
