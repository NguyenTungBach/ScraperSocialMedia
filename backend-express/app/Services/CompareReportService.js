'use strict';

const createError = require('http-errors');
const MetricSnapshotService = require('./MetricSnapshotService');
const CommentRepository = require('../Repositories/CommentRepository');
const MailService = require('./MailService');
const { buildCompareReportEmail } = require('../Helpers/EmailCompareBuilder');
const mailConfig = require('../../config/mail');
const db = require('../Models');
const { Op } = require('sequelize');

const { Channel, ScraperRun } = db;

function toPlain(row) {
    if (!row) return null;
    return typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
}

function parseIdList(raw) {
    if (Array.isArray(raw)) {
        return raw.map(Number).filter((n) => Number.isInteger(n) && n > 0);
    }
    if (raw == null || raw === '') return [];
    return String(raw)
        .split(/[,;\s]+/)
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);
}

function buildSeriesMap(rows, idKey) {
    /** @type {Map<number, Map<string, object>>} */
    const byId = new Map();
    const dateSet = new Set();

    for (const raw of rows) {
        const row = toPlain(raw);
        const id = Number(row[idKey]);
        const date = String(row.snapshot_date).slice(0, 10);
        dateSet.add(date);
        if (!byId.has(id)) byId.set(id, new Map());
        byId.get(id).set(date, row);
    }

    const dates = [...dateSet].sort();
    return { byId, dates };
}

/** Snapshot mới nhất trong khoảng cho mỗi id. */
function pickEndPeriodRows(ids, labelsById, byId, dates, mode, extrasById = new Map()) {
    const lastDate = dates.length ? dates[dates.length - 1] : null;
    return ids.map((id) => {
        const series = byId.get(id) || new Map();
        let row = null;
        let snapshotDate = null;
        for (let i = dates.length - 1; i >= 0; i -= 1) {
            const d = dates[i];
            if (series.has(d)) {
                row = series.get(d);
                snapshotDate = d;
                break;
            }
        }
        const extras = extrasById.get(id) || {};
        if (mode === 'channels') {
            return {
                id,
                label: labelsById.get(id) || `#${id}`,
                snapshot_date: snapshotDate || lastDate,
                followers: row?.followers ?? 0,
                views_sum: row?.views_sum ?? 0,
                likes_sum: row?.likes_sum ?? 0,
                comments_sum: row?.comments_sum ?? 0,
                shares_sum: row?.shares_sum ?? 0,
                post_count_tracked: row?.post_count_tracked ?? 0,
            };
        }
        return {
            id,
            label: labelsById.get(id) || `#${id}`,
            snapshot_date: snapshotDate || lastDate,
            post_url: extras.post_url || null,
            views: row?.views ?? 0,
            likes: row?.likes ?? 0,
            comments: row?.comments ?? 0,
            shares: row?.shares ?? 0,
            hot_score: row?.hot_score ?? 0,
            trend_score: row?.trend_score ?? 0,
        };
    });
}

function mapTopPostRow(raw) {
    const row = toPlain(raw);
    const run = row.scraperRun || row.scraper_run || {};
    return {
        scraper_run_id: row.scraper_run_id,
        title: run.title || null,
        post_url: run.post_url || null,
        platform: run.platform || row.platform || null,
        views: row.views,
        likes: row.likes,
        comments: row.comments,
        hot_score: row.hot_score,
        trend_score: row.trend_score,
        snapshot_date: row.snapshot_date,
    };
}

class CompareReportService {
    constructor() {
        this.snapshotService = new MetricSnapshotService();
        this.commentRepository = new CommentRepository();
    }

    /**
     * @param {{
     *   mode?: string,
     *   channel_ids?: number[]|string,
     *   scraper_run_ids?: number[]|string,
     *   date_from?: string,
     *   date_to?: string,
     *   metric?: string,
     *   to?: string|null,
     *   bcc?: string[]|null,
     * }} input
     */
    async sendCompareEmail(input = {}) {
        const mode = String(input.mode || '').toLowerCase();
        if (mode !== 'channels' && mode !== 'posts') {
            throw createError(422, 'mode must be "channels" or "posts"');
        }

        const recipient = (input.to || mailConfig.mailMain || '').trim();
        if (!recipient) {
            throw createError(422, 'Missing recipient. Set MAIL_MAIN or pass body.to');
        }
        if (!mailConfig.isTransportReady()) {
            throw createError(422, 'Mail transport is not configured');
        }

        const bcc = this._mergeBcc(recipient, input.bcc);

        if (mode === 'channels') {
            return this._sendChannelsReport({
                channel_ids: parseIdList(input.channel_ids),
                date_from: input.date_from,
                date_to: input.date_to,
                recipient,
                bcc,
            });
        }

        return this._sendPostsReport({
            scraper_run_ids: parseIdList(input.scraper_run_ids),
            date_from: input.date_from,
            date_to: input.date_to,
            recipient,
            bcc,
        });
    }

    async _sendChannelsReport({ channel_ids, date_from, date_to, recipient, bcc }) {
        if (channel_ids.length === 0) {
            throw createError(422, 'channel_ids is required');
        }

        const compare = await this.snapshotService.compareChannels({
            channel_ids,
            date_from,
            date_to,
        });
        const rows = compare.result || [];
        const { byId, dates } = buildSeriesMap(rows, 'channel_id');

        const channels = await Channel.findAll({
            where: { id: { [Op.in]: channel_ids } },
            attributes: ['id', 'name', 'type_channel'],
        });
        const labelsById = new Map(
            channels.map((c) => {
                const p = toPlain(c);
                return [p.id, `${p.name} (${p.type_channel || '?'})`];
            })
        );
        for (const id of channel_ids) {
            if (!labelsById.has(id)) labelsById.set(id, `Kênh #${id}`);
        }

        const endPeriodRows = pickEndPeriodRows(channel_ids, labelsById, byId, dates, 'channels');
        const asOfDate = dates.length ? dates[dates.length - 1] : compare.date_to || null;

        const topPostGroups = [];
        for (const id of channel_ids) {
            const topRows = await this.snapshotService.repository.getChannelTopPostsInRange(id, {
                date_from: compare.date_from,
                date_to: compare.date_to,
                sort: 'hot_score',
                limit: 10,
            });
            topPostGroups.push({
                label: labelsById.get(id),
                posts: topRows.map(mapTopPostRow),
            });
        }

        const html = buildCompareReportEmail({
            mode: 'channels',
            date_from: compare.date_from,
            date_to: compare.date_to,
            entityCount: channel_ids.length,
            endPeriodRows,
            asOfDate,
            topPostGroups,
            topSortLabel: 'hot_score',
        });

        const ok = await MailService.sendHtml({
            to: recipient,
            subject: `[So sánh kênh] ${channel_ids.length} kênh · ${dates[0] || '?'}–${dates[dates.length - 1] || '?'}`,
            html,
            bcc: bcc.length ? bcc : undefined,
        });
        if (!ok) throw createError(500, 'Failed to send compare report email');

        return {
            sent: true,
            to: recipient,
            bcc_count: bcc.length,
            mode: 'channels',
            channel_ids,
            date_from: compare.date_from,
            date_to: compare.date_to,
            as_of: asOfDate,
            top_posts_count: topPostGroups.reduce((n, g) => n + (g.posts?.length || 0), 0),
        };
    }

    async _sendPostsReport({ scraper_run_ids, date_from, date_to, recipient, bcc }) {
        if (scraper_run_ids.length === 0) {
            throw createError(422, 'scraper_run_ids is required');
        }

        const compare = await this.snapshotService.comparePosts({
            scraper_run_ids,
            date_from,
            date_to,
        });
        const rows = compare.result || [];
        const { byId, dates } = buildSeriesMap(rows, 'scraper_run_id');

        const runs = await ScraperRun.findAll({
            where: { id: { [Op.in]: scraper_run_ids } },
            attributes: ['id', 'title', 'post_url', 'platform'],
        });
        const labelsById = new Map();
        const extrasById = new Map();
        for (const r of runs) {
            const p = toPlain(r);
            const title = (p.title || p.post_url || `Bài #${p.id}`).slice(0, 60);
            labelsById.set(p.id, `${title} (${p.platform || '?'})`);
            extrasById.set(p.id, { post_url: p.post_url || null });
        }
        for (const id of scraper_run_ids) {
            if (!labelsById.has(id)) labelsById.set(id, `Bài #${id}`);
        }

        const endPeriodRows = pickEndPeriodRows(
            scraper_run_ids,
            labelsById,
            byId,
            dates,
            'posts',
            extrasById
        );
        const asOfDate = dates.length ? dates[dates.length - 1] : compare.date_to || null;

        const summaryMap = await this.commentRepository.getCommentSummaryForRuns(scraper_run_ids);
        const videoBlocks = [];
        for (const id of scraper_run_ids) {
            const summary = summaryMap.get(id);
            if (!summary?.analyzed) continue;
            const payload = await this.commentRepository.getAnalysisPayloadForEmail(id);
            if (payload) videoBlocks.push(payload);
        }

        const html = buildCompareReportEmail({
            mode: 'posts',
            date_from: compare.date_from,
            date_to: compare.date_to,
            entityCount: scraper_run_ids.length,
            endPeriodRows,
            asOfDate,
            videoBlocks,
        });

        const ok = await MailService.sendHtml({
            to: recipient,
            subject: `[So sánh bài] ${scraper_run_ids.length} bài · ${dates[0] || '?'}–${dates[dates.length - 1] || '?'}`,
            html,
            bcc: bcc.length ? bcc : undefined,
        });
        if (!ok) throw createError(500, 'Failed to send compare report email');

        return {
            sent: true,
            to: recipient,
            bcc_count: bcc.length,
            mode: 'posts',
            scraper_run_ids,
            date_from: compare.date_from,
            date_to: compare.date_to,
            as_of: asOfDate,
            analysis_blocks: videoBlocks.length,
        };
    }

    _mergeBcc(recipient, bodyBcc) {
        const bccRaw = [
            ...mailConfig.alertBcc,
            ...(Array.isArray(bodyBcc)
                ? bodyBcc
                : typeof bodyBcc === 'string'
                  ? mailConfig.parseEmailList(bodyBcc)
                  : []),
        ];
        const bccSeen = new Set();
        const bcc = [];
        const recipientLower = recipient.toLowerCase();
        for (const email of bccRaw) {
            const trimmed = String(email || '').trim();
            const key = trimmed.toLowerCase();
            if (!trimmed || key === recipientLower || bccSeen.has(key)) continue;
            bccSeen.add(key);
            bcc.push(trimmed);
        }
        return bcc;
    }
}

module.exports = CompareReportService;
