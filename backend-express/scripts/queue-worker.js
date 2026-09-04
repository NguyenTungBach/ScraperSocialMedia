'use strict';

/**
 * Queue worker (database driver) tương đương `php artisan queue:work`.
 * Chạy: npm run queue:worker
 *
 * Khi tắt worker giữa chừng, job giữ reserved_at → worker mới không pick.
 * Startup sẽ nhả reserved orphan (mặc định tất cả; xem QUEUE_RELEASE_RESERVED_ON_START_SEC).
 */
require('dotenv').config();
const QueueService = require('../app/Services/QueueService');
const SettingsCache = require('../app/Services/SettingsCache');
const logger = require('../app/Logging/logger');

const PROCESS_INTERVAL_MS = Number(process.env.QUEUE_POLL_INTERVAL_MS || 2000);
let shuttingDown = false;
let busy = false;

function shutdown(signal) {
    shuttingDown = true;
    logger.info('Queue worker shutting down', { signal, busy });
    // Không đợi job dài (scrape); job reserved sẽ được nhả khi worker start lại.
    process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function tick() {
    if (busy || shuttingDown) {
        return;
    }
    busy = true;
    try {
        await QueueService.processNext();
    } catch (error) {
        logger.error('Queue worker tick failed', { error: error.message, stack: error.stack });
    } finally {
        busy = false;
    }
}

async function run() {
    try {
        await SettingsCache.load();
    } catch (error) {
        logger.warn('SettingsCache load failed at worker boot', { error: error.message });
    }
    const released = await QueueService.releaseOrphanedReservedJobs();
    logger.info('Queue worker started', {
        interval_ms: PROCESS_INTERVAL_MS,
        released_reserved: released
    });
    await tick();
    setInterval(tick, PROCESS_INTERVAL_MS);
}

run().catch((error) => {
    logger.error('Queue worker startup failed', { error: error.message, stack: error.stack });
    process.exit(1);
});
