'use strict';

const { Op } = require('sequelize');
const db = require('../Models');
const {
    ScraperAsyncStatus,
    ScraperAsyncType,
    ACTIVE_STATUSES,
    TERMINAL_STATUSES,
} = require('../Constants/ScraperAsyncStatus');
const ScraperAsyncQueueHealth = require('./ScraperAsyncQueueHealth');
const logger = require('../Logging/logger');

function parseJsonField(value) {
    if (value == null) return null;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    }
    if (typeof value === 'object') {
        return value;
    }
    return null;
}

function serializeRow(row) {
    const plain = row.get ? row.get({ plain: true }) : row;
    return {
        async_job_id: Number(plain.id),
        job_type: plain.job_type,
        scope_key: plain.scope_key,
        status: plain.status,
        queue_job_id: plain.queue_job_id != null ? Number(plain.queue_job_id) : null,
        attempts: Number(plain.attempts || 0),
        error_message: plain.error_message || null,
        payload_json: parseJsonField(plain.payload_json),
        result_json: parseJsonField(plain.result_json),
        started_at: plain.started_at || null,
        finished_at: plain.finished_at || null,
        created_at: plain.created_at || null,
        updated_at: plain.updated_at || null,
    };
}

function normalizeChannelIds(channelIds) {
    if (!Array.isArray(channelIds)) return [];
    return [...new Set(channelIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))].sort(
        (a, b) => a - b
    );
}

function buildScopeKey(input) {
    const subjectId = input.subject_id != null ? Number(input.subject_id) : null;
    if (subjectId != null && Number.isFinite(subjectId) && subjectId > 0) {
        return `subject:${subjectId}`;
    }
    const ids = normalizeChannelIds(input.channel_id);
    if (ids.length === 0) {
        const e = new Error('channel_id is required');
        e.statusCode = 422;
        throw e;
    }
    return `channels:${ids.join(',')}`;
}

function buildScrapeSummary(result) {
    if (!result || typeof result !== 'object') {
        return null;
    }
    // Plain JSON only — tránh lỗi serialize Sequelize/MySQL JSON
    const summary = {
        source: result.source ?? null,
        platform: result.platform ?? null,
        channels_scraped: Number(result.channels_scraped || 0),
        channels_skipped: Array.isArray(result.channels_skipped)
            ? result.channels_skipped
            : [],
        items_count: Number(result.items_count || 0),
        upsert_stats: result.upsert_stats
            ? {
                  inserted: Number(result.upsert_stats.inserted || 0),
                  updated: Number(result.upsert_stats.updated || 0),
                  skipped: Number(result.upsert_stats.skipped || 0),
                  links_created: Number(result.upsert_stats.links_created || 0),
                  unmatched_channel: Number(result.upsert_stats.unmatched_channel || 0),
              }
            : null,
        comment_stats: result.comment_stats
            ? {
                  inserted: Number(result.comment_stats.inserted || 0),
                  updated: Number(result.comment_stats.updated || 0),
                  skipped: Number(result.comment_stats.skipped || 0),
                  comments_inserted: Number(result.comment_stats.comments_inserted || 0),
                  replies_inserted: Number(result.comment_stats.replies_inserted || 0),
                  comments_updated: Number(result.comment_stats.comments_updated || 0),
                  replies_updated: Number(result.comment_stats.replies_updated || 0),
                  threads_upserted: Number(result.comment_stats.threads_upserted || 0),
                  videos_with_comments: Number(result.comment_stats.videos_with_comments || 0),
                  posts_with_comments: Number(result.comment_stats.posts_with_comments || 0),
                  ai_briefs_analyzed: Number(result.comment_stats.ai_briefs_analyzed || 0),
                  ai_comments_analyzed: Number(result.comment_stats.ai_comments_analyzed || 0),
                  ai_skipped: Number(result.comment_stats.ai_skipped || 0),
              }
            : null,
        affected_subject_ids: Array.isArray(result.affected_subject_ids)
            ? result.affected_subject_ids.map((id) => Number(id)).filter((n) => Number.isFinite(n))
            : [],
    };
    if (result.quota_used != null) {
        summary.quota_used = Number(result.quota_used || 0);
    }
    if (result.video_run_id != null) {
        summary.video_run_id = result.video_run_id;
    }
    if (result.comments_run_id != null) {
        summary.comments_run_id = result.comments_run_id;
    }
    if (result.posts_run_id != null) {
        summary.posts_run_id = result.posts_run_id;
    }
    return summary;
}

class ScraperAsyncService {
    static jobClassForType(jobType) {
        if (jobType === ScraperAsyncType.YOUTUBE_SCRAPE) {
            return require('../Jobs/YoutubeScrapeJob');
        }
        if (jobType === ScraperAsyncType.TIKTOK_SCRAPE) {
            return require('../Jobs/TikTokScrapeJob');
        }
        if (jobType === ScraperAsyncType.FACEBOOK_SCRAPE) {
            return require('../Jobs/FacebookScrapeJob');
        }
        const e = new Error(`Unknown scraper async job type: ${jobType}`);
        e.statusCode = 400;
        throw e;
    }

    static async findActive(jobType, scopeKey) {
        return db.AsyncStatusJob.findOne({
            where: {
                job_type: jobType,
                scope_key: scopeKey,
                status: { [Op.in]: ACTIVE_STATUSES },
            },
            order: [['id', 'DESC']],
        });
    }

    /**
     * @param {string} jobType
     * @param {object} input
     * @param {{ id?: number }|null} user
     */
    static async enqueue(jobType, input, user) {
        const channelIds = normalizeChannelIds(input.channel_id);
        if (channelIds.length === 0) {
            const e = new Error('channel_id is required');
            e.statusCode = 422;
            throw e;
        }

        const scopeKey = buildScopeKey({ ...input, channel_id: channelIds });

        await ScraperAsyncQueueHealth.evaluate();

        const existing = await this.findActive(jobType, scopeKey);
        if (existing) {
            const e = new Error('Scrape job already in progress for this scope');
            e.statusCode = 409;
            e.data = serializeRow(existing);
            throw e;
        }

        const channelRows = await db.Channel.findAll({
            where: { id: { [Op.in]: channelIds } },
            attributes: ['id', 'name'],
        });
        const channelNames = channelRows
            .map((row) => {
                const plain = row.get ? row.get({ plain: true }) : row;
                return {
                    id: Number(plain.id),
                    name: String(plain.name || '').trim() || `kênh #${plain.id}`,
                };
            })
            .sort((a, b) => a.id - b.id);

        let subjectName = null;
        const subjectId =
            input.subject_id != null ? Number(input.subject_id) : null;
        if (subjectId != null && Number.isFinite(subjectId) && subjectId > 0) {
            const subjectRow = await db.Subject.findByPk(subjectId, {
                attributes: ['id', 'name'],
            });
            if (subjectRow) {
                const plain = subjectRow.get
                    ? subjectRow.get({ plain: true })
                    : subjectRow;
                subjectName = String(plain.name || '').trim() || null;
            }
        }

        const payload = {
            channel_id: channelIds,
            channel_names: channelNames,
            subject_id: subjectId != null && Number.isFinite(subjectId) ? subjectId : undefined,
            subject_name: subjectName || undefined,
            maxResults: input.maxResults,
            commentsPerPost: input.commentsPerPost,
            maxRepliesPerComment: input.maxRepliesPerComment,
        };

        const asyncRow = await db.AsyncStatusJob.create({
            job_type: jobType,
            scope_key: scopeKey,
            status: ScraperAsyncStatus.PENDING,
            requested_by_user_id: user?.id != null ? Number(user.id) : null,
            payload_json: payload,
        });

        const JobClass = this.jobClassForType(jobType);
        const queued = await JobClass.dispatch({
            asyncStatusJobId: Number(asyncRow.id),
            ...payload,
        });

        await asyncRow.update({
            queue_job_id: Number(queued.id),
        });

        logger.info('[ScraperAsync] enqueued', {
            async_job_id: Number(asyncRow.id),
            queue_job_id: Number(queued.id),
            job_type: jobType,
            scope_key: scopeKey,
        });

        return serializeRow(await asyncRow.reload());
    }

    static async getStatus(asyncJobId) {
        await ScraperAsyncQueueHealth.evaluate();

        const row = await db.AsyncStatusJob.findByPk(asyncJobId);
        if (!row) {
            const e = new Error('Async scrape job not found');
            e.statusCode = 404;
            throw e;
        }
        return serializeRow(row);
    }

    static async getLatest(jobType, scopeKey) {
        await ScraperAsyncQueueHealth.evaluate();

        const row = await db.AsyncStatusJob.findOne({
            where: {
                job_type: jobType,
                scope_key: scopeKey,
            },
            order: [['id', 'DESC']],
        });
        return row ? serializeRow(row) : null;
    }

    /**
     * Active scrape jobs (pending|running) after health evaluate.
     * @returns {Promise<object[]>}
     */
    static async listActive() {
        await ScraperAsyncQueueHealth.evaluate();

        const rows = await db.AsyncStatusJob.findAll({
            where: {
                status: { [Op.in]: ACTIVE_STATUSES },
            },
            order: [['id', 'ASC']],
        });
        return rows.map((row) => serializeRow(row));
    }

    static async markRunning(asyncStatusJobId) {
        const row = await db.AsyncStatusJob.findByPk(asyncStatusJobId);
        if (!row) {
            return null;
        }
        if (TERMINAL_STATUSES.includes(row.status)) {
            return serializeRow(row);
        }

        await row.update({
            status: ScraperAsyncStatus.RUNNING,
            started_at: row.started_at || new Date(),
            attempts: Number(row.attempts || 0) + 1,
            error_message: null,
        });
        return serializeRow(await row.reload());
    }

    static async markCompleted(asyncStatusJobId, result) {
        const row = await db.AsyncStatusJob.findByPk(asyncStatusJobId);
        if (!row) {
            return null;
        }
        const summary = buildScrapeSummary(result);
        await row.update({
            status: ScraperAsyncStatus.COMPLETED,
            finished_at: new Date(),
            error_message: null,
            result_json: summary,
        });
        logger.info('[ScraperAsync] completed', {
            async_job_id: Number(asyncStatusJobId),
            items_count: summary?.items_count ?? 0,
            inserted: summary?.upsert_stats?.inserted ?? 0,
            updated: summary?.upsert_stats?.updated ?? 0,
            comments_inserted: summary?.comment_stats?.inserted ?? 0,
            ai_briefs: summary?.comment_stats?.ai_briefs_analyzed ?? 0,
            ai_comments: summary?.comment_stats?.ai_comments_analyzed ?? 0,
        });
        return serializeRow(await row.reload());
    }

    static async markFailed(asyncStatusJobId, errorMessage) {
        const row = await db.AsyncStatusJob.findByPk(asyncStatusJobId);
        if (!row) {
            return null;
        }
        if (TERMINAL_STATUSES.includes(row.status)) {
            return serializeRow(row);
        }
        await row.update({
            status: ScraperAsyncStatus.FAILED,
            finished_at: new Date(),
            error_message: errorMessage || 'Scrape job failed',
        });
        return serializeRow(await row.reload());
    }

    static async markFailedByQueueJobId(queueJobId, errorMessage) {
        const row = await db.AsyncStatusJob.findOne({
            where: { queue_job_id: Number(queueJobId) },
        });
        if (!row) {
            return null;
        }
        if (TERMINAL_STATUSES.includes(row.status)) {
            return serializeRow(row);
        }
        return this.markFailed(Number(row.id), errorMessage);
    }
}

module.exports = ScraperAsyncService;
module.exports.buildScopeKey = buildScopeKey;
module.exports.buildScrapeSummary = buildScrapeSummary;
module.exports.serializeRow = serializeRow;
