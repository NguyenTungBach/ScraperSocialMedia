'use strict';

const { Op } = require('sequelize');
const db = require('../Models');
const {
    calculateScores,
    resolvePostedAtRange,
    buildPostedAtWhere,
} = require('../Helpers/PostScoreHelper');
const {
    buildAnalysisRows,
    normalizeThreadClassifiedAs,
    normalizeLoneClassifiedAs,
    normalizeSentiment,
    normalizeCategory,
    normalizeSeverity,
    normalizeReason,
} = require('../Helpers/CommentAnalysisHelper');

class CommentRepository {
    constructor() {
        this.postCommentModel = db.PostComment;
        this.commentThreadModel = db.CommentThread;
        this.scraperRunModel = db.ScraperRun;
        this.subjectScraperRunModel = db.SubjectScraperRun;
    }

    serializeComment(row) {
        const plain = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
        return {
            id: plain.id,
            scraper_run_id: plain.scraper_run_id,
            platform_comment_id: plain.platform_comment_id,
            parent_platform_comment_id: plain.parent_platform_comment_id,
            thread_key: plain.thread_key,
            author: plain.author,
            text: plain.text,
            like_count: plain.like_count,
            published_at: plain.published_at,
            sort_order: plain.sort_order,
            group_type: plain.group_type,
            classified_as: plain.classified_as,
            sentiment: plain.sentiment,
            category: plain.category,
            severity: plain.severity,
            reason: plain.reason,
            analysis_status: plain.analysis_status,
            scraped_at: plain.scraped_at,
        };
    }

    serializeThread(row, comments = []) {
        const plain = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
        return {
            id: plain.id,
            thread_key: plain.thread_key,
            root_comment_id: plain.root_comment_id,
            comment_count: plain.comment_count,
            classified_as: plain.classified_as,
            has_negativity: Boolean(plain.has_negativity),
            sentiment: plain.sentiment,
            category: plain.category,
            severity: plain.severity,
            reason: plain.reason,
            analysis_status: plain.analysis_status,
            analyzed_at: plain.analyzed_at,
            comments: comments.map((c) => this.serializeComment(c)),
        };
    }

    async ingestCommentsForScraperRun(
        scraperRunId,
        comments = [],
        { transaction, insertOnly = false } = {}
    ) {
        const now = new Date();
        let inserted = 0;
        let updated = 0;
        let skipped = 0;

        for (const item of comments) {
            if (!item?.platform_comment_id || !item.text) continue;

            const existing = await this.postCommentModel.findOne({
                where: {
                    scraper_run_id: scraperRunId,
                    platform_comment_id: item.platform_comment_id,
                },
                transaction,
            });

            const basePayload = {
                scraper_run_id: scraperRunId,
                platform_comment_id: item.platform_comment_id,
                parent_platform_comment_id: item.parent_platform_comment_id,
                thread_key: item.thread_key,
                author: item.author,
                text: item.text,
                like_count: item.like_count || 0,
                published_at: item.published_at,
                sort_order: item.sort_order || 0,
                raw_data: item.raw_data || null,
                scraped_at: now,
            };

            if (existing) {
                if (insertOnly) {
                    skipped += 1;
                    continue;
                }
                const textChanged = String(existing.text) !== String(item.text);
                const updatePayload = { ...basePayload };
                if (textChanged) {
                    Object.assign(updatePayload, {
                        analysis_status: 'pending',
                        classified_as: null,
                        sentiment: null,
                        category: null,
                        severity: null,
                        reason: null,
                    });
                }
                await existing.update(updatePayload, { transaction });
                updated += 1;
            } else {
                await this.postCommentModel.create(
                    {
                        ...basePayload,
                        group_type: 'lone',
                        analysis_status: 'pending',
                    },
                    { transaction }
                );
                inserted += 1;
            }
        }

        return { inserted, updated, skipped };
    }

    async rebuildThreadsForScraperRun(scraperRunId, { transaction } = {}) {
        const all = await this.postCommentModel.findAll({
            where: { scraper_run_id: scraperRunId },
            order: [
                ['sort_order', 'ASC'],
                ['id', 'ASC'],
            ],
            transaction,
        });

        const childrenByParent = new Map();
        for (const row of all) {
            if (!row.parent_platform_comment_id) continue;
            const key = row.parent_platform_comment_id;
            const bucket = childrenByParent.get(key) || [];
            bucket.push(row);
            childrenByParent.set(key, bucket);
        }

        const threadKeys = new Set();
        for (const row of all) {
            if (!row.parent_platform_comment_id) {
                const replies = childrenByParent.get(row.platform_comment_id) || [];
                if (replies.length > 0) {
                    await row.update({ group_type: 'thread' }, { transaction });
                    for (const reply of replies) {
                        await reply.update(
                            { group_type: 'thread', thread_key: row.platform_comment_id },
                            { transaction }
                        );
                    }
                    threadKeys.add(row.platform_comment_id);
                } else {
                    await row.update({ group_type: 'lone', thread_key: row.platform_comment_id }, { transaction });
                }
            }
        }

        let threadsUpserted = 0;
        for (const threadKey of threadKeys) {
            const root = all.find(
                (r) => r.platform_comment_id === threadKey && !r.parent_platform_comment_id
            );
            if (!root) continue;

            const threadComments = all.filter((r) => r.thread_key === threadKey);
            const existingThread = await this.commentThreadModel.findOne({
                where: { scraper_run_id: scraperRunId, thread_key: threadKey },
                transaction,
            });

            const countChanged =
                existingThread && existingThread.comment_count !== threadComments.length;

            if (existingThread) {
                const updatePayload = {
                    root_comment_id: root.id,
                    comment_count: threadComments.length,
                };
                if (countChanged) {
                    Object.assign(updatePayload, {
                        analysis_status: 'pending',
                        classified_as: null,
                        has_negativity: false,
                        sentiment: null,
                        category: null,
                        severity: null,
                        reason: null,
                        analyzed_at: null,
                    });
                }
                await existingThread.update(updatePayload, { transaction });
            } else {
                await this.commentThreadModel.create(
                    {
                        scraper_run_id: scraperRunId,
                        thread_key: threadKey,
                        root_comment_id: root.id,
                        comment_count: threadComments.length,
                        analysis_status: 'pending',
                    },
                    { transaction }
                );
            }
            threadsUpserted += 1;
        }

        const staleThreads = await this.commentThreadModel.findAll({
            where: {
                scraper_run_id: scraperRunId,
                thread_key: { [Op.notIn]: [...threadKeys] },
            },
            transaction,
        });
        for (const stale of staleThreads) {
            await stale.update({ analysis_status: 'skipped' }, { transaction });
        }

        return { threads_upserted: threadsUpserted, thread_count: threadKeys.size };
    }

    async ingestAndRebuild(scraperRunId, comments = [], { insertOnly = false } = {}) {
        return db.sequelize.transaction(async (transaction) => {
            const ingest = await this.ingestCommentsForScraperRun(scraperRunId, comments, {
                transaction,
                insertOnly,
            });
            const threads =
                ingest.inserted > 0 || !insertOnly
                    ? await this.rebuildThreadsForScraperRun(scraperRunId, { transaction })
                    : { threads_upserted: 0, thread_count: 0 };
            return { ...ingest, ...threads };
        });
    }

    async getCommentsByScraperRunId(scraperRunId) {
        const [loneRows, threadRows, allComments] = await Promise.all([
            this.postCommentModel.findAll({
                where: { scraper_run_id: scraperRunId, group_type: 'lone' },
                order: [
                    ['sort_order', 'ASC'],
                    ['id', 'ASC'],
                ],
            }),
            this.commentThreadModel.findAll({
                where: { scraper_run_id: scraperRunId },
                order: [['id', 'ASC']],
            }),
            this.postCommentModel.findAll({
                where: { scraper_run_id: scraperRunId, group_type: 'thread' },
                order: [
                    ['thread_key', 'ASC'],
                    ['sort_order', 'ASC'],
                    ['id', 'ASC'],
                ],
            }),
        ]);

        const byThreadKey = new Map();
        for (const c of allComments) {
            const bucket = byThreadKey.get(c.thread_key) || [];
            bucket.push(c);
            byThreadKey.set(c.thread_key, bucket);
        }

        const threads = threadRows.map((t) =>
            this.serializeThread(t, byThreadKey.get(t.thread_key) || [])
        );

        const lone = loneRows.map((r) => this.serializeComment(r));

        return {
            lone,
            threads,
            meta: this.buildAnalysisMeta(lone, threads),
        };
    }

    buildAnalysisMeta(lone = [], threads = []) {
        const analyzedLoneCount = lone.filter(
            (c) =>
                c.analysis_status === 'done' ||
                c.classified_as ||
                c.reason ||
                (c.sentiment && c.sentiment !== 'unknown') ||
                (c.category && c.category !== 'unknown')
        ).length;

        const analyzedThreadCount = threads.filter(
            (t) =>
                t.analysis_status === 'done' ||
                t.classified_as ||
                t.reason ||
                (t.sentiment && t.sentiment !== 'unknown') ||
                (t.category && t.category !== 'unknown')
        ).length;

        return {
            analyzed: analyzedLoneCount > 0 || analyzedThreadCount > 0,
            analyzed_lone_count: analyzedLoneCount,
            analyzed_thread_count: analyzedThreadCount,
        };
    }

    async getCommentSummaryForRuns(scraperRunIds = []) {
        const ids = [...new Set(scraperRunIds.filter(Boolean))];
        if (ids.length === 0) return new Map();

        const [totals, loneStats, loneAnalyzedStats, threadStats] = await Promise.all([
            this.postCommentModel.findAll({
                attributes: [
                    'scraper_run_id',
                    [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'total'],
                ],
                where: { scraper_run_id: { [Op.in]: ids } },
                group: ['scraper_run_id'],
                raw: true,
            }),
            this.postCommentModel.findAll({
                attributes: [
                    'scraper_run_id',
                    [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'lone_count'],
                    [
                        db.sequelize.literal(
                            "SUM(CASE WHEN classified_as = 'negative' THEN 1 ELSE 0 END)"
                        ),
                        'negative_count',
                    ],
                ],
                where: { scraper_run_id: { [Op.in]: ids }, group_type: 'lone' },
                group: ['scraper_run_id'],
                raw: true,
            }),
            this.postCommentModel.findAll({
                attributes: [
                    'scraper_run_id',
                    [
                        db.sequelize.literal(
                            "SUM(CASE WHEN analysis_status = 'done' OR classified_as IS NOT NULL OR reason IS NOT NULL THEN 1 ELSE 0 END)"
                        ),
                        'analyzed_lone_count',
                    ],
                ],
                where: { scraper_run_id: { [Op.in]: ids }, group_type: 'lone' },
                group: ['scraper_run_id'],
                raw: true,
            }),
            this.commentThreadModel.findAll({
                attributes: [
                    'scraper_run_id',
                    [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'thread_count'],
                    [
                        db.sequelize.literal(
                            "SUM(CASE WHEN classified_as = 'debate' THEN 1 ELSE 0 END)"
                        ),
                        'debate_count',
                    ],
                    [
                        db.sequelize.literal(
                            "SUM(CASE WHEN classified_as = 'negative' THEN 1 ELSE 0 END)"
                        ),
                        'thread_negative_count',
                    ],
                    [
                        db.sequelize.literal(
                            "SUM(CASE WHEN analysis_status = 'done' THEN 1 ELSE 0 END)"
                        ),
                        'analyzed_threads',
                    ],
                ],
                where: { scraper_run_id: { [Op.in]: ids } },
                group: ['scraper_run_id'],
                raw: true,
            }),
        ]);

        const map = new Map();
        for (const id of ids) {
            map.set(Number(id), {
                total: 0,
                lone_count: 0,
                thread_count: 0,
                negative_count: 0,
                debate_count: 0,
                analyzed: false,
            });
        }

        for (const row of totals) {
            const entry = map.get(Number(row.scraper_run_id));
            if (entry) entry.total = Number(row.total) || 0;
        }
        for (const row of loneStats) {
            const entry = map.get(Number(row.scraper_run_id));
            if (entry) {
                entry.lone_count = Number(row.lone_count) || 0;
                entry.negative_count = Number(row.negative_count) || 0;
            }
        }
        for (const row of loneAnalyzedStats) {
            const entry = map.get(Number(row.scraper_run_id));
            if (entry) {
                entry.analyzed_lone_count = Number(row.analyzed_lone_count) || 0;
                if (entry.analyzed_lone_count > 0) {
                    entry.analyzed = true;
                }
            }
        }
        for (const row of threadStats) {
            const entry = map.get(Number(row.scraper_run_id));
            if (entry) {
                entry.thread_count = Number(row.thread_count) || 0;
                entry.debate_count = Number(row.debate_count) || 0;
                entry.negative_count +=
                    Number(row.thread_negative_count) || 0;
                if ((Number(row.analyzed_threads) || 0) > 0) {
                    entry.analyzed = true;
                }
                if (entry.debate_count > 0) {
                    entry.analyzed = true;
                }
            }
        }

        return map;
    }

    async listYoutubeRunsForSubject(subjectId, { limit = 10, date_from, date_to } = {}) {
        const range = resolvePostedAtRange({ date_from, date_to });
        const postedAtWhere = buildPostedAtWhere(range);

        const links = await this.subjectScraperRunModel.findAll({
            where: { subject_id: subjectId },
            include: [
                {
                    model: this.scraperRunModel,
                    as: 'scraperRun',
                    required: true,
                    where: {
                        platform: 'youtube',
                        ...postedAtWhere,
                    },
                },
            ],
        });

        const scored = links
            .map((link) => {
                const run = link.scraperRun;
                if (!run) return null;
                const plain =
                    typeof run.toJSON === 'function' ? run.toJSON() : { ...run };
                const scores = calculateScores({
                    likes: plain.likes,
                    comments: plain.comments,
                    shares: plain.shares,
                    angry_count: plain.angry_count,
                    views: plain.views,
                    platform: plain.platform,
                });
                return { run: plain, hot_score: scores.hot_score };
            })
            .filter(Boolean)
            .sort((a, b) => b.hot_score - a.hot_score)
            .slice(0, Math.max(Number(limit) || 10, 1));

        return scored.map((item) => item.run);
    }

    async loadRunWithComments(scraperRunId) {
        const run = await this.scraperRunModel.findByPk(scraperRunId);
        if (!run) return null;

        const comments = await this.postCommentModel.findAll({
            where: { scraper_run_id: scraperRunId },
            order: [
                ['sort_order', 'ASC'],
                ['id', 'ASC'],
            ],
        });

        return { run, comments };
    }

    async needsAnalysis(scraperRunId) {
        const pendingLone = await this.postCommentModel.count({
            where: {
                scraper_run_id: scraperRunId,
                group_type: 'lone',
                analysis_status: 'pending',
            },
        });
        const pendingThreads = await this.commentThreadModel.count({
            where: {
                scraper_run_id: scraperRunId,
                analysis_status: 'pending',
            },
        });
        return pendingLone > 0 || pendingThreads > 0;
    }

    async applyAnalysisResult(scraperRunId, result = {}) {
        const now = new Date();

        for (const bucket of ['negative', 'normal']) {
            for (const item of result?.lone?.[bucket] || []) {
                await this.postCommentModel.update(
                    {
                        classified_as: normalizeLoneClassifiedAs(bucket),
                        sentiment: normalizeSentiment(item.sentiment),
                        category: normalizeCategory(item.category),
                        severity: normalizeSeverity(item.severity),
                        reason: normalizeReason(item.reason),
                        analysis_status: 'done',
                    },
                    {
                        where: {
                            scraper_run_id: scraperRunId,
                            platform_comment_id: item.comment_id,
                            group_type: 'lone',
                        },
                    }
                );
            }
        }

        for (const thread of result?.threads || []) {
            await this.commentThreadModel.update(
                {
                    classified_as: normalizeThreadClassifiedAs(thread.classified_as),
                    has_negativity: Boolean(thread.has_negativity),
                    sentiment: normalizeSentiment(thread.sentiment),
                    category: normalizeCategory(thread.category),
                    severity: normalizeSeverity(thread.severity),
                    reason: normalizeReason(thread.reason),
                    analysis_status: 'done',
                    analyzed_at: now,
                },
                {
                    where: {
                        scraper_run_id: scraperRunId,
                        thread_key: thread.thread_id,
                    },
                }
            );
        }

        await this.postCommentModel.update(
            { analysis_status: 'done' },
            {
                where: {
                    scraper_run_id: scraperRunId,
                    group_type: 'lone',
                    analysis_status: 'pending',
                },
            }
        );
    }

    async needsContentBrief(scraperRunId) {
        const run = await this.scraperRunModel.findByPk(scraperRunId, {
            attributes: ['id', 'content_brief', 'content_brief_status'],
        });
        if (!run) return false;
        if (run.content_brief_status === 'done' && run.content_brief) return false;
        if (run.content_brief_status === 'skipped') return false;
        return true;
    }

    async applyContentBrief(scraperRunId, brief, status = 'done') {
        const now = new Date();
        await this.scraperRunModel.update(
            {
                content_brief: brief,
                content_brief_status: status,
                content_brief_at: status === 'done' ? now : null,
            },
            { where: { id: scraperRunId } }
        );
    }

    async markContentBriefSkipped(scraperRunId) {
        await this.scraperRunModel.update(
            {
                content_brief: null,
                content_brief_status: 'skipped',
                content_brief_at: null,
            },
            { where: { id: scraperRunId } }
        );
    }

    async setContentBriefPending(scraperRunId) {
        await this.scraperRunModel.update(
            { content_brief_status: 'pending' },
            { where: { id: scraperRunId } }
        );
    }

    async resetContentBriefPending(scraperRunId) {
        await this.scraperRunModel.update(
            { content_brief_status: 'not_start' },
            { where: { id: scraperRunId, content_brief_status: 'pending' } }
        );
    }

    async getAnalysisPayloadForEmail(scraperRunId) {
        const run = await this.scraperRunModel.findByPk(scraperRunId);
        if (!run) return null;

        const data = await this.getCommentsByScraperRunId(scraperRunId);
        const scores = calculateScores({
            likes: run.likes,
            comments: run.comments,
            shares: run.shares,
            angry_count: run.angry_count,
            views: run.views,
            platform: run.platform,
        });

        const loneNegative = data.lone.filter((c) => c.classified_as === 'negative');
        const loneNormal = data.lone.filter((c) => c.classified_as === 'normal');
        const threadsNegative = data.threads.filter((t) => t.classified_as === 'negative');
        const threadsDebate = data.threads.filter((t) => t.classified_as === 'debate');
        const analysisRows = buildAnalysisRows(data.lone, data.threads);

        return {
            video: {
                id: run.id,
                platform_post_id: run.platform_post_id,
                title: run.title,
                post_url: run.post_url,
                hot_score: scores.hot_score,
                comment_total:
                    data.lone.length +
                    data.threads.reduce((s, t) => s + (t.comments?.length || 0), 0),
                content_brief: run.content_brief,
                content_brief_status: run.content_brief_status,
                content_brief_at: run.content_brief_at,
            },
            meta: data.meta,
            analysis_rows: analysisRows,
            lone_negative: loneNegative,
            lone_normal: loneNormal,
            threads_negative: threadsNegative,
            threads_debate: threadsDebate,
        };
    }
}

module.exports = CommentRepository;
