'use strict';

const createError = require('http-errors');
const { Op } = require('sequelize');
const db = require('../Models');
const { normalizeChannelUrl } = require('../Helpers/ChannelUrlHelper');
const { toCount } = require('../Helpers/PostScoreHelper');

class ChannelRepository {
    constructor() {
        this.channelModel = db.Channel;
        this.subjectChannelModel = db.SubjectChannel;
        this.subjectModel = db.Subject;
        this.scraperRunModel = db.ScraperRun;
    }

    serializeChannel(row, { scraper_runs_count = 0 } = {}) {
        const plain = typeof row?.toJSON === 'function' ? row.toJSON() : { ...row };
        const count =
            scraper_runs_count > 0
                ? scraper_runs_count
                : Number(plain.scraper_runs_count ?? plain.scraperRunsCount ?? 0) || 0;

        return {
            id: plain.id,
            name: plain.name,
            url: plain.url,
            type_channel: plain.type_channel,
            followers: Number(plain.followers ?? 0) || 0,
            post_count:
                Number(plain.post_count ?? plain.postCount ?? plain.video_count ?? plain.videoCount ?? 0) ||
                0,
            scraper_runs_count: count,
            has_scraper_runs: count > 0,
            /** URL/nền tảng cố định sau khi tạo — mọi nền tảng */
            can_edit_url: false,
            can_edit_type_channel: false,
            /** false khi đã có scraper_runs.channel_id trỏ tới kênh này */
            can_delete: count === 0,
            created_at: plain.created_at ?? null,
            updated_at: plain.updated_at ?? null,
        };
    }

    scraperRunsCountLiteral() {
        return db.sequelize.literal(
            `(SELECT COUNT(*) FROM scraper_runs WHERE scraper_runs.channel_id = Channel.id)`
        );
    }

    async countScraperRuns(channelId, { transaction } = {}) {
        return this.scraperRunModel.count({
            where: { channel_id: channelId },
            transaction,
        });
    }

    async listChannels({ page = 1, per_page = 20, q = null, type_channel = null } = {}) {
        const limit = Math.min(Math.max(Number(per_page) || 20, 1), 100);
        const currentPage = Math.max(Number(page) || 1, 1);
        const offset = (currentPage - 1) * limit;
        const where = {};

        if (type_channel) where.type_channel = type_channel;

        const keyword = String(q || '').trim();
        if (keyword) {
            const likeOp = db.sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;
            const term = `%${keyword}%`;
            where[Op.or] = [{ name: { [likeOp]: term } }, { url: { [likeOp]: term } }];
        }

        const { rows, count } = await this.channelModel.findAndCountAll({
            where,
            attributes: {
                exclude: ['raw_data'],
                include: [[this.scraperRunsCountLiteral(), 'scraper_runs_count']],
            },
            order: [['id', 'DESC']],
            limit,
            offset,
        });

        return {
            rows: rows.map((row) => this.serializeChannel(row)),
            count,
            page: currentPage,
            per_page: limit,
        };
    }

    async createChannel({ name, url, type_channel = 'facebook' } = {}) {
        const trimmedName = String(name || '').trim();
        const trimmedUrl = String(url || '').trim();
        if (!trimmedName) throw createError(422, 'name is required');
        if (!trimmedUrl) throw createError(422, 'url is required');

        const row = await this.channelModel.create({
            name: trimmedName,
            url: trimmedUrl,
            type_channel: type_channel || 'facebook',
        });

        return this.serializeChannel(row, { scraper_runs_count: 0 });
    }

    async updateChannel(id, payload = {}) {
        const row = await this.channelModel.findByPk(id);
        if (!row) return null;

        const updates = {};
        if (payload.name !== undefined) {
            const trimmedName = String(payload.name || '').trim();
            if (!trimmedName) throw createError(422, 'name is required');
            updates.name = trimmedName;
        }
        if (payload.url !== undefined) {
            const trimmedUrl = String(payload.url || '').trim();
            if (!trimmedUrl) throw createError(422, 'url is required');
            const currentUrl = String(row.url || '').trim();
            if (trimmedUrl !== currentUrl) {
                throw createError(422, 'Không thể sửa URL sau khi kênh đã được lưu');
            }
        }
        if (payload.type_channel !== undefined) {
            const nextType = String(payload.type_channel || '').trim() || 'facebook';
            const currentType = String(row.type_channel || '').trim();
            if (nextType !== currentType) {
                throw createError(422, 'Không thể sửa nền tảng sau khi kênh đã được lưu');
            }
        }

        if (Object.keys(updates).length > 0) {
            await row.update(updates);
        }

        const scraper_runs_count = await this.countScraperRuns(row.id);
        return this.serializeChannel(row, { scraper_runs_count });
    }

    /**
     * Cập nhật followers / post_count / raw_data sau scrape (không qua PUT name).
     * @param {number} channelId
     * @param {{ followers?: number, post_count?: number, raw_data?: object|null }} stats
     */
    async updateChannelStats(channelId, stats = {}, { transaction } = {}) {
        const id = Number(channelId);
        if (!id) return null;

        const row = await this.channelModel.findByPk(id, { transaction });
        if (!row) return null;

        const updates = {};
        if (stats.followers !== undefined) {
            updates.followers = toCount(stats.followers);
        }
        if (stats.post_count !== undefined) {
            updates.post_count = toCount(stats.post_count);
        }
        if (stats.raw_data !== undefined) {
            updates.raw_data = stats.raw_data;
        }

        if (Object.keys(updates).length > 0) {
            await row.update(updates, { transaction });
        }

        return row;
    }

    async deleteChannel(id) {
        const row = await this.channelModel.findByPk(id);
        if (!row) return null;

        const scraperRunsCount = await this.countScraperRuns(row.id);
        if (scraperRunsCount > 0) {
            throw createError(
                422,
                `Không thể xóa kênh đang có ${scraperRunsCount} bài scrape (scraper_runs)`
            );
        }

        await row.destroy();
        return { id: Number(id), deleted: true };
    }

    async findChannelsByIds({ channel_id = [] } = {}) {
        const ids = [...new Set((channel_id || []).map(Number).filter((n) => n > 0))];
        if (ids.length === 0) {
            return [];
        }

        const rows = await this.channelModel.findAll({
            where: { id: { [Op.in]: ids } },
        });

        if (rows.length !== ids.length) {
            throw createError(422, 'One or more channel_id not found');
        }

        return rows.map((row) => row.toJSON());
    }

    /**
     * Tìm kênh theo URL (normalize: bỏ www, trailing slash, query/hash).
     * Fail nếu thiếu / không khớp — không fallback sang kênh khác.
     */
    async findChannelsByUrls({ urls = [], type_channel = null } = {}) {
        const wanted = [
            ...new Set(
                (urls || [])
                    .map((u) => normalizeChannelUrl(u))
                    .filter(Boolean)
            ),
        ];
        if (wanted.length === 0) return [];

        const where = {};
        if (type_channel) where.type_channel = type_channel;

        const rows = await this.channelModel.findAll({ where });
        const byNorm = new Map();
        for (const row of rows) {
            const plain = row.toJSON();
            const key = normalizeChannelUrl(plain.url);
            if (key) byNorm.set(key, plain);
        }

        const matched = [];
        const missing = [];
        for (const key of wanted) {
            const hit = byNorm.get(key);
            if (hit) matched.push(hit);
            else missing.push(key);
        }

        if (missing.length > 0) {
            throw createError(
                422,
                `Channel URL not found${type_channel ? ` (type=${type_channel})` : ''}: ${missing.join(', ')}`
            );
        }

        return matched;
    }

    buildStartUrls(channels) {
        return channels
            .map((ch) => String(ch.url || '').trim())
            .filter(Boolean)
            .map((url) => ({ url }));
    }

    async attachSubjectChannel(subjectId, channelId) {
        const subject = await this.subjectModel.findByPk(subjectId);
        if (!subject) throw createError(404, 'Subject not found');

        const channel = await this.channelModel.findByPk(channelId);
        if (!channel) throw createError(404, 'Channel not found');

        const [link, created] = await this.subjectChannelModel.findOrCreate({
            where: {
                subject_id: subjectId,
                channel_id: channelId,
            },
            defaults: {
                subject_id: subjectId,
                channel_id: channelId,
            },
        });

        return { link, created, channel };
    }

    async detachSubjectChannel(subjectId, channelId) {
        const deleted = await this.subjectChannelModel.destroy({
            where: {
                subject_id: subjectId,
                channel_id: channelId,
            },
        });
        if (!deleted) throw createError(404, 'Subject channel link not found');
        return { deleted: true };
    }

    async listSubjectIdsForChannel(channelId, { transaction } = {}) {
        const rows = await this.subjectChannelModel.findAll({
            where: { channel_id: channelId },
            attributes: ['subject_id'],
            transaction,
        });
        return rows.map((row) => Number(row.subject_id));
    }
}

module.exports = ChannelRepository;
