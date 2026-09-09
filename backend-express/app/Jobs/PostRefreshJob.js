'use strict';

const Job = require('./Job');
const ScraperAsyncService = require('../Services/ScraperAsyncService');
const PostRefreshService = require('../Services/PostRefreshService');
const logger = require('../Logging/logger');

class PostRefreshJob {
    /**
     * @param {{ asyncStatusJobId: number, scraper_run_id: number }} data
     */
    constructor(data = {}) {
        this.data = data;
    }

    /**
     * @param {{ asyncStatusJobId: number, scraper_run_id: number }} options
     */
    static async dispatch(options = {}) {
        return Job.dispatch('PostRefreshJob', options);
    }

    async handle() {
        const asyncStatusJobId = Number(this.data.asyncStatusJobId);
        const scraperRunId = Number(this.data.scraper_run_id);
        await ScraperAsyncService.markRunning(asyncStatusJobId);

        const service = new PostRefreshService();
        try {
            const result = await service.refreshPost(scraperRunId);
            await ScraperAsyncService.markCompleted(asyncStatusJobId, result);
            return result;
        } catch (error) {
            logger.error('[PostRefreshJob] failed', {
                asyncStatusJobId,
                scraper_run_id: scraperRunId,
                error: error.message,
            });
            throw error;
        }
    }
}

module.exports = PostRefreshJob;
