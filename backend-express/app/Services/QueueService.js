'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const db = require('../Models');
const logger = require('../Logging/logger');

const MAX_ATTEMPTS = 3;
const DEFAULT_QUEUE = 'default';
const RETRY_DELAY_SECONDS = 60;

const JOB_LOADERS = {
    SampleLogJob: () => require('../Jobs/SampleLogJob'),
    SendMailJob: () => require('../Jobs/SendMailJob')
};

function nowSec() {
    return Math.floor(Date.now() / 1000);
}

class QueueService {
    /**
     * @param {string} jobClass
     * @param {Record<string, unknown>} data
     * @param {{ queue?: string, delaySeconds?: number }} options
     */
    static async dispatch(jobClass, data = {}, options = {}) {
        const queue = options.queue || DEFAULT_QUEUE;
        const delaySeconds = Number(options.delaySeconds || 0);

        const payload = JSON.stringify({
            job: jobClass,
            data
        });

        const job = await db.Job.create({
            queue,
            payload,
            attempts: 0,
            reserved_at: null,
            available_at: nowSec() + Math.max(0, delaySeconds),
            created_at: nowSec()
        });

        logger.info('Queue job dispatched', {
            job_id: Number(job.id),
            queue,
            job_class: jobClass
        });

        return job.get({ plain: true });
    }

    static resolveJobClass(jobClassName) {
        const loader = JOB_LOADERS[jobClassName];
        if (!loader) {
            const e = new Error(`Unknown queue job class: ${jobClassName}`);
            e.statusCode = 400;
            throw e;
        }
        return loader();
    }

    /**
     * Process one job at a time.
     * @param {string} queue
     * @returns {Promise<boolean>}
     */
    static async processNext(queue = DEFAULT_QUEUE) {
        let claimedJob = null;
        const t = await db.sequelize.transaction();
        try {
            claimedJob = await db.Job.findOne({
                where: {
                    queue,
                    reserved_at: null,
                    available_at: { [Op.lte]: nowSec() }
                },
                order: [['id', 'ASC']],
                lock: t.LOCK.UPDATE,
                skipLocked: true,
                transaction: t
            });

            if (!claimedJob) {
                await t.commit();
                return false;
            }

            await claimedJob.update(
                {
                    reserved_at: nowSec(),
                    attempts: Number(claimedJob.attempts || 0) + 1
                },
                { transaction: t }
            );

            await t.commit();
        } catch (error) {
            await t.rollback();
            logger.error('Queue claim job failed', { error: error.message, stack: error.stack });
            return false;
        }

        await this.processClaimed(claimedJob);
        return true;
    }

    /**
     * @param {import('sequelize').Model} job
     */
    static async processClaimed(job) {
        const jobId = Number(job.id);
        try {
            const parsed = JSON.parse(job.payload || '{}');
            const jobClassName = String(parsed.job || '');
            const JobClass = this.resolveJobClass(jobClassName);
            const jobInstance = new JobClass(parsed.data || {});

            await jobInstance.handle();
            await job.destroy();

            logger.info('Queue job processed', {
                job_id: jobId,
                job_class: jobClassName,
                attempts: Number(job.attempts || 0)
            });
        } catch (error) {
            const attempts = Number(job.attempts || 0);
            const retriable = attempts < MAX_ATTEMPTS;

            logger.error('Queue job failed', {
                job_id: jobId,
                attempts,
                retriable,
                error: error.message,
                stack: error.stack
            });

            if (retriable) {
                await job.update({
                    reserved_at: null,
                    available_at: nowSec() + RETRY_DELAY_SECONDS
                });
                return;
            }

            try {
                await db.FailedJob.create({
                    uuid: crypto.randomUUID(),
                    connection: 'database',
                    queue: String(job.queue || DEFAULT_QUEUE),
                    payload: String(job.payload || ''),
                    exception: `${error.message}\n${error.stack || ''}`,
                    failed_at: new Date()
                });
            } catch (persistErr) {
                logger.error('Failed to persist failed_jobs row', {
                    job_id: jobId,
                    error: persistErr.message
                });
            }

            await job.destroy();
            logger.error('Queue job moved to failed_jobs', {
                job_id: jobId,
                attempts
            });
        }
    }
}

module.exports = QueueService;
