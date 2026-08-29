'use strict';

/**
 * Biểu đồ email-safe (HTML/CSS thuần) — Gmail không clip như base64 PNG.
 * Không dùng Gemini / QuickChart ảnh nhúng.
 */

const SERIES_COLORS = [
    '#1d4ed8',
    '#dc2626',
    '#059669',
    '#d97706',
    '#7c3aed',
    '#0891b2',
    '#be185d',
    '#4338ca',
];

const POST_METRICS = [
    { key: 'views', label: 'Views' },
    { key: 'likes', label: 'Likes' },
    { key: 'comments', label: 'Comments' },
    { key: 'shares', label: 'Shares' },
    { key: 'hot_score', label: 'Hot score' },
    { key: 'trend_score', label: 'Trend score' },
];

const CHANNEL_METRICS = [
    { key: 'views_sum', label: 'Views (tracked)' },
    { key: 'likes_sum', label: 'Likes' },
    { key: 'comments_sum', label: 'Comments' },
    { key: 'shares_sum', label: 'Shares' },
    { key: 'followers', label: 'Followers' },
    { key: 'post_count_tracked', label: 'Posts tracked' },
];

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function shortLabel(label, max = 28) {
    const t = String(label || '')
        .replace(/\s+/g, ' ')
        .trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max)}…`;
}

function fmtNum(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '0';
    return v.toLocaleString('vi-VN');
}

function normalize(values) {
    const nums = values.map((v) => Number(v) || 0);
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max === min) {
        return nums.map((v) => (v > 0 ? 100 : 0));
    }
    return nums.map((v) => Math.round(((v - min) / (max - min)) * 100));
}

function legendHtml(entities) {
    return entities
        .map((e, i) => {
            const color = SERIES_COLORS[i % SERIES_COLORS.length];
            return `<span style="display:inline-block;margin:0 12px 6px 0;font-size:12px;color:#334155;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${color};margin-right:5px;vertical-align:middle;"></span>${escapeHtml(shortLabel(e.label, 36))}
      </span>`;
        })
        .join('');
}

function renderProfileBars({ entities, dates, metricMaps, metrics = POST_METRICS }) {
    const latest = dates[dates.length - 1] || '';
    const rows = metrics.map((m) => {
        const raw = entities.map((e) => {
            const series = metricMaps.get(e.id)?.get(m.key);
            if (!series || !latest) return 0;
            if (series.has(latest)) return series.get(latest);
            const known = dates.map((d) => series.get(d)).filter((v) => v != null);
            return known.length ? known[known.length - 1] : 0;
        });
        const norms = normalize(raw);
        const bars = entities
            .map((e, i) => {
                const color = SERIES_COLORS[i % SERIES_COLORS.length];
                const pct = Math.max(0, Math.min(100, norms[i]));
                return `<div style="margin:0 0 4px;">
            <div style="font-size:11px;color:#64748b;margin-bottom:2px;">${escapeHtml(shortLabel(e.label, 40))} · ${fmtNum(raw[i])} <span style="color:#94a3b8;">(norm ${pct})</span></div>
            <div style="background:#f1f5f9;border-radius:4px;height:12px;overflow:hidden;">
              <div style="width:${pct}%;height:12px;background:${color};border-radius:4px;"></div>
            </div>
          </div>`;
            })
            .join('');
        return `<tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top;width:110px;font-weight:700;font-size:12px;color:#0f172a;">${escapeHtml(m.label)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;">${bars}</td>
      </tr>`;
    }).join('');

    return `
      <h4 style="margin:0 0 6px;color:#0f172a;font-size:14px;">Profile chỉ số (chuẩn hóa 0–100)${latest ? ` · mốc ${escapeHtml(latest)}` : ''}</h4>
      <p style="margin:0 0 8px;color:#64748b;font-size:12px;">Mỗi chỉ số so trong nhóm đang chọn — tương đương radar trên web.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;">
        ${rows}
      </table>`;
}

function renderMetricSeries({ entities, dates, metricMaps, metric, entityNoun = 'Bài' }) {
    /** max absolute for bar scale */
    let maxVal = 0;
    for (const e of entities) {
        for (const d of dates) {
            const v = Number(metricMaps.get(e.id)?.get(metric.key)?.get(d)) || 0;
            if (v > maxVal) maxVal = v;
        }
    }
    if (maxVal <= 0) maxVal = 1;

    const dateHead = dates
        .map(
            (d) =>
                `<th style="padding:6px 4px;font-size:10px;color:#64748b;font-weight:600;text-align:center;border-bottom:1px solid #e2e8f0;">${escapeHtml(d.slice(5))}</th>`
        )
        .join('');

    const body = entities
        .map((e, i) => {
            const color = SERIES_COLORS[i % SERIES_COLORS.length];
            const cells = dates
                .map((d) => {
                    const v = metricMaps.get(e.id)?.get(metric.key)?.get(d);
                    if (v == null) {
                        return `<td style="padding:6px 4px;text-align:center;border-bottom:1px solid #f1f5f9;font-size:10px;color:#94a3b8;">—</td>`;
                    }
                    const h = Math.max(4, Math.round((Number(v) / maxVal) * 36));
                    return `<td style="padding:6px 4px;text-align:center;border-bottom:1px solid #f1f5f9;vertical-align:bottom;">
              <div style="height:40px;display:flex;align-items:flex-end;justify-content:center;">
                <div style="width:14px;height:${h}px;background:${color};border-radius:2px 2px 0 0;" title="${fmtNum(v)}"></div>
              </div>
              <div style="font-size:9px;color:#475569;margin-top:2px;">${fmtNum(v)}</div>
            </td>`;
                })
                .join('');
            return `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#334155;white-space:nowrap;max-width:140px;">
            <span style="display:inline-block;width:8px;height:8px;background:${color};border-radius:2px;margin-right:4px;"></span>${escapeHtml(shortLabel(e.label, 24))}
          </td>
          ${cells}
        </tr>`;
        })
        .join('');

    return `
      <div style="margin:12px 0;padding:10px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;">
        <h4 style="margin:0 0 8px;font-size:13px;color:#0f172a;">${escapeHtml(metric.label)} — diễn biến theo ngày</h4>
        <div style="overflow-x:auto;">
          <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;min-width:100%;font-size:11px;">
            <thead>
              <tr>
                <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">${escapeHtml(entityNoun)}</th>
                ${dateHead}
              </tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>`;
}

/**
 * @param {{
 *   entities: { id: number, label: string }[],
 *   dates: string[],
 *   metricMaps: Map<number, Map<string, Map<string, number>>>,
 *   metrics?: { key: string, label: string }[],
 *   entityNoun?: string,
 * }} input
 */
function renderCompareChartsHtml(input) {
    const {
        entities,
        dates,
        metricMaps,
        metrics = POST_METRICS,
        entityNoun = 'Bài',
    } = input;
    if (!entities?.length || !dates?.length) {
        return `<p style="color:#64748b;">Chưa đủ dữ liệu để vẽ biểu đồ.</p>`;
    }

    const seriesBlocks = metrics
        .map((metric) =>
            renderMetricSeries({ entities, dates, metricMaps, metric, entityNoun })
        )
        .join('');

    return `
      <h3 style="margin:24px 0 8px;color:#0f172a;">Biểu đồ so sánh</h3>
      <p style="margin:0 0 10px;color:#64748b;font-size:12px;">
        Profile chuẩn hóa + cột theo ngày (email-safe HTML, không phụ thuộc ảnh ngoài).
      </p>
      <div style="margin:0 0 12px;">${legendHtml(entities)}</div>
      ${renderProfileBars({ entities, dates, metricMaps, metrics })}
      ${seriesBlocks}
    `;
}

/**
 * @param {object[]} rows
 * @param {number[]} ids
 * @param {{ idKey: string, metrics: { key: string }[] }} opts
 */
function buildMetricMaps(rows, ids, { idKey, metrics }) {
    /** @type {Map<number, Map<string, Map<string, number>>>} */
    const metricMaps = new Map();
    for (const id of ids) {
        metricMaps.set(id, new Map(metrics.map((m) => [m.key, new Map()])));
    }
    const dateSet = new Set();
    for (const raw of rows) {
        const row = typeof raw.toJSON === 'function' ? raw.toJSON() : raw;
        const id = Number(row[idKey]);
        if (!metricMaps.has(id)) continue;
        const date = String(row.snapshot_date).slice(0, 10);
        dateSet.add(date);
        const maps = metricMaps.get(id);
        for (const m of metrics) {
            maps.get(m.key).set(date, Number(row[m.key]) || 0);
        }
    }
    return { metricMaps, dates: [...dateSet].sort() };
}

function buildPostMetricMaps(rows, ids) {
    return buildMetricMaps(rows, ids, { idKey: 'scraper_run_id', metrics: POST_METRICS });
}

function buildChannelMetricMaps(rows, ids) {
    return buildMetricMaps(rows, ids, { idKey: 'channel_id', metrics: CHANNEL_METRICS });
}

module.exports = {
    POST_METRICS,
    CHANNEL_METRICS,
    renderCompareChartsHtml,
    buildPostMetricMaps,
    buildChannelMetricMaps,
};
