'use strict';

const createError = require('http-errors');
const { Op } = require('sequelize');
const db = require('../Models');
const {
    normalizeApifyItem,
    calculateScores,
    calculateScoresFromRuns,
    toCount,
    deriveEngagementMetrics,
    classifyTrendDirection,
    isNewSocialPost,
    isWithinPostedAtRange,
    resolvePostedAtRange,
    buildPostedAtWhere,
    formatDateOnly,
    getCalendarMonthRange,
    normalizePlatform,
    resolveSubjectPlatform,
} = require('../Helpers/PostScoreHelper');
const { normalizeYoutubeVideo } = require('../Helpers/YouTubeHelper');
const { normalizeTikTokItem } = require('../Helpers/TikTokHelper');
const {
    parsePersonName,
    personNameTokens,
} = require('../Helpers/TextNormalizeHelper');
const { matchChannelByPostUrl } = require('../Helpers/ChannelUrlHelper');
const ChannelRepository = require('./ChannelRepository');
const CommentRepository = require('./CommentRepository');
const geminiConfig = require('../../config/gemini');
const { qualifyCol } = require('../Helpers/DialectHelper');

const NEW_WITHIN_HOURS = 48;

class ScraperRepository {
    constructor() {
        this.subjectModel = db.Subject;
        this.scraperRunModel = db.ScraperRun;
        this.subjectScraperRunModel = db.SubjectScraperRun;
        this.socialPostModel = db.SocialPost;
        this.channelRepository = new ChannelRepository();
        this.commentRepository = new CommentRepository();
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

    async listSubjects({
        page = 1,
        per_page = 20,
        status = null,
        q = null,
        sort_by = 'id',
        sort_dir,
    } = {}) {
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
            order: this.buildSubjectListOrder(sort_by, sort_dir),
            limit,
            offset,
            include: [
                { model: this.socialPostModel, as: 'socialPost' },
                ...this.subjectChannelIncludes(),
            ],
            distinct: true,
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

    /**
     * Sort list subjects: name / nickname (normalized_name) / metric trên social_posts.
     * Metric mặc định DESC; name/nickname mặc định ASC.
     * Dùng subquery để không phụ thuộc JOIN alias khi include channels.
     */
    buildSubjectListOrder(sortBy = 'id', sortDir) {
        const sequelize = db.sequelize;
        const key = String(sortBy || 'id').trim();
        const textKeys = new Set(['name', 'nickname']);
        const defaultDir = textKeys.has(key) ? 'ASC' : 'DESC';
        const dir =
            String(sortDir || defaultDir).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        const tieBreak = [['id', 'DESC']];

        const subjectId = qualifyCol(sequelize, 'Subject', 'id');
        const sp = (column) => qualifyCol(sequelize, 'sp', column);
        const metricSubquery = (expr) =>
            `(SELECT ${expr} FROM social_posts AS sp WHERE sp.subject_id = ${subjectId} LIMIT 1)`;

        // social_posts không có platform: heuristic YouTube = có views, shares=0, angry=0
        const ytHeuristic = `(COALESCE(${sp('views')}, 0) > 0 AND COALESCE(${sp('shares')}, 0) = 0 AND COALESCE(${sp('angry_count')}, 0) = 0)`;
        const discussionExpr = `COALESCE(${sp('comments')}, 0) + COALESCE(${sp('posts_count')}, 0)`;
        const interactionExpr = `CASE WHEN ${ytHeuristic} THEN (COALESCE(${sp('likes')}, 0) + COALESCE(${sp('comments')}, 0)) ELSE (COALESCE(${sp('likes')}, 0) + COALESCE(${sp('comments')}, 0) + COALESCE(${sp('shares')}, 0)) END`;
        const sentimentExpr = `CASE
            WHEN ${ytHeuristic} THEN 0
            WHEN (COALESCE(${sp('likes')}, 0) + COALESCE(${sp('angry_count')}, 0)) = 0 THEN 0
            ELSE (COALESCE(${sp('likes')}, 0) - COALESCE(${sp('angry_count')}, 0)) / (COALESCE(${sp('likes')}, 0) + COALESCE(${sp('angry_count')}, 0))
        END`;

        switch (key) {
            case 'name':
                return [['name', dir], ...tieBreak];
            case 'nickname':
                return [['normalized_name', dir], ...tieBreak];
            case 'discussion':
                return [
                    [sequelize.literal(`COALESCE(${metricSubquery(discussionExpr)}, 0)`), dir],
                    [sequelize.literal(`COALESCE(${metricSubquery(sp('hot_score'))}, 0)`), 'DESC'],
                    ...tieBreak,
                ];
            case 'interaction':
                return [
                    [sequelize.literal(`COALESCE(${metricSubquery(interactionExpr)}, 0)`), dir],
                    [sequelize.literal(`COALESCE(${metricSubquery(sp('hot_score'))}, 0)`), 'DESC'],
                    ...tieBreak,
                ];
            case 'follow':
                return [
                    [sequelize.literal(`COALESCE(${metricSubquery(sp('follow'))}, 0)`), dir],
                    [sequelize.literal(`COALESCE(${metricSubquery(sp('hot_score'))}, 0)`), 'DESC'],
                    ...tieBreak,
                ];
            case 'sentiment':
                return [
                    [sequelize.literal(`COALESCE(${metricSubquery(sentimentExpr)}, 0)`), dir],
                    [sequelize.literal(`COALESCE(${metricSubquery(sp('hot_score'))}, 0)`), 'DESC'],
                    ...tieBreak,
                ];
            case 'hot_score':
                return [
                    [sequelize.literal(`COALESCE(${metricSubquery(sp('hot_score'))}, 0)`), dir],
                    [sequelize.literal(`COALESCE(${metricSubquery(sp('trend_score'))}, 0)`), 'DESC'],
                    ...tieBreak,
                ];
            case 'trend_score':
                return [
                    [sequelize.literal(`COALESCE(${metricSubquery(sp('trend_score'))}, 0)`), dir],
                    [sequelize.literal(`COALESCE(${metricSubquery(sp('hot_score'))}, 0)`), 'DESC'],
                    ...tieBreak,
                ];
            case 'id':
            default:
                return [['id', dir === 'ASC' ? 'ASC' : 'DESC']];
        }
    }

    serializeChannel(row) {
        const plain = typeof row?.toJSON === 'function' ? row.toJSON() : { ...row };
        const scraper_runs_count = Number(plain.scraper_runs_count ?? 0) || 0;
        return {
            id: plain.id,
            name: plain.name,
            url: plain.url,
            type_channel: plain.type_channel,
            scraper_runs_count,
            has_scraper_runs: scraper_runs_count > 0,
            can_edit_url: false,
            can_edit_type_channel: false,
            can_delete: scraper_runs_count === 0,
            created_at: plain.created_at ?? null,
            updated_at: plain.updated_at ?? null,
        };
    }

    subjectChannelIncludes() {
        return [
            {
                model: db.Channel,
                as: 'channels',
                through: { attributes: [] },
            },
        ];
    }

    pickChannelIds(payload, key) {
        if (payload[key] === undefined) return undefined;
        const raw = payload[key];
        if (!Array.isArray(raw)) return [];
        return [...new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    }

    async syncSubjectChannels(subjectId, { channel_ids }, { transaction } = {}) {
        if (channel_ids === undefined) return { reconciled: false };

        if (channel_ids.length > 0) {
            const found = await db.Channel.count({
                where: { id: { [Op.in]: channel_ids } },
                transaction,
            });
            if (found !== channel_ids.length) {
                throw createError(422, 'One or more channel_ids not found');
            }
        }
        await db.SubjectChannel.destroy({
            where: { subject_id: subjectId },
            transaction,
        });
        if (channel_ids.length > 0) {
            await db.SubjectChannel.bulkCreate(
                channel_ids.map((channel_id) => ({
                    subject_id: subjectId,
                    channel_id,
                })),
                { transaction }
            );
        }

        const linkStats = await this.reconcileSubjectScraperRuns(subjectId, { transaction });
        return { reconciled: true, ...linkStats };
    }

    /**
     * Đồng bộ subjects_scraper_runs theo subject_channels hiện tại:
     * - Xóa link tới bài có channel_id không thuộc subject (hoặc channel_id null)
     * - Tạo link tới mọi scraper_runs của các channel đang gắn
     */
    async reconcileSubjectScraperRuns(subjectId, { transaction } = {}) {
        const sid = Number(subjectId);
        const channelRows = await db.SubjectChannel.findAll({
            where: { subject_id: sid },
            attributes: ['channel_id'],
            transaction,
        });
        const channelIds = channelRows.map((row) => Number(row.channel_id)).filter(Boolean);
        const channelSet = new Set(channelIds);

        const existingLinks = await this.subjectScraperRunModel.findAll({
            where: { subject_id: sid },
            include: [
                {
                    model: this.scraperRunModel,
                    as: 'scraperRun',
                    attributes: ['id', 'channel_id'],
                    required: false,
                },
            ],
            transaction,
        });

        const removeIds = [];
        for (const link of existingLinks) {
            const chId =
                link.scraperRun?.channel_id != null ? Number(link.scraperRun.channel_id) : null;
            if (chId == null || !channelSet.has(chId)) {
                removeIds.push(link.id);
            }
        }

        let removed = 0;
        if (removeIds.length > 0) {
            removed = await this.subjectScraperRunModel.destroy({
                where: { id: { [Op.in]: removeIds } },
                transaction,
            });
        }

        let linked = 0;
        if (channelIds.length > 0) {
            const runs = await this.scraperRunModel.findAll({
                where: { channel_id: { [Op.in]: channelIds } },
                attributes: ['id'],
                transaction,
            });
            for (const run of runs) {
                const [, created] = await this.subjectScraperRunModel.findOrCreate({
                    where: {
                        subject_id: sid,
                        scraper_run_id: run.id,
                    },
                    defaults: {
                        subject_id: sid,
                        scraper_run_id: run.id,
                    },
                    transaction,
                });
                if (created) linked += 1;
            }
        }

        return { removed: Number(removed) || 0, linked };
    }

    /**
     * Khi scrape 1 channel: bỏ link cũ của subject không còn gắn channel,
     * rồi reconcile mọi subject đang/đã từng liên quan tới bài của channel đó.
     */
    async reconcileLinksForChannel(channelId, { transaction } = {}) {
        const cid = Number(channelId);
        if (!cid) return [];

        const currentSubjectIds = (
            await this.channelRepository.listSubjectIdsForChannel(cid, { transaction })
        ).map(Number);
        const currentSet = new Set(currentSubjectIds);
        const affected = new Set(currentSubjectIds);

        const sequelize = db.sequelize;
        const staleRows = await sequelize.query(
            `SELECT DISTINCT ssr.subject_id AS subject_id
             FROM subjects_scraper_runs ssr
             INNER JOIN scraper_runs sr ON sr.id = ssr.scraper_run_id
             WHERE sr.channel_id = :channelId`,
            {
                replacements: { channelId: cid },
                type: sequelize.QueryTypes.SELECT,
                transaction,
            }
        );
        for (const row of staleRows) {
            affected.add(Number(row.subject_id));
        }

        // Gỡ link bài của channel này khỏi subject không còn map channel
        if (currentSet.size === 0) {
            await sequelize.query(
                `DELETE ssr FROM subjects_scraper_runs ssr
                 INNER JOIN scraper_runs sr ON sr.id = ssr.scraper_run_id
                 WHERE sr.channel_id = :channelId`,
                { replacements: { channelId: cid }, transaction }
            );
        } else {
            await sequelize.query(
                `DELETE ssr FROM subjects_scraper_runs ssr
                 INNER JOIN scraper_runs sr ON sr.id = ssr.scraper_run_id
                 WHERE sr.channel_id = :channelId
                   AND ssr.subject_id NOT IN (:subjectIds)`,
                {
                    replacements: {
                        channelId: cid,
                        subjectIds: [...currentSet],
                    },
                    transaction,
                }
            );
        }

        for (const sid of affected) {
            await this.reconcileSubjectScraperRuns(sid, { transaction });
        }

        return [...affected];
    }

    /**
     * Gắn đúng subjects hiện tại cho 1 scraper_run; xóa link subject cũ không còn thuộc channel.
     */
    async syncScraperRunSubjectLinks(scraperRunId, subjectIdsToLink, { transaction } = {}) {
        const allowed = [...new Set([...subjectIdsToLink].map(Number).filter(Boolean))];
        const allowedSet = new Set(allowed);
        let linksCreated = 0;
        let linksRemoved = 0;

        const existingLinks = await this.subjectScraperRunModel.findAll({
            where: { scraper_run_id: scraperRunId },
            attributes: ['id', 'subject_id'],
            transaction,
        });

        const removeIds = [];
        for (const link of existingLinks) {
            const sid = Number(link.subject_id);
            if (!allowedSet.has(sid)) {
                removeIds.push(link.id);
            }
        }
        if (removeIds.length > 0) {
            linksRemoved = await this.subjectScraperRunModel.destroy({
                where: { id: { [Op.in]: removeIds } },
                transaction,
            });
        }

        for (const subjectId of allowed) {
            const [, created] = await this.subjectScraperRunModel.findOrCreate({
                where: {
                    subject_id: subjectId,
                    scraper_run_id: scraperRunId,
                },
                defaults: {
                    subject_id: subjectId,
                    scraper_run_id: scraperRunId,
                },
                transaction,
            });
            if (created) linksCreated += 1;
        }

        return {
            links_created: Number(linksCreated) || 0,
            links_removed: Number(linksRemoved) || 0,
            subject_ids: allowed,
            previous_subject_ids: existingLinks.map((l) => Number(l.subject_id)),
        };
    }

    serializeSubjectListItem(row, { scraper_runs_count = 0 } = {}) {
        const plain = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
        const socialPost = plain.socialPost
            ? this.serializeSocialPost(plain.socialPost)
            : null;
        const channels = (plain.channels || []).map((ch) => this.serializeChannel(ch));

        return {
            id: plain.id,
            name: plain.name,
            normalized_name: plain.normalized_name,
            item_type: plain.item_type,
            status: plain.status,
            source: plain.source,
            created_at: plain.created_at,
            updated_at: plain.updated_at,
            channels,
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
                      follow: socialPost.follow ?? 0,
                      views: socialPost.views ?? 0,
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
                      follow: 0,
                      views: 0,
                      posts_count: 0,
                      hot_score: 0,
                      trend_score: 0,
                      discussion: 0,
                      interaction: 0,
                      sentiment: 0,
                      trend_direction: 'down',
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
        channel_ids,
    } = {}) {
        const trimmedName = String(name || '').trim();
        if (!trimmedName) {
            throw createError(422, 'name is required');
        }

        const nick = normalized_name != null ? String(normalized_name).trim() : '';
        const ids = this.pickChannelIds({ channel_ids }, 'channel_ids');

        const subject = await db.sequelize.transaction(async (transaction) => {
            const created = await this.subjectModel.create(
                {
                    name: trimmedName,
                    normalized_name: nick || null,
                    item_type: item_type || 'person',
                    status: status || 'active',
                    source: source || 'manual',
                },
                { transaction }
            );

            await this.syncSubjectChannels(
                created.id,
                { channel_ids: ids ?? [] },
                { transaction }
            );
            await this.recomputeSocialPost(created.id, { transaction });

            return created;
        });

        const scraper_runs_count = await this.subjectScraperRunModel.count({
            where: { subject_id: subject.id },
        });
        await subject.reload({
            include: [
                { model: this.socialPostModel, as: 'socialPost' },
                ...this.subjectChannelIncludes(),
            ],
        });

        return this.serializeSubjectListItem(subject, { scraper_runs_count });
    }

    async updateSubject(id, payload = {}) {
        const subject = await this.subjectModel.findByPk(id, {
            include: [
                { model: this.socialPostModel, as: 'socialPost' },
                ...this.subjectChannelIncludes(),
            ],
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

        const ids = this.pickChannelIds(payload, 'channel_ids');

        await db.sequelize.transaction(async (transaction) => {
            if (Object.keys(updates).length > 0) {
                await subject.update(updates, { transaction });
            }
            const syncResult = await this.syncSubjectChannels(
                subject.id,
                { channel_ids: ids },
                { transaction }
            );
            if (syncResult?.reconciled) {
                await this.recomputeSocialPost(subject.id, { transaction });
            }
        });

        const scraper_runs_count = await this.subjectScraperRunModel.count({
            where: { subject_id: subject.id },
        });
        await subject.reload({
            include: [
                { model: this.socialPostModel, as: 'socialPost' },
                ...this.subjectChannelIncludes(),
            ],
        });

        return this.serializeSubjectListItem(subject, { scraper_runs_count });
    }

    async attachSubjectChannel(subjectId, channelId) {
        const result = await this.channelRepository.attachSubjectChannel(subjectId, channelId);

        await db.sequelize.transaction(async (transaction) => {
            await this.reconcileSubjectScraperRuns(subjectId, { transaction });
            // Channel có thể vừa tách khỏi subject khác — dọn link sót trên channel này
            const affected = await this.reconcileLinksForChannel(channelId, { transaction });
            const toRecompute = new Set([Number(subjectId), ...affected.map(Number)]);
            for (const sid of toRecompute) {
                await this.recomputeSocialPost(sid, { transaction });
            }
        });

        return result;
    }

    async detachSubjectChannel(subjectId, channelId) {
        const result = await this.channelRepository.detachSubjectChannel(subjectId, channelId);

        await db.sequelize.transaction(async (transaction) => {
            await this.reconcileSubjectScraperRuns(subjectId, { transaction });
            const affected = await this.reconcileLinksForChannel(channelId, { transaction });
            const toRecompute = new Set([Number(subjectId), ...affected.map(Number)]);
            for (const sid of toRecompute) {
                await this.recomputeSocialPost(sid, { transaction });
            }
        });

        return result;
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
            views: plain.views,
            platform: plain.platform,
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
            follow: toCount(plain.follow),
            views: toCount(plain.views),
            posted_at: plain.posted_at,
            scraped_at: plain.scraped_at,
            source: plain.source,
            external_run_id: plain.external_run_id,
            scraper_id: plain.scraper_id,
            channel_id: plain.channel_id ?? null,
            hot_score: scores.hot_score,
            trend_score: scores.trend_score,
            discussion: metrics.discussion,
            interaction: metrics.interaction,
            sentiment: metrics.sentiment,
            linked_at: through?.created_at || through?.createdAt || null,
            created_at: plain.created_at,
            updated_at: plain.updated_at,
            content_brief: plain.content_brief ?? null,
            content_brief_status: plain.content_brief_status ?? 'not_start',
            content_brief_at: plain.content_brief_at ?? null,
        };
    }

    buildSubjectPostsOrder(sortBy = 'posted_at') {
        const sequelize = db.sequelize;
        const run = { model: this.scraperRunModel, as: 'scraperRun' };
        const likes = qualifyCol(sequelize, 'scraperRun', 'likes');
        const comments = qualifyCol(sequelize, 'scraperRun', 'comments');
        const shares = qualifyCol(sequelize, 'scraperRun', 'shares');
        const angry = qualifyCol(sequelize, 'scraperRun', 'angry_count');
        const views = qualifyCol(sequelize, 'scraperRun', 'views');
        const platform = qualifyCol(sequelize, 'scraperRun', 'platform');

        const hotScoreExpr = `(CASE
            WHEN LOWER(${platform}) = 'youtube' THEN (${likes} + ${comments} * 3 + FLOOR(${views} / 100) * 3)
            WHEN LOWER(${platform}) = 'tiktok' THEN (${likes} + ${comments} * 3 + ${shares} * 3 + FLOOR(${views} / 100) * 2)
            ELSE (${likes} + ${comments} * 2 + ${shares} * 3 + ${angry} * 4)
        END)`;
        const trendScoreExpr = `(CASE
            WHEN LOWER(${platform}) = 'youtube' THEN (${likes} + ${comments} * 2 + FLOOR(${views} / 100) * 3)
            WHEN LOWER(${platform}) = 'tiktok' THEN (${likes} + ${comments} * 2 + ${shares} * 3 + FLOOR(${views} / 100) * 2)
            ELSE (${likes} + ${comments} * 2 + ${shares} * 3)
        END)`;
        const interactionExpr = `(CASE
            WHEN LOWER(${platform}) = 'youtube' THEN (${likes} + ${comments})
            WHEN LOWER(${platform}) = 'tiktok' THEN (${likes} + ${comments} + ${shares})
            ELSE (${likes} + ${comments} + ${shares})
        END)`;

        switch (sortBy) {
            case 'likes':
                return [[run, 'likes', 'DESC'], [run, 'posted_at', 'DESC'], [run, 'id', 'DESC']];
            case 'comments':
                return [[run, 'comments', 'DESC'], [run, 'posted_at', 'DESC'], [run, 'id', 'DESC']];
            case 'shares':
                return [[run, 'shares', 'DESC'], [run, 'posted_at', 'DESC'], [run, 'id', 'DESC']];
            case 'interaction':
                return [
                    [sequelize.literal(interactionExpr), 'DESC'],
                    [run, 'posted_at', 'DESC'],
                    [run, 'id', 'DESC'],
                ];
            case 'hot_score':
                return [
                    [sequelize.literal(hotScoreExpr), 'DESC'],
                    [run, 'posted_at', 'DESC'],
                    [run, 'id', 'DESC'],
                ];
            case 'trend_score':
                return [
                    [sequelize.literal(trendScoreExpr), 'DESC'],
                    [run, 'posted_at', 'DESC'],
                    [run, 'id', 'DESC'],
                ];
            case 'posted_at':
            default:
                return [[run, 'posted_at', 'DESC'], [run, 'id', 'DESC']];
        }
    }

    async countSubjectPostsByPlatform(subjectId, { date_from, date_to } = {}) {
        const sequelize = db.sequelize;
        const range = resolvePostedAtRange({ date_from, date_to });
        const rows = await sequelize.query(
            `SELECT sr.platform AS platform, COUNT(*) AS count
             FROM subjects_scraper_runs ssr
             INNER JOIN scraper_runs sr ON sr.id = ssr.scraper_run_id
             WHERE ssr.subject_id = :subjectId
               AND sr.posted_at >= :start
               AND sr.posted_at < :end
             GROUP BY sr.platform
             ORDER BY count DESC`,
            {
                replacements: {
                    subjectId: Number(subjectId),
                    start: range.start,
                    end: range.end,
                },
                type: sequelize.QueryTypes.SELECT,
            }
        );

        const posts_by_platform = {};
        let total = 0;
        for (const row of rows) {
            const key = String(row.platform || 'facebook').toLowerCase();
            const count = Number(row.count) || 0;
            posts_by_platform[key] = count;
            total += count;
        }
        posts_by_platform.all = total;
        return posts_by_platform;
    }

    /**
     * Aggregate engagement của 1 subject trong cửa sổ posted_at.
     */
    buildAggregateFromRuns(runs = []) {
        let likes = 0;
        let comments = 0;
        let shares = 0;
        let angry_count = 0;
        let views = 0;
        let posts_count = 0;
        const followByChannel = new Map();
        const scoreInputs = [];

        for (const post of runs) {
            if (!post) continue;
            likes += toCount(post.likes);
            comments += toCount(post.comments);
            shares += toCount(post.shares);
            angry_count += toCount(post.angry_count);
            views += toCount(post.views);
            posts_count += 1;
            scoreInputs.push({
                platform: post.platform,
                likes: post.likes,
                comments: post.comments,
                shares: post.shares,
                angry_count: post.angry_count,
                views: post.views,
            });

            const channelKey =
                post.channel_id != null ? `ch:${post.channel_id}` : `run:${post.id}`;
            const follow = toCount(post.follow);
            const prev = followByChannel.get(channelKey) || 0;
            if (follow > prev) followByChannel.set(channelKey, follow);
        }

        let follow = 0;
        for (const value of followByChannel.values()) {
            follow += value;
        }

        const scores = calculateScoresFromRuns(scoreInputs);
        return {
            likes,
            comments,
            shares,
            angry_count,
            views,
            follow,
            posts_count,
            trend_score: scores.trend_score,
            hot_score: scores.hot_score,
            computed_at: new Date(),
        };
    }

    /**
     * Chi tiết subject: aggregate + bài viết theo cửa sổ posted_at (mặc định tháng hiện tại).
     */
    async getSubjectDetail(
        id,
        { page = 1, per_page = 20, sort_by = 'posted_at', platform = null, date_from, date_to } = {}
    ) {
        const subject = await this.subjectModel.findByPk(id, {
            include: [
                { model: this.socialPostModel, as: 'socialPost' },
                ...this.subjectChannelIncludes(),
            ],
        });
        if (!subject) return null;

        const range = resolvePostedAtRange({ date_from, date_to });
        const postedAtWhere = buildPostedAtWhere(range);

        const limit = Math.min(Math.max(Number(per_page) || 20, 1), 100);
        const currentPage = Math.max(Number(page) || 1, 1);
        const offset = (currentPage - 1) * limit;

        const platformFilter = platform ? String(platform).trim().toLowerCase() : null;
        const scraperRunWhere = { ...postedAtWhere };
        if (platformFilter) {
            scraperRunWhere.platform = platformFilter;
        }

        const scraperRunInclude = {
            model: this.scraperRunModel,
            as: 'scraperRun',
            attributes: { exclude: ['raw_data'] },
            required: true,
            where: scraperRunWhere,
        };

        const { rows, count } = await this.subjectScraperRunModel.findAndCountAll({
            where: { subject_id: id },
            include: [scraperRunInclude],
            order: this.buildSubjectPostsOrder(sort_by),
            limit,
            offset,
            distinct: true,
        });

        // Aggregate toàn bộ bài trong cửa sổ (không phụ thuộc page/platform filter cho totals).
        const allLinksInRange = await this.subjectScraperRunModel.findAll({
            where: { subject_id: id },
            include: [
                {
                    model: this.scraperRunModel,
                    as: 'scraperRun',
                    attributes: [
                        'id',
                        'platform',
                        'likes',
                        'comments',
                        'shares',
                        'angry_count',
                        'views',
                        'follow',
                        'channel_id',
                        'posted_at',
                    ],
                    required: true,
                    where: postedAtWhere,
                },
            ],
        });
        const aggregatePayload = this.buildAggregateFromRuns(
            allLinksInRange.map((link) => link.scraperRun)
        );
        const aggregate = this.serializeSocialPost({
            ...aggregatePayload,
            subject_id: Number(id),
            created_at: subject.created_at,
            subject: typeof subject.toJSON === 'function' ? subject.toJSON() : subject,
        });

        const posts_by_platform = await this.countSubjectPostsByPlatform(id, {
            date_from: formatDateOnly(range.start),
            date_to: formatDateOnly(new Date(range.end.getTime() - 1)),
        });

        const plainSubject =
            typeof subject.toJSON === 'function' ? subject.toJSON() : { ...subject };
        const channels = (plainSubject.channels || []).map((ch) => this.serializeChannel(ch));

        delete plainSubject.socialPost;
        delete plainSubject.channels;

        const posts = rows.map((link) => {
            const plainLink = typeof link.toJSON === 'function' ? link.toJSON() : link;
            const serialized = this.serializeScraperRunPost(plainLink.scraperRun || {});
            serialized.linked_at = plainLink.created_at || null;
            return serialized;
        });

        const commentSummaryMap = await this.commentRepository.getCommentSummaryForRuns(
            posts.map((p) => p.id)
        );
        for (const post of posts) {
            post.comment_summary = commentSummaryMap.get(Number(post.id)) || {
                total: 0,
                lone_count: 0,
                thread_count: 0,
                negative_count: 0,
                debate_count: 0,
                analyzed: false,
            };
        }

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
                channels,
            },
            aggregate,
            posts,
            posts_by_platform,
            pagination: {
                display: posts.length,
                total_records: count,
                per_page: limit,
                current_page: currentPage,
                total_pages: Math.ceil(count / limit) || 0,
            },
            sort_by,
            platform: platformFilter,
            date_from: formatDateOnly(range.start),
            date_to: formatDateOnly(new Date(range.end.getTime() - 1)),
        };
    }

    /**
     * Lưu từng item Apify vào scraper_runs, gắn subjects qua subject_channels, cập nhật social_posts.
     * @param {{ run: object, items: object[], channels: Array<{id,url}> }} params
     */
    async ingestApifyItems({ run, items, channels = [] }) {
        const now = new Date();
        const affectedSubjectIds = new Set();
        const channelList = Array.isArray(channels) ? channels : [];

        let inserted = 0;
        let updated = 0;
        let skipped = 0;
        let linksCreated = 0;
        let unmatchedChannel = 0;

        const savedRuns = [];

        await db.sequelize.transaction(async (transaction) => {
            for (const item of items) {
                const normalized = normalizeApifyItem(item);
                if (!normalized.platform_post_id) {
                    skipped += 1;
                    continue;
                }

                let matchedChannel = null;
                if (channelList.length === 1) {
                    matchedChannel = channelList[0];
                } else if (channelList.length > 1) {
                    matchedChannel =
                        matchChannelByPostUrl(normalized.post_url, channelList) ||
                        matchChannelByPostUrl(normalized.input_url || null, channelList);
                }

                if (!matchedChannel && channelList.length > 0) {
                    unmatchedChannel += 1;
                }

                const channelFk = {
                    channel_id: matchedChannel ? matchedChannel.id : null,
                };

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
                    views: toCount(normalized.views),
                    follow: toCount(normalized.follow),
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
                    const updatePayload = { ...payload };
                    if (scraperRun.channel_id == null && matchedChannel) {
                        Object.assign(updatePayload, channelFk);
                    }
                    await scraperRun.update(updatePayload, { transaction });
                    updated += 1;
                } else {
                    scraperRun = await this.scraperRunModel.create(
                        { ...payload, ...channelFk },
                        { transaction }
                    );
                    inserted += 1;
                }

                savedRuns.push(scraperRun);

                const subjectIdsToLink = new Set();

                if (matchedChannel) {
                    const linkedSubjectIds = await this.channelRepository.listSubjectIdsForChannel(
                        matchedChannel.id,
                        { transaction }
                    );
                    for (const sid of linkedSubjectIds) {
                        subjectIdsToLink.add(sid);
                    }
                }

                const linkSync = await this.syncScraperRunSubjectLinks(
                    scraperRun.id,
                    subjectIdsToLink,
                    { transaction }
                );
                linksCreated += linkSync.links_created;
                for (const sid of linkSync.previous_subject_ids) {
                    affectedSubjectIds.add(sid);
                }
                for (const sid of linkSync.subject_ids) {
                    affectedSubjectIds.add(sid);
                }
            }

            for (const subjectId of affectedSubjectIds) {
                await this.recomputeSocialPost(subjectId, { transaction });
            }
        });

        return {
            upsert_stats: {
                inserted,
                updated,
                skipped,
                links_created: linksCreated,
                unmatched_channel: unmatchedChannel,
            },
            affected_subject_ids: [...affectedSubjectIds],
            items_saved: savedRuns.length,
            saved_runs: savedRuns.map((row) => ({
                id: row.id,
                platform_post_id: row.platform_post_id,
                post_url: row.post_url,
            })),
        };
    }

    /**
     * Lưu video YouTube vào scraper_runs, gắn subjects qua subject_channels, cập nhật social_posts.
     * @param {{ videos: object[], channels: Array<{id,url}>, channel?: {id,url} }} params
     *   videos — raw videos.list items HOẶC đã normalize (có platform_post_id)
     *   channel — khi scrape 1 kênh, ưu tiên gán channel_id này
     */
    async ingestYoutubeItems({ videos = [], channels = [], channel = null } = {}) {
        const now = new Date();
        const affectedSubjectIds = new Set();
        const channelList = Array.isArray(channels) ? channels : [];
        const preferredChannel = channel || (channelList.length === 1 ? channelList[0] : null);

        let inserted = 0;
        let updated = 0;
        let skipped = 0;
        let linksCreated = 0;
        let linksRemoved = 0;
        let unmatchedChannel = 0;

        const savedRuns = [];

        await db.sequelize.transaction(async (transaction) => {
            for (const item of videos) {
                const normalized =
                    item && item.platform === 'youtube' && item.platform_post_id
                        ? item
                        : normalizeYoutubeVideo(item);

                if (!normalized.platform_post_id) {
                    skipped += 1;
                    continue;
                }

                let matchedChannel = preferredChannel;
                if (!matchedChannel && channelList.length > 1) {
                    matchedChannel = matchChannelByPostUrl(
                        normalized.post_url,
                        channelList
                    );
                }

                if (!matchedChannel && channelList.length > 0 && !preferredChannel) {
                    unmatchedChannel += 1;
                }

                const channelFk = {
                    channel_id: matchedChannel ? matchedChannel.id : null,
                };

                const payload = {
                    platform: 'youtube',
                    platform_post_id: normalized.platform_post_id,
                    post_url: normalized.post_url,
                    title: normalized.title,
                    text: normalized.text,
                    likes: normalized.likes,
                    comments: normalized.comments,
                    shares: 0,
                    angry_count: 0,
                    views: toCount(normalized.views),
                    follow: toCount(normalized.follow),
                    posted_at: normalized.posted_at,
                    scraped_at: now,
                    source: 'youtube_api',
                    external_run_id: null,
                    scraper_id: 'youtube_data_api_v3',
                    raw_data: normalized.raw_data || item,
                };

                let scraperRun = await this.scraperRunModel.findOne({
                    where: {
                        platform: payload.platform,
                        platform_post_id: payload.platform_post_id,
                    },
                    transaction,
                });

                if (scraperRun) {
                    const updatePayload = { ...payload };
                    // YouTube: luôn gắn đúng channel đang scrape (tránh sót khi đổi subject/channel)
                    if (matchedChannel) {
                        Object.assign(updatePayload, channelFk);
                    }
                    await scraperRun.update(updatePayload, { transaction });
                    updated += 1;
                } else {
                    scraperRun = await this.scraperRunModel.create(
                        { ...payload, ...channelFk },
                        { transaction }
                    );
                    inserted += 1;
                }

                savedRuns.push(scraperRun);

                const subjectIdsToLink = new Set();

                if (matchedChannel) {
                    const linkedSubjectIds = await this.channelRepository.listSubjectIdsForChannel(
                        matchedChannel.id,
                        { transaction }
                    );
                    for (const sid of linkedSubjectIds) {
                        subjectIdsToLink.add(sid);
                    }
                }

                const linkSync = await this.syncScraperRunSubjectLinks(
                    scraperRun.id,
                    subjectIdsToLink,
                    { transaction }
                );
                linksCreated += linkSync.links_created;
                linksRemoved += linkSync.links_removed;
                for (const sid of linkSync.previous_subject_ids) {
                    affectedSubjectIds.add(sid);
                }
                for (const sid of linkSync.subject_ids) {
                    affectedSubjectIds.add(sid);
                }
            }

            // Đồng bộ toàn bộ bài của channel (kể cả video cũ không nằm trong batch scrape lần này)
            const channelsToReconcile = new Set();
            if (preferredChannel?.id) channelsToReconcile.add(Number(preferredChannel.id));
            for (const ch of channelList) {
                if (ch?.id) channelsToReconcile.add(Number(ch.id));
            }
            for (const channelId of channelsToReconcile) {
                const reconciledSubjects = await this.reconcileLinksForChannel(channelId, {
                    transaction,
                });
                for (const sid of reconciledSubjects) {
                    affectedSubjectIds.add(sid);
                }
            }

            for (const subjectId of affectedSubjectIds) {
                await this.recomputeSocialPost(subjectId, { transaction });
            }
        });

        return {
            upsert_stats: {
                inserted,
                updated,
                skipped,
                links_created: linksCreated,
                links_removed: linksRemoved,
                unmatched_channel: unmatchedChannel,
            },
            affected_subject_ids: [...affectedSubjectIds],
            items_saved: savedRuns.length,
            saved_runs: savedRuns.map((run) => ({
                id: run.id,
                platform_post_id: run.platform_post_id,
            })),
        };
    }

    /**
     * Lưu video TikTok vào scraper_runs (mirror YouTube ingest, source=apify).
     * @param {{ videos: object[], channels?: Array, channel?: object, run?: object }} params
     */
    async ingestTikTokItems({ videos = [], channels = [], channel = null, run = null } = {}) {
        const now = new Date();
        const affectedSubjectIds = new Set();
        const channelList = Array.isArray(channels) ? channels : [];
        const preferredChannel = channel || (channelList.length === 1 ? channelList[0] : null);

        let inserted = 0;
        let updated = 0;
        let skipped = 0;
        let linksCreated = 0;
        let unmatchedChannel = 0;

        const savedRuns = [];

        await db.sequelize.transaction(async (transaction) => {
            for (const item of videos) {
                const normalized =
                    item && item.platform === 'tiktok' && item.platform_post_id
                        ? item
                        : normalizeTikTokItem(item);

                if (!normalized?.platform_post_id) {
                    skipped += 1;
                    continue;
                }

                let matchedChannel = preferredChannel;
                if (!matchedChannel && channelList.length > 1) {
                    matchedChannel =
                        matchChannelByPostUrl(normalized.post_url, channelList) || null;
                }

                if (!matchedChannel && channelList.length > 0 && !preferredChannel) {
                    unmatchedChannel += 1;
                }

                const channelFk = {
                    channel_id: matchedChannel ? matchedChannel.id : null,
                };

                const payload = {
                    platform: 'tiktok',
                    platform_post_id: normalized.platform_post_id,
                    post_url: normalized.post_url,
                    title: normalized.title,
                    text: normalized.text,
                    likes: normalized.likes,
                    comments: normalized.comments,
                    shares: normalized.shares,
                    angry_count: 0,
                    views: toCount(normalized.views),
                    follow: toCount(normalized.follow),
                    posted_at: normalized.posted_at,
                    scraped_at: now,
                    source: 'apify',
                    external_run_id: run?.id || null,
                    scraper_id: run?.actId || run?.actorId || 'tiktok_apify',
                    raw_data: normalized.raw_data || item,
                };

                let scraperRun = await this.scraperRunModel.findOne({
                    where: {
                        platform: payload.platform,
                        platform_post_id: payload.platform_post_id,
                    },
                    transaction,
                });

                if (scraperRun) {
                    const updatePayload = { ...payload };
                    if (matchedChannel) {
                        Object.assign(updatePayload, channelFk);
                    }
                    await scraperRun.update(updatePayload, { transaction });
                    updated += 1;
                } else {
                    scraperRun = await this.scraperRunModel.create(
                        { ...payload, ...channelFk },
                        { transaction }
                    );
                    inserted += 1;
                }

                savedRuns.push(scraperRun);

                const subjectIdsToLink = new Set();
                if (matchedChannel) {
                    const linkedSubjectIds = await this.channelRepository.listSubjectIdsForChannel(
                        matchedChannel.id,
                        { transaction }
                    );
                    for (const sid of linkedSubjectIds) {
                        subjectIdsToLink.add(sid);
                    }
                }

                const linkSync = await this.syncScraperRunSubjectLinks(
                    scraperRun.id,
                    subjectIdsToLink,
                    { transaction }
                );
                linksCreated += linkSync.links_created;
                for (const sid of linkSync.previous_subject_ids) {
                    affectedSubjectIds.add(sid);
                }
                for (const sid of linkSync.subject_ids) {
                    affectedSubjectIds.add(sid);
                }
            }

            for (const subjectId of affectedSubjectIds) {
                await this.recomputeSocialPost(subjectId, { transaction });
            }
        });

        return {
            upsert_stats: {
                inserted,
                updated,
                skipped,
                links_created: linksCreated,
                unmatched_channel: unmatchedChannel,
            },
            affected_subject_ids: [...affectedSubjectIds],
            items_saved: savedRuns.length,
            saved_runs: savedRuns.map((row) => ({
                id: row.id,
                platform_post_id: row.platform_post_id,
                post_url: row.post_url,
            })),
        };
    }

    youtubeTailRankedCteSql() {
        return `WITH ranked AS (
            SELECT
                id,
                platform_post_id,
                channel_id,
                follow,
                posted_at,
                ROW_NUMBER() OVER (
                    PARTITION BY channel_id
                    ORDER BY posted_at DESC, id DESC
                ) AS rank_in_channel
            FROM scraper_runs
            WHERE platform = 'youtube'
              AND channel_id IS NOT NULL
              AND posted_at IS NOT NULL
        )`;
    }

    /**
     * Đếm video YouTube tail: rank > headSize theo posted_at mỗi kênh.
     */
    async countYoutubeTailRuns({ headSize = 10 } = {}) {
        const sequelize = db.sequelize;
        const limit = Math.max(Number(headSize) || 10, 1);
        const rows = await sequelize.query(
            `${this.youtubeTailRankedCteSql()}
             SELECT COUNT(*) AS total
             FROM ranked
             WHERE rank_in_channel > :headSize`,
            {
                replacements: { headSize: limit },
                type: sequelize.QueryTypes.SELECT,
            }
        );
        return Number(rows[0]?.total) || 0;
    }

    /**
     * Lấy 1 batch video tail (rank > headSize) ORDER BY posted_at ASC.
     */
    async listYoutubeTailBatch({ headSize = 10, batchSize = 50, offset = 0 } = {}) {
        const sequelize = db.sequelize;
        const head = Math.max(Number(headSize) || 10, 1);
        const limit = Math.min(Math.max(Number(batchSize) || 50, 1), 50);
        const off = Math.max(Number(offset) || 0, 0);

        return sequelize.query(
            `${this.youtubeTailRankedCteSql()}
             SELECT id, platform_post_id, channel_id, follow, posted_at
             FROM ranked
             WHERE rank_in_channel > :headSize
             ORDER BY posted_at ASC, id ASC
             LIMIT :batchSize OFFSET :offset`,
            {
                replacements: { headSize: head, batchSize: limit, offset: off },
                type: sequelize.QueryTypes.SELECT,
            }
        );
    }

    /**
     * Cập nhật stats tail từ videos.list — không cào comment, không insert mới.
     * @param {{ rows: object[], rawVideos: object[] }} params
     */
    async updateYoutubeTailStats({ rows = [], rawVideos = [] } = {}) {
        const now = new Date();
        const affectedSubjectIds = new Set();
        const byVideoId = new Map((rawVideos || []).map((v) => [String(v.id), v]));

        let updated = 0;
        let notFound = 0;
        const processed = rows.length;

        await db.sequelize.transaction(async (transaction) => {
            for (const row of rows) {
                const videoId = String(row.platform_post_id || '');
                const raw = byVideoId.get(videoId);
                if (!raw) {
                    notFound += 1;
                    continue;
                }

                const normalized = normalizeYoutubeVideo(raw, {
                    follow: toCount(row.follow),
                });

                const scraperRun = await this.scraperRunModel.findByPk(row.id, { transaction });
                if (!scraperRun) {
                    notFound += 1;
                    continue;
                }

                await scraperRun.update(
                    {
                        title: normalized.title,
                        text: normalized.text,
                        likes: normalized.likes,
                        comments: normalized.comments,
                        views: toCount(normalized.views),
                        posted_at: normalized.posted_at ?? scraperRun.posted_at,
                        scraped_at: now,
                        raw_data: normalized.raw_data || raw,
                    },
                    { transaction }
                );
                updated += 1;

                const links = await this.subjectScraperRunModel.findAll({
                    where: { scraper_run_id: scraperRun.id },
                    attributes: ['subject_id'],
                    transaction,
                });
                for (const link of links) {
                    affectedSubjectIds.add(Number(link.subject_id));
                }
            }

            for (const subjectId of affectedSubjectIds) {
                await this.recomputeSocialPost(subjectId, { transaction });
            }
        });

        return {
            processed,
            updated,
            not_found: notFound,
            affected_subject_ids: [...affectedSubjectIds],
        };
    }

    async recomputeSocialPost(subjectId, { transaction } = {}) {
        const links = await this.subjectScraperRunModel.findAll({
            where: { subject_id: subjectId },
            include: [{ model: this.scraperRunModel, as: 'scraperRun' }],
            transaction,
        });

        // Cache social_posts = tổng engagement trong tháng lịch hiện tại (theo posted_at).
        const monthRange = getCalendarMonthRange();
        const runsInWindow = [];

        for (const link of links) {
            const post = link.scraperRun;
            if (!post) continue;
            if (!isWithinPostedAtRange(post.posted_at, monthRange)) continue;
            runsInWindow.push(post);
        }

        const aggregate = this.buildAggregateFromRuns(runsInWindow);
        const payload = {
            subject_id: subjectId,
            likes: aggregate.likes,
            comments: aggregate.comments,
            shares: aggregate.shares,
            angry_count: aggregate.angry_count,
            views: aggregate.views,
            follow: aggregate.follow,
            trend_score: aggregate.trend_score,
            hot_score: aggregate.hot_score,
            posts_count: aggregate.posts_count,
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
        const platformHint =
            plain.platform ||
            resolveSubjectPlatform(plain.subject) ||
            (toCount(plain.views) > 0 && toCount(plain.shares) === 0 && toCount(plain.angry_count) === 0
                ? 'youtube'
                : null);
        const metrics = deriveEngagementMetrics({
            ...plain,
            platform: platformHint || plain.platform,
        });
        const thresholds = this.trendThresholds();
        const direction = classifyTrendDirection(plain, {
            hotThreshold: thresholds.hot,
            trendThreshold: thresholds.trend,
        });

        let subject = plain.subject || null;
        if (subject) {
            subject = {
                id: subject.id,
                name: subject.name,
                normalized_name: subject.normalized_name,
                status: subject.status,
                channels: (subject.channels || []).map((ch) => this.serializeChannel(ch)),
            };
        }

        return {
            ...plain,
            subject,
            rank,
            views: toCount(plain.views),
            discussion: metrics.discussion,
            interaction: metrics.interaction,
            sentiment: metrics.sentiment,
            trend_direction: direction,
            is_new: isNewSocialPost(plain, NEW_WITHIN_HOURS),
            hot_score: metrics.hot_score,
            trend_score: metrics.trend_score,
        };
    }

    socialPostSubjectInclude() {
        return {
            model: this.subjectModel,
            as: 'subject',
            attributes: ['id', 'name', 'normalized_name', 'status'],
            include: this.subjectChannelIncludes(),
        };
    }

    buildSocialPostOrder(sortBy = 'hot_score') {
        const sequelize = db.sequelize;
        // social_posts không có platform: heuristic YouTube = có views, shares=0, angry=0
        const ytHeuristic = '(views > 0 AND shares = 0 AND angry_count = 0)';
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
                    [
                        sequelize.literal(
                            `(CASE WHEN ${ytHeuristic} THEN (likes + comments) ELSE (likes + comments + shares) END)`
                        ),
                        'DESC',
                    ],
                    ['hot_score', 'DESC'],
                    ['id', 'DESC'],
                ];
            case 'sentiment':
                return [
                    [
                        sequelize.literal(
                            `(CASE
                                WHEN ${ytHeuristic} THEN 0
                                WHEN (likes + angry_count) = 0 THEN 0
                                ELSE (likes - angry_count) / (likes + angry_count)
                            END)`
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

    metricSortValue(row, sortBy = 'hot_score') {
        const metrics = deriveEngagementMetrics(row);
        switch (sortBy) {
            case 'trend_score':
                return metrics.trend_score;
            case 'discussion':
                return metrics.discussion;
            case 'interaction':
                return metrics.interaction;
            case 'sentiment':
                return metrics.sentiment;
            case 'hot_score':
            default:
                return metrics.hot_score;
        }
    }

    /**
     * Aggregate live theo posted_at (group by subject) — dùng cho dashboard khi có khoảng thời gian.
     */
    async listAggregatedSocialPostsByPostedAt({
        page = 1,
        per_page = 20,
        sort_by = 'hot_score',
        new_only = false,
        date_from,
        date_to,
    } = {}) {
        const range = resolvePostedAtRange({ date_from, date_to });
        const limit = Math.min(Math.max(Number(per_page) || 20, 1), 100);
        const currentPage = Math.max(Number(page) || 1, 1);
        const offset = (currentPage - 1) * limit;
        const sequelize = db.sequelize;

        const aggRows = await sequelize.query(
            `SELECT
                per_channel.subject_id AS subject_id,
                per_channel.platform AS platform,
                COALESCE(SUM(per_channel.likes), 0) AS likes,
                COALESCE(SUM(per_channel.comments), 0) AS comments,
                COALESCE(SUM(per_channel.shares), 0) AS shares,
                COALESCE(SUM(per_channel.angry_count), 0) AS angry_count,
                COALESCE(SUM(per_channel.views), 0) AS views,
                COALESCE(SUM(per_channel.channel_follow), 0) AS follow,
                COALESCE(SUM(per_channel.posts_count), 0) AS posts_count
             FROM (
                SELECT
                    ssr.subject_id AS subject_id,
                    sr.channel_id AS channel_id,
                    LOWER(sr.platform) AS platform,
                    COALESCE(SUM(sr.likes), 0) AS likes,
                    COALESCE(SUM(sr.comments), 0) AS comments,
                    COALESCE(SUM(sr.shares), 0) AS shares,
                    COALESCE(SUM(sr.angry_count), 0) AS angry_count,
                    COALESCE(SUM(sr.views), 0) AS views,
                    COALESCE(MAX(sr.follow), 0) AS channel_follow,
                    COUNT(*) AS posts_count
                FROM subjects_scraper_runs ssr
                INNER JOIN scraper_runs sr ON sr.id = ssr.scraper_run_id
                WHERE sr.posted_at >= :start
                  AND sr.posted_at < :end
                GROUP BY ssr.subject_id, sr.channel_id, LOWER(sr.platform)
             ) per_channel
             GROUP BY per_channel.subject_id, per_channel.platform`,
            {
                replacements: { start: range.start, end: range.end },
                type: sequelize.QueryTypes.SELECT,
            }
        );

        const subjectIds = [
            ...new Set(aggRows.map((r) => Number(r.subject_id)).filter(Boolean)),
        ];
        const subjects =
            subjectIds.length === 0
                ? []
                : await this.subjectModel.findAll({
                      where: { id: { [Op.in]: subjectIds } },
                      include: this.subjectChannelIncludes(),
                  });
        const subjectById = new Map(
            subjects.map((s) => [Number(s.id), typeof s.toJSON === 'function' ? s.toJSON() : s])
        );

        const bySubject = new Map();
        for (const row of aggRows) {
            const subjectId = Number(row.subject_id);
            const subject = subjectById.get(subjectId);
            if (!subject) continue;

            const bucket = bySubject.get(subjectId) || {
                subject,
                likes: 0,
                comments: 0,
                shares: 0,
                angry_count: 0,
                views: 0,
                follow: 0,
                posts_count: 0,
                scoreInputs: [],
            };

            const likes = toCount(row.likes);
            const comments = toCount(row.comments);
            const shares = toCount(row.shares);
            const angry_count = toCount(row.angry_count);
            const views = toCount(row.views);
            const follow = toCount(row.follow);
            const posts_count = toCount(row.posts_count);
            const platform = normalizePlatform(row.platform);

            bucket.likes += likes;
            bucket.comments += comments;
            bucket.shares += shares;
            bucket.angry_count += angry_count;
            bucket.views += views;
            bucket.follow += follow;
            bucket.posts_count += posts_count;
            bucket.scoreInputs.push({
                platform,
                likes,
                comments,
                shares,
                angry_count,
                views,
            });
            bySubject.set(subjectId, bucket);
        }

        let items = [];
        for (const [subjectId, bucket] of bySubject) {
            const scores = calculateScoresFromRuns(bucket.scoreInputs);
            const payload = {
                id: subjectId,
                subject_id: subjectId,
                likes: bucket.likes,
                comments: bucket.comments,
                shares: bucket.shares,
                angry_count: bucket.angry_count,
                views: bucket.views,
                follow: bucket.follow,
                posts_count: bucket.posts_count,
                hot_score: scores.hot_score,
                trend_score: scores.trend_score,
                computed_at: new Date(),
                created_at: bucket.subject.created_at,
                updated_at: bucket.subject.updated_at,
                subject: {
                    id: bucket.subject.id,
                    name: bucket.subject.name,
                    normalized_name: bucket.subject.normalized_name,
                    status: bucket.subject.status,
                    channels: (bucket.subject.channels || []).map((ch) => this.serializeChannel(ch)),
                },
            };

            if (new_only && !isNewSocialPost(payload, NEW_WITHIN_HOURS)) continue;
            items.push(this.serializeSocialPost(payload));
        }

        items.sort((a, b) => {
            const diff = this.metricSortValue(b, sort_by) - this.metricSortValue(a, sort_by);
            if (diff !== 0) return diff;
            return Number(b.subject_id) - Number(a.subject_id);
        });

        const count = items.length;
        const pageRows = items.slice(offset, offset + limit).map((row, index) => ({
            ...row,
            rank: offset + index + 1,
        }));

        return {
            rows: pageRows,
            count,
            page: currentPage,
            per_page: limit,
            date_from: formatDateOnly(range.start),
            date_to: formatDateOnly(new Date(range.end.getTime() - 1)),
            all_rows: items,
        };
    }

    async listSocialPosts({
        page = 1,
        per_page = 20,
        sort_by = 'hot_score',
        new_only = false,
        date_from,
        date_to,
    } = {}) {
        return this.listAggregatedSocialPostsByPostedAt({
            page,
            per_page,
            sort_by,
            new_only,
            date_from,
            date_to,
        });
    }

    buildStatsFromAggregates(items = []) {
        const thresholds = this.trendThresholds();
        let uptrend = 0;
        let downtrend = 0;
        let new_count = 0;

        for (const row of items) {
            const direction = classifyTrendDirection(row, {
                hotThreshold: thresholds.hot,
                trendThreshold: thresholds.trend,
            });
            if (direction === 'up') uptrend += 1;
            else if (direction === 'down') downtrend += 1;
            if (isNewSocialPost(row, NEW_WITHIN_HOURS)) new_count += 1;
        }

        return {
            total: items.length,
            uptrend,
            downtrend,
            new_count,
            thresholds: {
                hot_score: thresholds.hot,
                trend_score: thresholds.trend,
            },
            definitions: {
                uptrend:
                    'Chủ đề đạt ngưỡng hot_score hoặc trend_score (đang nóng / tương tác mạnh).',
                downtrend: 'Chưa đạt ngưỡng hot_score và trend_score.',
            },
        };
    }

    async getSocialPostStats({ date_from, date_to } = {}) {
        const list = await this.listAggregatedSocialPostsByPostedAt({
            page: 1,
            per_page: 10000,
            sort_by: 'hot_score',
            new_only: false,
            date_from,
            date_to,
        });
        return this.buildStatsFromAggregates(list.all_rows || list.rows);
    }

    async getSocialPostChart({ sort_by = 'hot_score', limit = 10, date_from, date_to } = {}) {
        const chartLimit = Math.min(Math.max(Number(limit) || 10, 1), 20);
        const list = await this.listAggregatedSocialPostsByPostedAt({
            page: 1,
            per_page: chartLimit,
            sort_by,
            new_only: false,
            date_from,
            date_to,
        });
        return list.rows;
    }

    async getSocialPostsDashboard({
        page = 1,
        per_page = 10,
        sort_by = 'discussion',
        new_only = false,
        chart_limit = 10,
        date_from,
        date_to,
    } = {}) {
        const range = resolvePostedAtRange({ date_from, date_to });
        const full = await this.listAggregatedSocialPostsByPostedAt({
            page: 1,
            per_page: 10000,
            sort_by,
            new_only: false,
            date_from,
            date_to,
        });
        const allRows = full.all_rows || [];
        const stats = this.buildStatsFromAggregates(allRows);

        const chartLimit = Math.min(Math.max(Number(chart_limit) || 10, 1), 20);
        const chart = allRows.slice(0, chartLimit).map((row, index) => ({
            ...row,
            rank: index + 1,
        }));

        let rankingSource = allRows;
        if (new_only) {
            rankingSource = allRows.filter((row) => isNewSocialPost(row, NEW_WITHIN_HOURS));
        }

        const limit = Math.min(Math.max(Number(per_page) || 20, 1), 100);
        const currentPage = Math.max(Number(page) || 1, 1);
        const offset = (currentPage - 1) * limit;
        const ranking = rankingSource.slice(offset, offset + limit).map((row, index) => ({
            ...row,
            rank: offset + index + 1,
        }));

        return {
            stats,
            chart,
            ranking,
            pagination: {
                display: ranking.length,
                total_records: rankingSource.length,
                per_page: limit,
                current_page: currentPage,
                total_pages: Math.ceil(rankingSource.length / limit) || 0,
            },
            sort_by,
            new_only: Boolean(new_only),
            date_from: formatDateOnly(range.start),
            date_to: formatDateOnly(new Date(range.end.getTime() - 1)),
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
            include: [this.socialPostSubjectInclude()],
        });
    }
}

module.exports = ScraperRepository;
