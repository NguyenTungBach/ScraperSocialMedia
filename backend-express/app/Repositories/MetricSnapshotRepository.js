'use strict';

const { Op } = require('sequelize');
const {
    Channel,
    ChannelDailySnapshot,
    PostDailySnapshot,
    PostTopCommentDaily,
    PostComment,
    ScraperRun,
    SubjectChannel,
    sequelize,
} = require('../Models');
const { calculateScores, toCount, normalizePlatform } = require('../Helpers/PostScoreHelper');
const { todaySnapshotDate } = require('../Helpers/SnapshotDateHelper');

const TOP_COMMENTS_LIMIT = 10;

class MetricSnapshotRepository {
    /**
     * Kênh đã gắn ít nhất 1 subject.
     * @returns {Promise<number[]>}
     */
    async listLinkedChannelIds() {
        const rows = await SubjectChannel.findAll({
            attributes: ['channel_id'],
            group: ['channel_id'],
            raw: true,
        });
        return rows
            .map((r) => Number(r.channel_id))
            .filter((id) => Number.isInteger(id) && id > 0);
    }

    /**
     * @param {string} snapshotDate YYYY-MM-DD
     * @param {number} [channelId]
     */
    async hasChannelSnapshotsForDate(snapshotDate, channelId = null) {
        const where = { snapshot_date: snapshotDate };
        if (channelId) where.channel_id = channelId;
        const count = await ChannelDailySnapshot.count({ where });
        return count > 0;
    }

    /**
     * @param {string} snapshotDate
     * @param {number} scraperRunId
     */
    async hasPostSnapshotForDate(scraperRunId, snapshotDate) {
        const count = await PostDailySnapshot.count({
            where: { scraper_run_id: scraperRunId, snapshot_date: snapshotDate },
        });
        return count > 0;
    }

    /**
     * @param {object} opts
     * @param {boolean} [opts.force]
     * @param {string} [opts.snapshotDate]
     * @param {number|null} [opts.channelId] — chỉ 1 kênh (+ toàn bộ bài của kênh)
     * @param {number|null} [opts.scraperRunId] — chỉ 1 bài (+ refresh aggregate kênh chứa bài)
     */
    async runSnapshot({
        force = true,
        snapshotDate = null,
        channelId = null,
        scraperRunId = null,
    } = {}) {
        const date = snapshotDate || todaySnapshotDate();
        const scopedChannelId =
            channelId != null && Number.isInteger(Number(channelId)) && Number(channelId) > 0
                ? Number(channelId)
                : null;
        const scopedRunId =
            scraperRunId != null &&
            Number.isInteger(Number(scraperRunId)) &&
            Number(scraperRunId) > 0
                ? Number(scraperRunId)
                : null;

        if (scopedRunId) {
            return this.runPostSnapshot({ force, snapshotDate: date, scraperRunId: scopedRunId });
        }

        if (scopedChannelId) {
            return this.runChannelSnapshot({
                force,
                snapshotDate: date,
                channelId: scopedChannelId,
            });
        }

        // Cron / CLI: toàn bộ kênh ∈ subject_channels
        const existsToday = await this.hasChannelSnapshotsForDate(date);
        if (existsToday && !force) {
            return {
                needs_confirm: true,
                snapshot_date: date,
                message: 'Thông tin ngày hôm nay đã có. Bạn có muốn ghi đè?',
            };
        }

        const channelIds = await this.listLinkedChannelIds();
        if (channelIds.length === 0) {
            return {
                ok: true,
                overwritten: existsToday,
                snapshot_date: date,
                channels: 0,
                posts: 0,
                top_comments: 0,
            };
        }

        const capturedAt = new Date();
        let postCount = 0;
        let topCommentCount = 0;

        await sequelize.transaction(async (transaction) => {
            for (const id of channelIds) {
                const result = await this.snapshotChannel(id, date, capturedAt, {
                    transaction,
                });
                postCount += result.posts;
                topCommentCount += result.top_comments;
            }
        });

        return {
            ok: true,
            overwritten: existsToday,
            snapshot_date: date,
            channels: channelIds.length,
            posts: postCount,
            top_comments: topCommentCount,
            captured_at: capturedAt.toISOString(),
        };
    }

    async runChannelSnapshot({ force, snapshotDate, channelId }) {
        const existsToday = await this.hasChannelSnapshotsForDate(snapshotDate, channelId);
        if (existsToday && !force) {
            return {
                needs_confirm: true,
                snapshot_date: snapshotDate,
                channel_id: channelId,
                message: 'Kênh này đã có snapshot hôm nay. Bạn có muốn ghi đè?',
            };
        }

        const capturedAt = new Date();
        let result = { posts: 0, top_comments: 0 };
        await sequelize.transaction(async (transaction) => {
            result = await this.snapshotChannel(channelId, snapshotDate, capturedAt, {
                transaction,
            });
        });

        return {
            ok: true,
            overwritten: existsToday,
            snapshot_date: snapshotDate,
            channel_id: channelId,
            channels: 1,
            posts: result.posts,
            top_comments: result.top_comments,
            captured_at: capturedAt.toISOString(),
        };
    }

    async runPostSnapshot({ force, snapshotDate, scraperRunId }) {
        const run = await ScraperRun.findByPk(scraperRunId, {
            attributes: [
                'id',
                'channel_id',
                'platform',
                'views',
                'likes',
                'comments',
                'shares',
                'angry_count',
            ],
        });
        if (!run) {
            return {
                ok: false,
                message: 'Không tìm thấy bài (scraper_run)',
                scraper_run_id: scraperRunId,
            };
        }
        if (!run.channel_id) {
            return {
                ok: false,
                message: 'Bài chưa gắn kênh — không thể snapshot',
                scraper_run_id: scraperRunId,
            };
        }

        const existsToday = await this.hasPostSnapshotForDate(scraperRunId, snapshotDate);
        if (existsToday && !force) {
            return {
                needs_confirm: true,
                snapshot_date: snapshotDate,
                scraper_run_id: scraperRunId,
                message: 'Bài này đã có snapshot hôm nay. Bạn có muốn ghi đè?',
            };
        }

        const capturedAt = new Date();
        let result = { posts: 0, top_comments: 0 };
        await sequelize.transaction(async (transaction) => {
            // Chụp lại cả kênh (gồm bài này) để aggregate kênh khớp
            result = await this.snapshotChannel(run.channel_id, snapshotDate, capturedAt, {
                transaction,
            });
        });

        return {
            ok: true,
            overwritten: existsToday,
            snapshot_date: snapshotDate,
            scraper_run_id: scraperRunId,
            channel_id: run.channel_id,
            channels: 1,
            posts: result.posts,
            top_comments: result.top_comments,
            captured_at: capturedAt.toISOString(),
        };
    }

    /**
     * @param {number} channelId
     * @param {string} snapshotDate
     * @param {Date} capturedAt
     * @param {{ transaction?: import('sequelize').Transaction }} [opts]
     */
    async snapshotChannel(channelId, snapshotDate, capturedAt, { transaction } = {}) {
        const channel = await Channel.findByPk(channelId, { transaction });
        if (!channel) {
            return { posts: 0, top_comments: 0 };
        }

        const runs = await ScraperRun.findAll({
            where: { channel_id: channelId },
            attributes: [
                'id',
                'platform',
                'views',
                'likes',
                'comments',
                'shares',
                'angry_count',
            ],
            transaction,
        });

        let viewsSum = 0;
        let likesSum = 0;
        let commentsSum = 0;
        let sharesSum = 0;
        let angrySum = 0;
        let topComments = 0;

        for (const run of runs) {
            const views = toCount(run.views);
            const likes = toCount(run.likes);
            const comments = toCount(run.comments);
            const shares = toCount(run.shares);
            const angry_count = toCount(run.angry_count);
            const platform = normalizePlatform(run.platform || channel.type_channel);
            const scores = calculateScores({
                likes,
                comments,
                shares,
                angry_count,
                views,
                platform,
            });

            viewsSum += views;
            likesSum += likes;
            commentsSum += comments;
            sharesSum += shares;
            angrySum += angry_count;

            await PostDailySnapshot.upsert(
                {
                    scraper_run_id: run.id,
                    channel_id: channelId,
                    snapshot_date: snapshotDate,
                    platform,
                    views,
                    likes,
                    comments,
                    shares,
                    angry_count,
                    hot_score: scores.hot_score,
                    trend_score: scores.trend_score,
                    captured_at: capturedAt,
                },
                { transaction }
            );

            topComments += await this.replaceTopCommentsForRun(
                run.id,
                snapshotDate,
                capturedAt,
                { transaction }
            );
        }

        const platform = normalizePlatform(channel.type_channel);
        await ChannelDailySnapshot.upsert(
            {
                channel_id: channelId,
                snapshot_date: snapshotDate,
                platform,
                followers: toCount(channel.followers),
                post_count_channel: toCount(channel.post_count),
                post_count_tracked: runs.length,
                views_sum: viewsSum,
                likes_sum: likesSum,
                comments_sum: commentsSum,
                shares_sum: sharesSum,
                angry_sum: angrySum,
                captured_at: capturedAt,
            },
            { transaction }
        );

        return { posts: runs.length, top_comments: topComments };
    }

    /**
     * @param {number} scraperRunId
     * @param {string} snapshotDate
     * @param {Date} capturedAt
     */
    async replaceTopCommentsForRun(scraperRunId, snapshotDate, capturedAt, { transaction } = {}) {
        await PostTopCommentDaily.destroy({
            where: { scraper_run_id: scraperRunId, snapshot_date: snapshotDate },
            transaction,
        });

        const comments = await PostComment.findAll({
            where: { scraper_run_id: scraperRunId },
            order: [
                ['like_count', 'DESC'],
                ['id', 'ASC'],
            ],
            limit: TOP_COMMENTS_LIMIT,
            transaction,
        });

        if (comments.length === 0) return 0;

        const rows = comments.map((c, index) => ({
            scraper_run_id: scraperRunId,
            snapshot_date: snapshotDate,
            rank: index + 1,
            post_comment_id: c.id,
            platform_comment_id: String(c.platform_comment_id),
            author: c.author || null,
            text: c.text || null,
            like_count: toCount(c.like_count),
            captured_at: capturedAt,
        }));

        await PostTopCommentDaily.bulkCreate(rows, { transaction });
        return rows.length;
    }

    async getChannelSeries(channelId, { date_from, date_to } = {}) {
        const where = { channel_id: channelId };
        if (date_from || date_to) {
            where.snapshot_date = {};
            if (date_from) where.snapshot_date[Op.gte] = date_from;
            if (date_to) where.snapshot_date[Op.lte] = date_to;
        }
        return ChannelDailySnapshot.findAll({
            where,
            order: [['snapshot_date', 'ASC']],
        });
    }

    async getChannelSnapshotOnDate(channelId, snapshotDate) {
        return ChannelDailySnapshot.findOne({
            where: { channel_id: channelId, snapshot_date: snapshotDate },
        });
    }

    async getPostSeries(scraperRunId, { date_from, date_to } = {}) {
        const where = { scraper_run_id: scraperRunId };
        if (date_from || date_to) {
            where.snapshot_date = {};
            if (date_from) where.snapshot_date[Op.gte] = date_from;
            if (date_to) where.snapshot_date[Op.lte] = date_to;
        }
        return PostDailySnapshot.findAll({
            where,
            order: [['snapshot_date', 'ASC']],
        });
    }

    async getPostSnapshotOnDate(scraperRunId, snapshotDate) {
        return PostDailySnapshot.findOne({
            where: { scraper_run_id: scraperRunId, snapshot_date: snapshotDate },
            include: [
                {
                    model: ScraperRun,
                    as: 'scraperRun',
                    attributes: ['id', 'title', 'post_url', 'platform', 'posted_at'],
                },
            ],
        });
    }

    /**
     * Top posts của kênh trong 1 ngày (dùng hot_score / trend_score đã lưu lúc snapshot).
     */
    async getChannelTopPosts(channelId, snapshotDate, { sort = 'hot_score', limit = 10 } = {}) {
        const orderField = sort === 'trend_score' ? 'trend_score' : 'hot_score';
        const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));

        return PostDailySnapshot.findAll({
            where: { channel_id: channelId, snapshot_date: snapshotDate },
            include: [
                {
                    model: ScraperRun,
                    as: 'scraperRun',
                    attributes: ['id', 'title', 'post_url', 'platform', 'posted_at', 'text'],
                },
            ],
            order: [
                [orderField, 'DESC'],
                ['id', 'ASC'],
            ],
            limit: safeLimit,
        });
    }

    /**
     * Top posts của kênh trong khoảng ngày: lấy snapshot mới nhất / bài rồi xếp theo score.
     * @param {number} channelId
     * @param {{ date_from?: string, date_to?: string, sort?: string, limit?: number }} [opts]
     */
    async getChannelTopPostsInRange(
        channelId,
        { date_from, date_to, sort = 'hot_score', limit = 10 } = {}
    ) {
        const orderField = sort === 'trend_score' ? 'trend_score' : 'hot_score';
        const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));

        const where = { channel_id: channelId };
        if (date_from || date_to) {
            where.snapshot_date = {};
            if (date_from) where.snapshot_date[Op.gte] = date_from;
            if (date_to) where.snapshot_date[Op.lte] = date_to;
        }

        const rows = await PostDailySnapshot.findAll({
            where,
            include: [
                {
                    model: ScraperRun,
                    as: 'scraperRun',
                    attributes: ['id', 'title', 'post_url', 'platform', 'posted_at'],
                },
            ],
            order: [
                ['snapshot_date', 'DESC'],
                [orderField, 'DESC'],
                ['id', 'ASC'],
            ],
        });

        const latestByRun = new Map();
        for (const raw of rows) {
            const row = typeof raw.toJSON === 'function' ? raw.toJSON() : { ...raw };
            const runId = Number(row.scraper_run_id);
            if (!runId || latestByRun.has(runId)) continue;
            latestByRun.set(runId, row);
        }

        return [...latestByRun.values()]
            .sort((a, b) => {
                const diff = (Number(b[orderField]) || 0) - (Number(a[orderField]) || 0);
                if (diff !== 0) return diff;
                return (Number(a.scraper_run_id) || 0) - (Number(b.scraper_run_id) || 0);
            })
            .slice(0, safeLimit);
    }

    async getPostTopComments(scraperRunId, snapshotDate) {
        return PostTopCommentDaily.findAll({
            where: { scraper_run_id: scraperRunId, snapshot_date: snapshotDate },
            order: [['rank', 'ASC']],
        });
    }

    async compareChannels(channelIds, { date_from, date_to } = {}) {
        const ids = [...new Set(channelIds.map(Number).filter((id) => id > 0))];
        if (ids.length === 0) return [];

        const where = { channel_id: { [Op.in]: ids } };
        if (date_from || date_to) {
            where.snapshot_date = {};
            if (date_from) where.snapshot_date[Op.gte] = date_from;
            if (date_to) where.snapshot_date[Op.lte] = date_to;
        }

        return ChannelDailySnapshot.findAll({
            where,
            include: [{ model: Channel, as: 'channel', attributes: ['id', 'name', 'type_channel', 'url'] }],
            order: [
                ['snapshot_date', 'ASC'],
                ['channel_id', 'ASC'],
            ],
        });
    }

    async comparePosts(scraperRunIds, { date_from, date_to } = {}) {
        const ids = [...new Set(scraperRunIds.map(Number).filter((id) => id > 0))];
        if (ids.length === 0) return [];

        const where = { scraper_run_id: { [Op.in]: ids } };
        if (date_from || date_to) {
            where.snapshot_date = {};
            if (date_from) where.snapshot_date[Op.gte] = date_from;
            if (date_to) where.snapshot_date[Op.lte] = date_to;
        }

        return PostDailySnapshot.findAll({
            where,
            include: [
                {
                    model: ScraperRun,
                    as: 'scraperRun',
                    attributes: ['id', 'title', 'post_url', 'platform', 'posted_at'],
                },
            ],
            order: [
                ['snapshot_date', 'ASC'],
                ['scraper_run_id', 'ASC'],
            ],
        });
    }

    /**
     * Catalog bài (scraper_runs) để chọn so sánh — lọc theo kênh / tìm kiếm.
     * @param {{ channel_id?: number, q?: string, page?: number, per_page?: number }} [opts]
     */
    async catalogPosts({ channel_id, q, page = 1, per_page = 50 } = {}) {
        const limit = Math.min(Math.max(Number(per_page) || 50, 1), 100);
        const currentPage = Math.max(Number(page) || 1, 1);
        const offset = (currentPage - 1) * limit;

        const where = {};
        const channelId = Number(channel_id);
        if (Number.isInteger(channelId) && channelId > 0) {
            where.channel_id = channelId;
        }

        const query = String(q || '').trim();
        if (query) {
            const like = `%${query.replace(/[%_]/g, '\\$&')}%`;
            where[Op.or] = [
                { title: { [Op.like]: like } },
                { text: { [Op.like]: like } },
                { post_url: { [Op.like]: like } },
            ];
        }

        const { rows, count } = await ScraperRun.findAndCountAll({
            where,
            attributes: [
                'id',
                'platform',
                'title',
                'text',
                'post_url',
                'channel_id',
                'posted_at',
                'views',
                'likes',
                'comments',
            ],
            include: [
                {
                    model: Channel,
                    as: 'channel',
                    attributes: ['id', 'name', 'type_channel'],
                    required: false,
                },
            ],
            order: [
                ['posted_at', 'DESC'],
                ['id', 'DESC'],
            ],
            limit,
            offset,
        });

        return {
            result: rows,
            pagination: {
                display: rows.length,
                total_records: count,
                per_page: limit,
                current_page: currentPage,
                total_pages: Math.ceil(count / limit) || 0,
            },
        };
    }
}

module.exports = MetricSnapshotRepository;
