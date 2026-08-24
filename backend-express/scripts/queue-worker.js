'use strict';

/**
 * Queue worker (database driver) tương đương `php artisan queue:work`.
 * Chạy: npm run queue:worker
 */
require('dotenv').config();
const QueueService = require('../app/Services/QueueService');
const logger = require('../app/Logging/logger');

const PROCESS_INTERVAL_MS = Number(process.env.QUEUE_POLL_INTERVAL_MS || 2000);
let shuttingDown = false;
let busy = false;

function shutdown(signal) {
    shuttingDown = true;
    logger.info('Queue worker shutting down', { signal });
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
    logger.info('Queue worker started', { interval_ms: PROCESS_INTERVAL_MS });
    await tick();
    setInterval(tick, PROCESS_INTERVAL_MS);
}

run().catch((error) => {
    logger.error('Queue worker startup failed', { error: error.message, stack: error.stack });
    process.exit(1);
});
