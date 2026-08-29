'use strict';

const createError = require('http-errors');
const MetricSnapshotRepository = require('../Repositories/MetricSnapshotRepository');
const {
    normalizeSnapshotDate,
    todaySnapshotDate,
} = require('../Helpers/SnapshotDateHelper');

class MetricSnapshotService {
    constructor() {
        this.repository = new MetricSnapshotRepository();
    }

    /**
     * Tạm thời chỉ cho phép snapshot đúng ngày hôm nay (APP_TIMEZONE).
     * @param {{ force?: boolean, snapshot_date?: string, channel_id?: number, scraper_run_id?: number }} [input]
     */
    async run(input = {}) {
        const force = Boolean(input.force);
        const today = todaySnapshotDate();
        const snapshotDate = input.snapshot_date
            ? normalizeSnapshotDate(input.snapshot_date)
            : today;
        if (!snapshotDate) {
            throw createError(422, 'Invalid snapshot_date');
        }
        if (snapshotDate !== today) {
            throw createError(
                422,
                `Chỉ được snapshot ngày hôm nay (${today}). Không hỗ trợ ngày ${snapshotDate}.`
            );
        }
        return this.repository.runSnapshot({
            force,
            snapshotDate: today,
            channelId: input.channel_id != null ? Number(input.channel_id) : null,
            scraperRunId: input.scraper_run_id != null ? Number(input.scraper_run_id) : null,
        });
    }

    async status(dateInput = 'today') {
        const snapshotDate = normalizeSnapshotDate(dateInput) || todaySnapshotDate();
        const exists = await this.repository.hasChannelSnapshotsForDate(snapshotDate);
        return { snapshot_date: snapshotDate, exists };
    }

    async channelDetail(channelId, query = {}) {
        const id = Number(channelId);
        if (!Number.isInteger(id) || id <= 0) throw createError(422, 'Invalid channel_id');

        const date = normalizeSnapshotDate(query.date || query.snapshot_date || 'today');
        const date_from = normalizeSnapshotDate(query.date_from);
        const date_to = normalizeSnapshotDate(query.date_to);

        if (date_from || date_to) {
            const series = await this.repository.getChannelSeries(id, { date_from, date_to });
            return { channel_id: id, date_from, date_to, series };
        }

        const snapshotDate = date || todaySnapshotDate();
        const today = await this.repository.getChannelSnapshotOnDate(id, snapshotDate);
        const prevDate = this._shiftDate(snapshotDate, -1);
        const yesterday = prevDate
            ? await this.repository.getChannelSnapshotOnDate(id, prevDate)
            : null;

        return {
            channel_id: id,
            snapshot_date: snapshotDate,
            snapshot: today,
            previous_date: prevDate,
            previous: yesterday,
            delta: this._channelDelta(today, yesterday),
        };
    }

    async channelTopPosts(channelId, query = {}) {
        const id = Number(channelId);
        if (!Number.isInteger(id) || id <= 0) throw createError(422, 'Invalid channel_id');

        const snapshotDate =
            normalizeSnapshotDate(query.date || query.snapshot_date || 'today') ||
            todaySnapshotDate();
        const sort = query.sort === 'trend_score' ? 'trend_score' : 'hot_score';
        const limit = Number(query.limit) || 10;

        const rows = await this.repository.getChannelTopPosts(id, snapshotDate, {
            sort,
            limit,
        });
        return { channel_id: id, snapshot_date: snapshotDate, sort, result: rows };
    }

    async postDetail(scraperRunId, query = {}) {
        const id = Number(scraperRunId);
        if (!Number.isInteger(id) || id <= 0) throw createError(422, 'Invalid scraper_run_id');

        const date = normalizeSnapshotDate(query.date || query.snapshot_date || 'today');
        const date_from = normalizeSnapshotDate(query.date_from);
        const date_to = normalizeSnapshotDate(query.date_to);

        if (date_from || date_to) {
            const series = await this.repository.getPostSeries(id, { date_from, date_to });
            return { scraper_run_id: id, date_from, date_to, series };
        }

        const snapshotDate = date || todaySnapshotDate();
        const today = await this.repository.getPostSnapshotOnDate(id, snapshotDate);
        const prevDate = this._shiftDate(snapshotDate, -1);
        const yesterday = prevDate
            ? await this.repository.getPostSnapshotOnDate(id, prevDate)
            : null;

        return {
            scraper_run_id: id,
            snapshot_date: snapshotDate,
            snapshot: today,
            previous_date: prevDate,
            previous: yesterday,
            delta: this._postDelta(today, yesterday),
        };
    }

    async postTopComments(scraperRunId, query = {}) {
        const id = Number(scraperRunId);
        if (!Number.isInteger(id) || id <= 0) throw createError(422, 'Invalid scraper_run_id');

        const snapshotDate =
            normalizeSnapshotDate(query.date || query.snapshot_date || 'today') ||
            todaySnapshotDate();
        const rows = await this.repository.getPostTopComments(id, snapshotDate);
        return { scraper_run_id: id, snapshot_date: snapshotDate, result: rows };
    }

    async compareChannels(query = {}) {
        const ids = this._parseIdList(query.channel_ids);
        if (ids.length === 0) throw createError(422, 'channel_ids is required');
        const date_from = normalizeSnapshotDate(query.date_from);
        const date_to = normalizeSnapshotDate(query.date_to);
        const rows = await this.repository.compareChannels(ids, { date_from, date_to });
        return { channel_ids: ids, date_from, date_to, result: rows };
    }

    async comparePosts(query = {}) {
        const ids = this._parseIdList(query.scraper_run_ids);
        if (ids.length === 0) throw createError(422, 'scraper_run_ids is required');
        const date_from = normalizeSnapshotDate(query.date_from);
        const date_to = normalizeSnapshotDate(query.date_to);
        const rows = await this.repository.comparePosts(ids, { date_from, date_to });
        return { scraper_run_ids: ids, date_from, date_to, result: rows };
    }

    async catalogPosts(query = {}) {
        const channelId =
            query.channel_id != null && query.channel_id !== ''
                ? Number(query.channel_id)
                : null;
        if (channelId != null && (!Number.isInteger(channelId) || channelId <= 0)) {
            throw createError(422, 'Invalid channel_id');
        }
        return this.repository.catalogPosts({
            channel_id: channelId || undefined,
            q: query.q || query.key_search,
            page: query.page,
            per_page: query.per_page,
        });
    }

    _parseIdList(raw) {
        if (Array.isArray(raw)) {
            return raw.map(Number).filter((n) => Number.isInteger(n) && n > 0);
        }
        if (raw == null || raw === '') return [];
        return String(raw)
            .split(/[,;\s]+/)
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isInteger(n) && n > 0);
    }

    _shiftDate(yyyyMmDd, dayDelta) {
        if (!yyyyMmDd) return null;
        const [y, m, d] = yyyyMmDd.split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d));
        dt.setUTCDate(dt.getUTCDate() + dayDelta);
        const yy = dt.getUTCFullYear();
        const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(dt.getUTCDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
    }

    _channelDelta(today, yesterday) {
        if (!today || !yesterday) return null;
        const keys = [
            'followers',
            'views_sum',
            'likes_sum',
            'comments_sum',
            'shares_sum',
            'angry_sum',
            'post_count_tracked',
        ];
        const delta = {};
        for (const key of keys) {
            delta[key] = toCountSafe(today[key]) - toCountSafe(yesterday[key]);
        }
        return delta;
    }

    _postDelta(today, yesterday) {
        if (!today || !yesterday) return null;
        const keys = ['views', 'likes', 'comments', 'shares', 'angry_count', 'hot_score', 'trend_score'];
        const delta = {};
        for (const key of keys) {
            delta[key] = Number(today[key] || 0) - Number(yesterday[key] || 0);
        }
        return delta;
    }
}

function toCountSafe(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

module.exports = MetricSnapshotService;
