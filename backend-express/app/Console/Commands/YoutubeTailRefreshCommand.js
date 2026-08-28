'use strict';

const youtubeConfig = require('../../../config/youtube');
const YouTubeTailRefreshService = require('../../Services/YouTubeTailRefreshService');
const logger = require('../../Logging/logger');

/**
 * Refresh stats video YouTube tail — chạy trực tiếp trên GitHub runner (không gọi API Render).
 * Chạy: npm run app:youtube-refresh-tail
 * Env tuỳ chọn: YOUTUBE_HEAD_SIZE, YOUTUBE_TAIL_BATCH_SIZE, YOUTUBE_TAIL_START_OFFSET,
 *   YOUTUBE_TAIL_MAX_ELAPSED_MS, YOUTUBE_TAIL_SLEEP_MS
 */
class YoutubeTailRefreshCommand {
    static signature = 'app:youtube-refresh-tail';

    static scheduleEnabled = false;

    async handle() {
        const headSize = Number(process.env.YOUTUBE_HEAD_SIZE) || youtubeConfig.headSize;
        const batchSize = Number(process.env.YOUTUBE_TAIL_BATCH_SIZE) || youtubeConfig.tailBatchSize;
        const startOffset = Number(process.env.YOUTUBE_TAIL_START_OFFSET) || 0;
        const maxElapsedMs =
            Number(process.env.YOUTUBE_TAIL_MAX_ELAPSED_MS) || 170 * 60 * 1000;
        const sleepMs = Number(process.env.YOUTUBE_TAIL_SLEEP_MS) || 3000;

        const service = new YouTubeTailRefreshService();
        const result = await service.runAll({
            headSize,
            batchSize,
            startOffset,
            maxElapsedMs,
            sleepMs,
        });

        logger.info('[youtube-tail] Refresh finished', result);
        return result;
    }
}

module.exports = YoutubeTailRefreshCommand;
