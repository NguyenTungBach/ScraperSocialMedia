'use strict';

const Job = require('./Job');
const ScraperAsyncService = require('../Services/ScraperAsyncService');
const TikTokScrapeService = require('../Services/TikTokScrapeService');
const logger = require('../Logging/logger');

class TikTokScrapeJob {
    /**
     * @param {{
     *   asyncStatusJobId: number,
     *   channel_id: number[],
     *   maxResults?: number,
     *   commentsPerPost?: number,
     *   maxRepliesPerComment?: number,
     *   subject_id?: number
     * }} data
     */
    constructor(data = {}) {
        this.data = data;
    }

    /**
     * @param {object} options
     */
    static async dispatch(options = {}) {
        return Job.dispatch('TikTokScrapeJob', options);
    }

    async handle() {
        const asyncStatusJobId = Number(this.data.asyncStatusJobId);
        await ScraperAsyncService.markRunning(asyncStatusJobId);

        const service = new TikTokScrapeService();
        try {
            const result = await service.scrapeChannels({
                channel_id: this.data.channel_id || [],
                maxResults: this.data.maxResults,
                commentsPerPost: this.data.commentsPerPost,
                maxRepliesPerComment: this.data.maxRepliesPerComment,
            });
            await ScraperAsyncService.markCompleted(asyncStatusJobId, result);
            return result;
        } catch (error) {
            logger.error('[TikTokScrapeJob] failed', {
                asyncStatusJobId,
                error: error.message,
            });
            throw error;
        }
    }
}

module.exports = TikTokScrapeJob;
