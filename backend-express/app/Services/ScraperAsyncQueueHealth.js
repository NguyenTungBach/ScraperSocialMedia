'use strict';

const { Op } = require('sequelize');
const db = require('../Models');
const { ScraperAsyncStatus, ACTIVE_STATUSES } = require('../Constants/ScraperAsyncStatus');
const logger = require('../Logging/logger');

const PENDING_STALE_MS = Number(process.env.SCRAPER_ASYNC_PENDING_STALE_MS || 60 * 1000);
const RUNNING_STALE_MS = Number(process.env.SCRAPER_ASYNC_RUNNING_STALE_MS || 60 * 60 * 1000);
const QUEUE_RESERVED_STALE_SEC = Number(
    process.env.SCRAPER_ASYNC_QUEUE_RESERVED_STALE_SEC || 10 * 60
);

function nowSec() {
    return Math.floor(Date.now() / 1000);
}

function pendingCreatedBeforeCutoff() {
    return new Date(Date.now() - PENDING_STALE_MS);
}

class ScraperAsyncQueueHealth {
    /**
     * Release queue jobs stuck in reserved state (worker crash).
     * @returns {Promise<number>}
     */
    static async releaseStaleQueueJobs() {
        const cutoff = nowSec() - QUEUE_RESERVED_STALE_SEC;
        const [count] = await db.Job.update(
            {
                reserved_at: null,
                available_at: nowSec(),
            },
            {
                where: {
                    reserved_at: { [Op.ne]: null, [Op.lte]: cutoff },
                },
            }
        );
        return Number(count || 0);
    }

    /**
     * Pending too long: mark stale and remove queue row if worker never picked it.
     * @returns {Promise<number>}
     */
    static async cancelStalePendingJobs() {
        const pendingCutoff = pendingCreatedBeforeCutoff();
        const stalePendingRows = await db.AsyncStatusJob.findAll({
            where: {
                status: ScraperAsyncStatus.PENDING,
                created_at: { [Op.lte]: pendingCutoff },
            },
        });

        let cancelled = 0;
        for (const row of stalePendingRows) {
            const queueJobId = row.queue_job_id != null ? Number(row.queue_job_id) : null;

            if (queueJobId != null) {
                const queueJob = await db.Job.findByPk(queueJobId);
                const neverPicked =
                    queueJob &&
                    Number(queueJob.attempts || 0) === 0 &&
                    (queueJob.reserved_at == null || queueJob.reserved_at === 0);

                if (neverPicked) {
                    await queueJob.destroy();
                    logger.info('[ScraperAsync] dropped unpicked queue job (pending stale)', {
                        async_job_id: Number(row.id),
                        queue_job_id: queueJobId,
                    });
                }
            }

            await row.update({
                status: ScraperAsyncStatus.STALE,
                finished_at: new Date(),
                queue_job_id: null,
                error_message: 'Queue worker did not start processing in time.',
            });
            cancelled += 1;
        }

        return cancelled;
    }

    /**
     * Running too long: mark stale.
     * @returns {Promise<number>}
     */
    static async markStaleRunningJobs() {
        const runningCutoff = new Date(Date.now() - RUNNING_STALE_MS);
        const [count] = await db.AsyncStatusJob.update(
            {
                status: ScraperAsyncStatus.STALE,
                finished_at: new Date(),
                error_message: 'Processing timed out before completion.',
            },
            {
                where: {
                    status: ScraperAsyncStatus.RUNNING,
                    started_at: { [Op.lte]: runningCutoff },
                },
            }
        );
        return Number(count || 0);
    }

    /**
     * @returns {Promise<object>}
     */
    static async evaluate() {
        const staleReleased = await this.releaseStaleQueueJobs();
        const pendingCancelled = await this.cancelStalePendingJobs();
        const runningStale = await this.markStaleRunningJobs();
        const staleMarked = pendingCancelled + runningStale;

        const pendingCount = await db.AsyncStatusJob.count({
            where: { status: ScraperAsyncStatus.PENDING },
        });
        const runningCount = await db.AsyncStatusJob.count({
            where: { status: ScraperAsyncStatus.RUNNING },
        });
        const activeCount = await db.AsyncStatusJob.count({
            where: { status: { [Op.in]: ACTIVE_STATUSES } },
        });

        const oldPending = await db.AsyncStatusJob.count({
            where: {
                status: ScraperAsyncStatus.PENDING,
                created_at: { [Op.lte]: pendingCreatedBeforeCutoff() },
            },
        });

        return {
            ok: oldPending === 0,
            pending_count: pendingCount,
            running_count: runningCount,
            active_count: activeCount,
            stale_released: staleReleased,
            stale_marked: staleMarked,
            pending_cancelled: pendingCancelled,
            running_stale: runningStale,
            pending_stale_ms: PENDING_STALE_MS,
            running_stale_ms: RUNNING_STALE_MS,
            queue_worker_may_be_down: oldPending > 0,
        };
    }
}

module.exports = ScraperAsyncQueueHealth;
