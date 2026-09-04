'use strict';

const Job = require('./Job');
const ScraperAsyncService = require('../Services/ScraperAsyncService');
const YouTubeScrapeService = require('../Services/YouTubeScrapeService');
const logger = require('../Logging/logger');

class YoutubeScrapeJob {
    /**
     * @param {{ asyncStatusJobId: number, channel_id: number[], maxResults?: number, subject_id?: number }} data
     */
    constructor(data = {}) {
        this.data = data;
    }

    /**
     * @param {{ asyncStatusJobId: number, channel_id: number[], maxResults?: number, subject_id?: number }} options
     */
    static async dispatch(options = {}) {
        return Job.dispatch('YoutubeScrapeJob', options);
    }

    async handle() {
        const asyncStatusJobId = Number(this.data.asyncStatusJobId);
        await ScraperAsyncService.markRunning(asyncStatusJobId);

        const service = new YouTubeScrapeService();
        try {
            const result = await service.scrapeChannels({
                channel_id: this.data.channel_id || [],
                maxResults: this.data.maxResults,
            });
            await ScraperAsyncService.markCompleted(asyncStatusJobId, result);
            return result;
        } catch (error) {
            logger.error('[YoutubeScrapeJob] failed', {
                asyncStatusJobId,
                error: error.message,
            });
            throw error;
        }
    }
}

module.exports = YoutubeScrapeJob;
