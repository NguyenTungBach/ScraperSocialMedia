'use strict';

const youtubeConfig = require('../../config/youtube');
const YouTubeService = require('./YouTubeService');
const ScraperRepository = require('../Repositories/ScraperRepository');
const logger = require('../Logging/logger');

class YouTubeTailRefreshService {
    constructor() {
        this.youtubeService = new YouTubeService();
        this.repository = new ScraperRepository();
    }

    /**
     * Refresh 1 batch video tail (rank > headSize theo posted_at).
     */
    async refreshBatch({
        headSize = youtubeConfig.headSize,
        batchSize = youtubeConfig.tailBatchSize,
        offset = 0,
    } = {}) {
        const head = Math.max(Number(headSize) || youtubeConfig.headSize, 1);
        const batch = Math.min(Math.max(Number(batchSize) || youtubeConfig.tailBatchSize, 1), 50);
        const off = Math.max(Number(offset) || 0, 0);

        const totalTail = await this.repository.countYoutubeTailRuns({ headSize: head });
        const rows = await this.repository.listYoutubeTailBatch({
            headSize: head,
            batchSize: batch,
            offset: off,
        });

        if (rows.length === 0) {
            return {
                source: 'youtube_api_tail_refresh',
                batch_size: batch,
                offset: off,
                processed: 0,
                updated: 0,
                not_found: 0,
                quota_used: 0,
                total_tail: totalTail,
                remaining: 0,
                next_offset: off,
                affected_subject_ids: [],
            };
        }

        const videoIds = rows.map((r) => r.platform_post_id).filter(Boolean);
        const rawVideos = await this.youtubeService.getVideoDetails(videoIds);
        const quotaUsed = videoIds.length > 0 ? 1 : 0;

        const result = await this.repository.updateYoutubeTailStats({
            rows,
            rawVideos,
        });

        const nextOffset = off + rows.length;
        const remaining = Math.max(totalTail - nextOffset, 0);

        return {
            source: 'youtube_api_tail_refresh',
            batch_size: batch,
            offset: off,
            processed: result.processed,
            updated: result.updated,
            not_found: result.not_found,
            quota_used: quotaUsed,
            total_tail: totalTail,
            remaining,
            next_offset: nextOffset,
            affected_subject_ids: result.affected_subject_ids,
        };
    }

    /**
     * Loop batch cho đến hết tail hoặc hết thời gian.
     */
    async runAll({
        headSize = youtubeConfig.headSize,
        batchSize = youtubeConfig.tailBatchSize,
        startOffset = 0,
        maxElapsedMs = 170 * 60 * 1000,
        sleepMs = 3000,
    } = {}) {
        const started = Date.now();
        let offset = Math.max(Number(startOffset) || 0, 0);
        let batchNum = 0;
        let totalUpdated = 0;
        let totalQuota = 0;
        let totalProcessed = 0;
        let lastResult = null;

        while (true) {
            const elapsed = Date.now() - started;
            if (elapsed >= maxElapsedMs) {
                logger.warn('[youtube-tail] Stopping early — max elapsed reached', {
                    elapsed_ms: elapsed,
                    offset,
                    remaining: lastResult?.remaining,
                });
                return {
                    completed: false,
                    batches: batchNum,
                    total_updated: totalUpdated,
                    total_processed: totalProcessed,
                    total_quota_used: totalQuota,
                    last_offset: offset,
                    remaining: lastResult?.remaining ?? null,
                    last_batch: lastResult,
                };
            }

            batchNum += 1;
            const batchResult = await this.refreshBatch({
                headSize,
                batchSize,
                offset,
            });
            lastResult = batchResult;

            totalUpdated += batchResult.updated || 0;
            totalProcessed += batchResult.processed || 0;
            totalQuota += batchResult.quota_used || 0;

            logger.info('[youtube-tail] Batch finished', {
                batch: batchNum,
                offset: batchResult.offset,
                processed: batchResult.processed,
                updated: batchResult.updated,
                not_found: batchResult.not_found,
                remaining: batchResult.remaining,
                total_tail: batchResult.total_tail,
            });

            if ((batchResult.remaining ?? 0) <= 0 || (batchResult.processed ?? 0) === 0) {
                return {
                    completed: true,
                    batches: batchNum,
                    total_updated: totalUpdated,
                    total_processed: totalProcessed,
                    total_quota_used: totalQuota,
                    last_offset: batchResult.next_offset,
                    remaining: 0,
                    last_batch: batchResult,
                };
            }

            offset = batchResult.next_offset ?? offset + (batchResult.processed || 0);

            if (sleepMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, sleepMs));
            }
        }
    }
}

module.exports = YouTubeTailRefreshService;
