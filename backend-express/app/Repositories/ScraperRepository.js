'use strict';

const createError = require('http-errors');
const { Op } = require('sequelize');
const db = require('../Models');
const {
    normalizeApifyItem,
    calculateScores,
    toCount,
    deriveEngagementMetrics,
    classifyTrendDirection,
    isNewSocialPost,
} = require('../Helpers/PostScoreHelper');
const {
    includesNormalized,
    parsePersonName,
    personNameTokens,
} = require('../Helpers/TextNormalizeHelper');
const geminiConfig = require('../../config/gemini');

const NEW_WITHIN_HOURS = 48;

class ScraperRepository {
    constructor() {
        this.subjectModel = db.Subject;
        this.scraperRunModel = db.ScraperRun;
        this.subjectScraperRunModel = db.SubjectScraperRun;
        this.socialPostModel = db.SocialPost;
    }

    subjectMatchTokens(subject) {
        return personNameTokens({
            full: subject.name,
            realName: subject.name,
            alias: subject.normalized_name || null,
        });
    }

    incomingMatchTokens(entry) {
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
            const name = String(entry.name || '').trim();
            const nick = String(entry.nick_name || entry.nickname || '').trim();
            return personNameTokens({
                full: name,
                realName: name,
                alias: nick || null,
            });
        }

        return personNameTokens(parsePersonName(entry));
    }

    tokensOverlap(tokensA, tokensB) {
        for (const token of tokensA) {
            if (tokensB.has(token)) return true;
        }
        return false;
    }

    /**
     * Lưu subjects từ Gemini: name → name, nick_name → normalized_name.
     * Dedup nếu trùng name hoặc nick_name với bản ghi đã có.
     */
    async upsertSubjectsFromNames(entries, source = 'gemini') {
        const inserted = [];
        const existing = [];
        const pool = await this.subjectModel.findAll();

        for (const entry of entries) {
            let name = '';
            let nickName = '';

            if (typeof entry === 'string') {
                const parsed = parsePersonName(entry);
                name = parsed.realName;
                nickName = parsed.alias || '';
            } else if (entry && typeof entry === 'object') {
                name = String(entry.name || '').trim();
                nickName = String(entry.nick_name || entry.nickname || '').trim();
            }

            if (!name) continue;

            const incomingTokens = this.incomingMatchTokens({ name, nick_name: nickName });
            const matched = pool.find((subject) =>
                this.tokensOverlap(incomingTokens, this.subjectMatchTokens(subject))
            );

            if (matched) {
                existing.push(matched);
                continue;
            }

            const subject = await this.subjectModel.create({
                name,
                normalized_name: nickName || null,
                item_type: 'person',
                status: 'active',
                source,
            });
            pool.push(subject);
            inserted.push(subject);
        }

        return { inserted, existing, all: [...inserted, ...existing] };
    }

    async listSubjects({ page = 1, per_page = 20, status = null, q = null } = {}) {
        const limit = Math.min(Math.max(Number(per_page) || 20, 1), 100);
        const currentPage = Math.max(Number(page) || 1, 1);
        const offset = (currentPage - 1) * limit;
        const where = {};
        if (status) where.status = status;

        const keyword = String(q || '').trim();
        if (keyword) {
            const likeOp = db.sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;
            const term = `%${keyword}%`;
            where[Op.or] = [
                { name: { [likeOp]: term } },
                { normalized_name: { [likeOp]: term } },
            ];
        }

        const { rows, count } = await this.subjectModel.findAndCountAll({
            where,
            order: [['id', 'DESC']],
            limit,
            offset,
            include: [{ model: this.socialPostModel, as: 'socialPost' }],
        });

        const subjectIds = rows.map((row) => row.id);
        const linkCountBySubjectId = new Map();
        if (subjectIds.length > 0) {
            const linkRows = await this.subjectScraperRunModel.findAll({
                attributes: [
                    'subject_id',
                    [db.sequelize.literal('COUNT(*)'), 'scraper_runs_count'],
                ],
                where: { subject_id: { [Op.in]: subjectIds } },
                group: ['subject_id'],
                raw: true,
            });
            for (const linkRow of linkRows) {
                linkCountBySubjectId.set(
                    Number(linkRow.subject_id),
                    Number(linkRow.scraper_runs_count) || 0
                );
            }
        }

        const serialized = rows.map((row) =>
            this.serializeSubjectListItem(row, {
                scraper_runs_count: linkCountBySubjectId.get(Number(row.id)) || 0,
            })
        );

        return { rows: serialized, count, page: currentPage, per_page: limit };
    }

    serializeSubjectListItem(row, { scraper_runs_count = 0 } = {}) {
        const plain = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
        const socialPost = plain.socialPost
            ? this.serializeSocialPost(plain.socialPost)
            : null;

        return {
            id: plain.id,
            name: plain.name,
            normalized_name: plain.normalized_name,
            item_type: plain.item_type,
            status: plain.status,
            source: plain.source,
            created_at: plain.created_at,
            updated_at: plain.updated_at,
            scraper_runs_count,
            has_scraper_runs: scraper_runs_count > 0,
            can_delete: scraper_runs_count === 0,
            socialPost,
            aggregate: socialPost
                ? {
                      likes: socialPost.likes,
                      comments: socialPost.comments,
                      shares: socialPost.shares,
                      angry_count: socialPost.angry_count,
                      posts_count: socialPost.posts_count,
                      hot_score: socialPost.hot_score,
                      trend_score: socialPost.trend_score,
                      discussion: socialPost.discussion,
                      interaction: socialPost.interaction,
                      sentiment: socialPost.sentiment,
                      trend_direction: socialPost.trend_direction,
                      is_new: socialPost.is_new,
                      computed_at: socialPost.computed_at,
                  }
                : {
                      likes: 0,
                      comments: 0,
                      shares: 0,
                      angry_count: 0,
                      posts_count: 0,
                      hot_score: 0,
                      trend_score: 0,
                      discussion: 0,
                      interaction: 0,
                      sentiment: 0,
                      trend_direction: 'neutral',
                      is_new: false,
                      computed_at: null,
                  },
        };
    }

    async createSubject({
        name,
        normalized_name = null,
        item_type = 'person',
        status = 'active',
        source = 'manual',
    } = {}) {
        const trimmedName = String(name || '').trim();
        if (!trimmedName) {
            throw createError(422, 'name is required');
        }

        const nick = normalized_name != null ? String(normalized_name).trim() : '';
        const subject = await this.subjectModel.create({
            name: trimmedName,
            normalized_name: nick || null,
            item_type: item_type || 'person',
            status: status || 'active',
            source: source || 'manual',
        });

        return this.serializeSubjectListItem(subject, { scraper_runs_count: 0 });
    }

    async updateSubject(id, payload = {}) {
        const subject = await this.subjectModel.findByPk(id, {
            include: [{ model: this.socialPostModel, as: 'socialPost' }],
        });
        if (!subject) return null;

        const updates = {};
        if (payload.name !== undefined) {
            const trimmedName = String(payload.name || '').trim();
            if (!trimmedName) {
                throw createError(422, 'name is required');
            }
            updates.name = trimmedName;
        }
        if (payload.normalized_name !== undefined) {
            const nick = String(payload.normalized_name || '').trim();
            updates.normalized_name = nick || null;
        }
        if (payload.item_type !== undefined) updates.item_type = payload.item_type;
        if (payload.status !== undefined) updates.status = payload.status;

        if (Object.keys(updates).length > 0) {
            await subject.update(updates);
        }

        const scraper_runs_count = await this.subjectScraperRunModel.count({
            where: { subject_id: subject.id },
        });
        await subject.reload({
            include: [{ model: this.socialPostModel, as: 'socialPost' }],
        });

        return this.serializeSubjectListItem(subject, { scraper_runs_count });
    }

    async deleteSubject(id) {
        const subject = await this.subjectModel.findByPk(id);
        if (!subject) return null;

        const scraper_runs_count = await this.subjectScraperRunModel.count({
            where: { subject_id: subject.id },
        });
        if (scraper_runs_count > 0) {
            throw createError(
                409,
                `Không thể xóa đối tượng đang có ${scraper_runs_count} bài liên kết (subjects_scraper_runs)`
            );
        }

        await subject.destroy();
        return { id: Number(id), deleted: true };
    }

    async findSubjectById(id) {
        return this.subjectModel.findByPk(id, {
            include: [
                { model: this.socialPostModel, as: 'socialPost' },
                {
                    model: this.scraperRunModel,
                    as: 'scraperRuns',
                    through: { attributes: ['id', 'created_at'] },
                },
            ],
        });
    }

    serializeScraperRunPost(run) {
        const plain = typeof run.toJSON === 'function' ? run.toJSON() : { ...run };
        const scores = calculateScores({
            likes: plain.likes,
            comments: plain.comments,
            shares: plain.shares,
            angry_count: plain.angry_count,
        });
        const metrics = deriveEngagementMetrics({
            ...plain,
            hot_score: scores.hot_score,
            trend_score: scores.trend_score,
            posts_count: 1,
        });
        const through = plain.SubjectScraperRun || plain.subjects_scraper_runs || plain.subjectScraperRun;

        return {
            id: plain.id,
            platform: plain.platform,
            platform_post_id: plain.platform_post_id,
            post_url: plain.post_url,
            title: plain.title,
            text: plain.text,
            likes: toCount(plain.likes),
            comments: toCount(plain.comments),
            shares: toCount(plain.shares),
            angry_count: toCount(plain.angry_count),
            posted_at: plain.posted_at,
            scraped_at: plain.scraped_at,
            source: plain.source,
            external_run_id: plain.external_run_id,
            scraper_id: plain.scraper_id,
            hot_score: scores.hot_score,
            trend_score: scores.trend_score,
            discussion: metrics.discussion,
            interaction: metrics.interaction,
            sentiment: metrics.sentiment,
            linked_at: through?.created_at || through?.createdAt || null,
            created_at: plain.created_at,
            updated_at: plain.updated_at,
        };
    }

    buildSubjectPostsOrder(sortBy = 'posted_at') {
        const sequelize = db.sequelize;
        const run = { model: this.scraperRunModel, as: 'scraperRun' };
        switch (sortBy) {
            case 'likes':
                return [[run, 'likes', 'DESC'], [run, 'posted_at', 'DESC'], [run, 'id', 'DESC']];
            case 'comments':
                return [[run, 'comments', 'DESC'], [run, 'posted_at', 'DESC'], [run, 'id', 'DESC']];
            case 'shares':
                return [[run, 'shares', 'DESC'], [run, 'posted_at', 'DESC'], [run, 'id', 'DESC']];
            case 'interaction':
                return [
                    [
                        sequelize.literal(
                            '(`scraperRun`.`likes` + `scraperRun`.`comments` + `scraperRun`.`shares`)'
                        ),
                        'DESC',
                    ],
                    [run, 'posted_at', 'DESC'],
                    [run, 'id', 'DESC'],
                ];
            case 'hot_score':
                return [
                    [
                        sequelize.literal(
                            '(`scraperRun`.`shares` * 3 + `scraperRun`.`comments` * 2 + `scraperRun`.`angry_count` * 4 + `scraperRun`.`likes`)'
                        ),
                        'DESC',
                    ],
                    [run, 'posted_at', 'DESC'],
                    [run, 'id', 'DESC'],
                ];
            case 'posted_at':
            default:
                return [[run, 'posted_at', 'DESC'], [run, 'id', 'DESC']];
        }
    }

    /**
     * Chi tiết subject: thông tin + aggregate social_posts + danh sách bài liên quan (có metrics).
     */
    async getSubjectDetail(id, { page = 1, per_page = 20, sort_by = 'posted_at' } = {}) {
        const subject = await this.subjectModel.findByPk(id, {
            include: [{ model: this.socialPostModel, as: 'socialPost' }],
        });
        if (!subject) return null;

        const limit = Math.min(Math.max(Number(per_page) || 20, 1), 100);
        const currentPage = Math.max(Number(page) || 1, 1);
        const offset = (currentPage - 1) * limit;

        const { rows, count } = await this.subjectScraperRunModel.findAndCountAll({
            where: { subject_id: id },
            include: [
                {
                    model: this.scraperRunModel,
                    as: 'scraperRun',
                    attributes: { exclude: ['raw_data'] },
                    required: true,
                },
            ],
            order: this.buildSubjectPostsOrder(sort_by),
            limit,
            offset,
            distinct: true,
        });

        const plainSubject =
            typeof subject.toJSON === 'function' ? subject.toJSON() : { ...subject };
        const socialPost = plainSubject.socialPost || null;
        const aggregate = socialPost
            ? this.serializeSocialPost(socialPost)
            : {
                  likes: 0,
                  comments: 0,
                  shares: 0,
                  angry_count: 0,
                  posts_count: 0,
                  hot_score: 0,
                  trend_score: 0,
                  discussion: 0,
                  interaction: 0,
                  sentiment: 0,
                  trend_direction: 'down',
                  is_new: false,
                  computed_at: null,
              };

        delete plainSubject.socialPost;

        const posts = rows.map((link) => {
            const plainLink = typeof link.toJSON === 'function' ? link.toJSON() : link;
            const serialized = this.serializeScraperRunPost(plainLink.scraperRun || {});
            serialized.linked_at = plainLink.created_at || null;
            return serialized;
        });

        return {
            subject: {
                id: plainSubject.id,
                name: plainSubject.name,
                normalized_name: plainSubject.normalized_name,
                item_type: plainSubject.item_type,
                status: plainSubject.status,
                source: plainSubject.source,
                created_at: plainSubject.created_at,
                updated_at: plainSubject.updated_at,
            },
            aggregate,
            posts,
            pagination: {
                display: posts.length,
                total_records: count,
                per_page: limit,
                current_page: currentPage,
                total_pages: Math.ceil(count / limit) || 0,
            },
            sort_by,
        };
    }

    matchSubjectsForPost(post, subjects) {
        const haystack = `${post.title || ''} ${post.text || ''}`;
        return subjects.filter((subject) => {
            if (includesNormalized(haystack, subject.name)) return true;
            if (subject.normalized_name && includesNormalized(haystack, subject.normalized_name)) {
                return true;
            }
            return false;
        });
    }

    /**
     * Lưu từng item Apify vào scraper_runs, gắn subjects_scraper_runs, cập nhật social_posts.
     */
    async ingestApifyItems({ run, items }) {
        const subjects = await this.subjectModel.findAll({
            where: { status: 'active' },
        });
        const now = new Date();
        const affectedSubjectIds = new Set();

        let inserted = 0;
        let updated = 0;
        let skipped = 0;
        let linksCreated = 0;

        const savedRuns = [];

        await db.sequelize.transaction(async (transaction) => {
            for (const item of items) {
                const normalized = normalizeApifyItem(item);
                if (!normalized.platform_post_id) {
                    skipped += 1;
                    continue;
                }

                const payload = {
                    platform: normalized.platform,
                    platform_post_id: normalized.platform_post_id,
                    post_url: normalized.post_url,
                    title: normalized.title,
                    text: normalized.text,
                    likes: normalized.likes,
                    comments: normalized.comments,
                    shares: normalized.shares,
                    angry_count: normalized.angry_count,
                    posted_at: normalized.posted_at,
                    scraped_at: now,
                    source: 'apify',
                    external_run_id: run?.id || null,
                    scraper_id: run?.actId || run?.actorId || null,
                    raw_data: normalized.raw_data,
                };

                let scraperRun = await this.scraperRunModel.findOne({
                    where: {
                        platform: payload.platform,
                        platform_post_id: payload.platform_post_id,
                    },
                    transaction,
                });

                if (scraperRun) {
                    await scraperRun.update(payload, { transaction });
                    updated += 1;
                } else {
                    scraperRun = await this.scraperRunModel.create(payload, { transaction });
                    inserted += 1;
                }

                savedRuns.push(scraperRun);

                const matched = this.matchSubjectsForPost(scraperRun, subjects);
                for (const subject of matched) {
                    const [link, created] = await this.subjectScraperRunModel.findOrCreate({
                        where: {
                            subject_id: subject.id,
                            scraper_run_id: scraperRun.id,
                        },
                        defaults: {
                            subject_id: subject.id,
                            scraper_run_id: scraperRun.id,
                        },
                        transaction,
                    });
                    if (created) linksCreated += 1;
                    affectedSubjectIds.add(subject.id);
                    void link;
                }
            }

            for (const subjectId of affectedSubjectIds) {
                await this.recomputeSocialPost(subjectId, { transaction });
            }
        });

        return {
            upsert_stats: { inserted, updated, skipped, links_created: linksCreated },
            affected_subject_ids: [...affectedSubjectIds],
            items_saved: savedRuns.length,
        };
    }

    async recomputeSocialPost(subjectId, { transaction } = {}) {
        const links = await this.subjectScraperRunModel.findAll({
            where: { subject_id: subjectId },
            include: [{ model: this.scraperRunModel, as: 'scraperRun' }],
            transaction,
        });

        let likes = 0;
        let comments = 0;
        let shares = 0;
        let angry_count = 0;

        for (const link of links) {
            const post = link.scraperRun;
            if (!post) continue;
            likes += toCount(post.likes);
            comments += toCount(post.comments);
            shares += toCount(post.shares);
            angry_count += toCount(post.angry_count);
        }

        const scores = calculateScores({ likes, comments, shares, angry_count });
        const payload = {
            subject_id: subjectId,
            likes,
            comments,
            shares,
            angry_count,
            trend_score: scores.trend_score,
            hot_score: scores.hot_score,
            posts_count: links.length,
            computed_at: new Date(),
        };

        const existing = await this.socialPostModel.findOne({
            where: { subject_id: subjectId },
            transaction,
        });

        if (existing) {
            await existing.update(payload, { transaction });
            return existing;
        }

        return this.socialPostModel.create(payload, { transaction });
    }

    async listScraperRuns({ page = 1, per_page = 20 } = {}) {
        const limit = Math.min(Math.max(Number(per_page) || 20, 1), 100);
        const currentPage = Math.max(Number(page) || 1, 1);
        const offset = (currentPage - 1) * limit;

        const { rows, count } = await this.scraperRunModel.findAndCountAll({
            order: [['posted_at', 'DESC'], ['id', 'DESC']],
            limit,
            offset,
            include: [{ model: db.Subject, as: 'subjects', attributes: ['id', 'name'], through: { attributes: [] } }],
        });

        return { rows, count, page: currentPage, per_page: limit };
    }

    async findScraperRunById(id) {
        return this.scraperRunModel.findByPk(id, {
            include: [{ model: db.Subject, as: 'subjects', through: { attributes: ['id'] } }],
        });
    }

    trendThresholds() {
        return {
            hot: geminiConfig.alertHotThreshold,
            trend: geminiConfig.alertTrendThreshold,
        };
    }

    serializeSocialPost(row, { rank = null } = {}) {
        const plain = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
        const metrics = deriveEngagementMetrics(plain);
        const thresholds = this.trendThresholds();
        const direction = classifyTrendDirection(plain, {
            hotThreshold: thresholds.hot,
            trendThreshold: thresholds.trend,
        });

        return {
            ...plain,
            rank,
            discussion: metrics.discussion,
            interaction: metrics.interaction,
            sentiment: metrics.sentiment,
            trend_direction: direction,
            is_new: isNewSocialPost(plain, NEW_WITHIN_HOURS),
            hot_score: metrics.hot_score,
            trend_score: metrics.trend_score,
        };
    }

    buildSocialPostOrder(sortBy = 'hot_score') {
        const sequelize = db.sequelize;
        switch (sortBy) {
            case 'trend_score':
                return [['trend_score', 'DESC'], ['hot_score', 'DESC'], ['id', 'DESC']];
            case 'discussion':
                return [
                    [sequelize.literal('(comments + posts_count)'), 'DESC'],
                    ['hot_score', 'DESC'],
                    ['id', 'DESC'],
                ];
            case 'interaction':
                return [
                    [sequelize.literal('(likes + comments + shares)'), 'DESC'],
                    ['hot_score', 'DESC'],
                    ['id', 'DESC'],
                ];
            case 'sentiment':
                return [
                    [
                        sequelize.literal(
                            '(CASE WHEN (likes + angry_count) = 0 THEN 0 ELSE (likes - angry_count) / (likes + angry_count) END)'
                        ),
                        'DESC',
                    ],
                    ['hot_score', 'DESC'],
                    ['id', 'DESC'],
                ];
            case 'hot_score':
            default:
                return [['hot_score', 'DESC'], ['trend_score', 'DESC'], ['id', 'DESC']];
        }
    }

    buildSocialPostWhere({ new_only = false } = {}) {
        const where = {};
        if (new_only) {
            const since = new Date(Date.now() - NEW_WITHIN_HOURS * 60 * 60 * 1000);
            where.created_at = { [Op.gte]: since };
        }
        return where;
    }

    async listSocialPosts({
        page = 1,
        per_page = 20,
        sort_by = 'hot_score',
        new_only = false,
    } = {}) {
        const limit = Math.min(Math.max(Number(per_page) || 20, 1), 100);
        const currentPage = Math.max(Number(page) || 1, 1);
        const offset = (currentPage - 1) * limit;
        const where = this.buildSocialPostWhere({ new_only });

        const { rows, count } = await this.socialPostModel.findAndCountAll({
            where,
            order: this.buildSocialPostOrder(sort_by),
            limit,
            offset,
            include: [
                {
                    model: this.subjectModel,
                    as: 'subject',
                    attributes: ['id', 'name', 'normalized_name', 'status'],
                },
            ],
        });

        const result = rows.map((row, index) =>
            this.serializeSocialPost(row, { rank: offset + index + 1 })
        );

        return { rows: result, count, page: currentPage, per_page: limit };
    }

    async getSocialPostStats() {
        const thresholds = this.trendThresholds();
        const rows = await this.socialPostModel.findAll({
            attributes: ['id', 'hot_score', 'trend_score', 'likes', 'angry_count', 'created_at'],
        });

        let uptrend = 0;
        let downtrend = 0;
        let new_count = 0;

        for (const row of rows) {
            const plain = typeof row.toJSON === 'function' ? row.toJSON() : row;
            const direction = classifyTrendDirection(plain, {
                hotThreshold: thresholds.hot,
                trendThreshold: thresholds.trend,
            });
            if (direction === 'up') uptrend += 1;
            else if (direction === 'down') downtrend += 1;
            if (isNewSocialPost(plain, NEW_WITHIN_HOURS)) new_count += 1;
        }

        return {
            total: rows.length,
            uptrend,
            downtrend,
            neutral: rows.length - uptrend - downtrend,
            new_count,
            thresholds: {
                hot_score: thresholds.hot,
                trend_score: thresholds.trend,
            },
            definitions: {
                uptrend:
                    'Chủ đề đạt ngưỡng hot_score hoặc trend_score (đang nóng / tương tác mạnh).',
                downtrend:
                    'Cả hot_score và trend_score dưới 25% ngưỡng (engagement thấp / nguội).',
                neutral: 'Không thuộc uptrend hay downtrend.',
            },
        };
    }

    async getSocialPostChart({ sort_by = 'hot_score', limit = 10 } = {}) {
        const chartLimit = Math.min(Math.max(Number(limit) || 10, 1), 20);
        const rows = await this.socialPostModel.findAll({
            order: this.buildSocialPostOrder(sort_by),
            limit: chartLimit,
            include: [
                {
                    model: this.subjectModel,
                    as: 'subject',
                    attributes: ['id', 'name', 'normalized_name', 'status'],
                },
            ],
        });

        return rows.map((row, index) => this.serializeSocialPost(row, { rank: index + 1 }));
    }

    async getSocialPostsDashboard({
        page = 1,
        per_page = 20,
        sort_by = 'discussion',
        new_only = false,
        chart_limit = 10,
    } = {}) {
        const [stats, chart, list] = await Promise.all([
            this.getSocialPostStats(),
            this.getSocialPostChart({ sort_by, limit: chart_limit }),
            this.listSocialPosts({ page, per_page, sort_by, new_only }),
        ]);

        return {
            stats,
            chart,
            ranking: list.rows,
            pagination: {
                display: list.rows.length,
                total_records: list.count,
                per_page: list.per_page,
                current_page: list.page,
                total_pages: Math.ceil(list.count / list.per_page) || 0,
            },
            sort_by,
            new_only: Boolean(new_only),
        };
    }

    async listAlertCandidates({ subject_id = null } = {}) {
        const hot = geminiConfig.alertHotThreshold;
        const trend = geminiConfig.alertTrendThreshold;
        const where = {
            hot_score: { [Op.gte]: hot },
            trend_score: { [Op.gte]: trend },
        };
        if (subject_id) {
            where.subject_id = subject_id;
        }

        return this.socialPostModel.findAll({
            where,
            order: [['hot_score', 'DESC']],
            include: [{ model: this.subjectModel, as: 'subject', attributes: ['id', 'name'] }],
        });
    }
}

module.exports = ScraperRepository;
