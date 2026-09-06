'use strict';

const Job = require('./Job');
const ScraperAsyncService = require('../Services/ScraperAsyncService');
const CommentAnalysisService = require('../Services/CommentAnalysisService');
const logger = require('../Logging/logger');

class CommentAnalysisJob {
    /**
     * @param {{
     *   asyncStatusJobId: number,
     *   scraper_run_id: number,
     *   max_comments?: number,
     *   max_replies?: number,
     * }} data
     */
    constructor(data = {}) {
        this.data = data;
    }

    /**
     * @param {{
     *   asyncStatusJobId: number,
     *   scraper_run_id: number,
     *   max_comments?: number,
     *   max_replies?: number,
     * }} options
     */
    static async dispatch(options = {}) {
        return Job.dispatch('CommentAnalysisJob', options);
    }

    async handle() {
        const asyncStatusJobId = Number(this.data.asyncStatusJobId);
        const scraperRunId = Number(this.data.scraper_run_id);
        await ScraperAsyncService.markRunning(asyncStatusJobId);

        const service = new CommentAnalysisService();
        try {
            const result = await service.analyzePostIfNeeded(scraperRunId, {
                max_comments: this.data.max_comments,
                max_replies: this.data.max_replies,
            });
            await ScraperAsyncService.markCompleted(asyncStatusJobId, result);
            return result;
        } catch (error) {
            logger.error('[CommentAnalysisJob] failed', {
                asyncStatusJobId,
                scraper_run_id: scraperRunId,
                error: error.message,
            });
            throw error;
        }
    }
}

module.exports = CommentAnalysisJob;
