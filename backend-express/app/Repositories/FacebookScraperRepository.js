'use strict';

const { Op } = require('sequelize');
const db = require('../Models');
const { normalizeApifyItem, pickInputUrl } = require('../Helpers/PostScoreHelper');

function normalizeUrl(url) {
    if (!url) return '';
    return url.trim().replace(/\/+$/, '').toLowerCase();
}

function buildMonitorSourceMap(sources) {
    const map = new Map();
    for (const source of sources) {
        map.set(normalizeUrl(source.source_url), source.id);
    }
    return map;
}

function resolveMonitorSourceId(item, monitorSourceMap) {
    const candidates = [
        pickInputUrl(item),
        item.facebookUrl,
        item.pageUrl,
        item.page_url,
        item.user?.url,
        item.author?.url,
    ];

    for (const candidate of candidates) {
        const id = monitorSourceMap.get(normalizeUrl(candidate));
        if (id) return id;
    }

    return null;
}

class FacebookScraperRepository {
    constructor() {
        this.scraperRunModel = db.ScraperRun;
        this.socialPostModel = db.SocialPost;
        this.subjectModel = db.Subject;
        this.monitorSourceModel = db.MonitorSource;
    }

    async getActiveMonitorSources(subjectId) {
        return this.monitorSourceModel.findAll({
            where: { subject_id: subjectId, is_active: 1 },
            order: [['priority', 'ASC'], ['id', 'ASC']],
        });
    }

    async createRunFromApify({ run, input, items, subjectId = null, monitorSources = [] }) {
        const monitorSourceMap = buildMonitorSourceMap(monitorSources);
        const now = new Date();

        return db.sequelize.transaction(async (transaction) => {
            const scraperRun = await this.scraperRunModel.create(
                {
                    source: 'apify',
                    external_run_id: run.id,
                    scraper_id: run.actId || run.actorId || null,
                    platform: 'facebook',
                    subject_id: subjectId,
                    status: run.status || 'SUCCEEDED',
                    input,
                    items_count: items.length,
                    started_at: run.startedAt ? new Date(run.startedAt) : now,
                    finished_at: run.finishedAt ? new Date(run.finishedAt) : now,
                },
                { transaction }
            );

            let inserted = 0;
            let updated = 0;
            let skipped = 0;

            for (const item of items) {
                const normalized = normalizeApifyItem(item);
                if (!normalized.platform_post_id) {
                    skipped += 1;
                    continue;
                }

                const payload = {
                    platform: normalized.platform,
                    scraper_run_id: scraperRun.id,
                    subject_id: subjectId,
                    monitor_source_id: resolveMonitorSourceId(item, monitorSourceMap),
                    platform_post_id: normalized.platform_post_id,
                    post_url: normalized.post_url,
                    text: normalized.text,
                    posted_at: normalized.posted_at,
                    likes: normalized.likes,
                    comments: normalized.comments,
                    shares: normalized.shares,
                    angry_count: normalized.angry_count,
                    trend_score: normalized.trend_score,
                    hot_score: normalized.hot_score,
                    raw_data: normalized.raw_data,
                    scraped_at: now,
                };

                const existing = await this.socialPostModel.findOne({
                    where: {
                        platform: normalized.platform,
                        platform_post_id: normalized.platform_post_id,
                    },
                    transaction,
                });

                if (existing) {
                    await existing.update(payload, { transaction });
                    updated += 1;
                } else {
                    await this.socialPostModel.create(payload, { transaction });
                    inserted += 1;
                }
            }

            scraperRun.set('upsert_stats', { inserted, updated, skipped });
            return scraperRun;
        });
    }

    async listRuns({ page = 1, per_page = 10 } = {}) {
        const limit = Math.min(Math.max(Number(per_page) || 10, 1), 100);
        const currentPage = Math.max(Number(page) || 1, 1);
        const offset = (currentPage - 1) * limit;

        const { rows, count } = await this.scraperRunModel.findAndCountAll({
            order: [['id', 'DESC']],
            limit,
            offset,
            include: [{ model: this.subjectModel, as: 'subject', attributes: ['id', 'name'] }],
        });

        return { rows, count, page: currentPage, per_page: limit };
    }

    async findRunByExternalId(externalRunId, source = 'apify') {
        return this.scraperRunModel.findOne({
            where: { source, external_run_id: externalRunId },
            include: [
                { model: this.subjectModel, as: 'subject', attributes: ['id', 'name'] },
                { model: this.socialPostModel, as: 'posts' },
            ],
        });
    }

    async listPosts({ page = 1, per_page = 20, subject_id = null, today = false } = {}) {
        const limit = Math.min(Math.max(Number(per_page) || 20, 1), 100);
        const currentPage = Math.max(Number(page) || 1, 1);
        const offset = (currentPage - 1) * limit;

        const where = {};
        if (subject_id) {
            where.subject_id = subject_id;
        }

        if (today) {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            end.setHours(23, 59, 59, 999);
            where.posted_at = { [Op.between]: [start, end] };
        }

        const { rows, count } = await this.socialPostModel.findAndCountAll({
            where,
            order: [['posted_at', 'DESC'], ['id', 'DESC']],
            limit,
            offset,
            include: [
                { model: this.subjectModel, as: 'subject', attributes: ['id', 'name'] },
                { model: db.MonitorSource, as: 'monitorSource', attributes: ['id', 'source_url', 'display_name'] },
            ],
        });

        return { rows, count, page: currentPage, per_page: limit };
    }
}

module.exports = FacebookScraperRepository;
