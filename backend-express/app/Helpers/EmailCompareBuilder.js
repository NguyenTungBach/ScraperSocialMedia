'use strict';

const { escapeHtml, renderAnalysisTable, appBrandName } = require('./EmailAlertBuilder');

function fmtNum(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '0';
    return v.toLocaleString('vi-VN');
}

function fmtScore(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '0';
    return v.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

const POST_METRIC_ROWS = [
    { key: 'views', label: 'Views', fmt: fmtNum },
    { key: 'likes', label: 'Likes', fmt: fmtNum },
    { key: 'comments', label: 'Comments', fmt: fmtNum },
    { key: 'shares', label: 'Shares', fmt: fmtNum },
    { key: 'hot_score', label: 'Hot score', fmt: fmtScore },
    { key: 'trend_score', label: 'Trend score', fmt: fmtScore },
];

const CHANNEL_METRIC_ROWS = [
    { key: 'followers', label: 'Followers', fmt: fmtNum },
    { key: 'views_sum', label: 'Views', fmt: fmtNum },
    { key: 'likes_sum', label: 'Likes', fmt: fmtNum },
    { key: 'comments_sum', label: 'Comments', fmt: fmtNum },
    { key: 'shares_sum', label: 'Shares', fmt: fmtNum },
    { key: 'post_count_tracked', label: 'Bài tracked', fmt: fmtNum },
];

function shortColLabel(row, max = 42) {
    const raw = String(row?.label || row?.post_url || `#${row?.id || '?'}`).trim();
    if (raw.length <= max) return raw;
    return `${raw.slice(0, max)}…`;
}

/**
 * Bảng số liệu mốc cuối kỳ — cùng dạng UI: hàng = chỉ số, cột = đối tượng.
 * @param {{
 *   mode: 'channels'|'posts',
 *   asOfDate?: string|null,
 *   rows: object[],
 * }} opts
 */
function renderEndPeriodTable({ mode, asOfDate, rows = [] }) {
    if (!rows.length) {
        return `<p style="color:#64748b;">Không có snapshot cuối kỳ trong khoảng ngày.</p>`;
    }

    const metrics = mode === 'channels' ? CHANNEL_METRIC_ROWS : POST_METRIC_ROWS;
    const title = asOfDate
        ? `Bảng số liệu cuối kỳ (${escapeHtml(asOfDate)})`
        : 'Bảng số liệu cuối kỳ';

    const head = rows
        .map((r) => {
            const label = escapeHtml(shortColLabel(r));
            if (r.post_url) {
                return `<th style="padding:8px;text-align:right;max-width:180px;">
                  <a href="${escapeHtml(r.post_url)}" style="color:#2563eb;text-decoration:none;">${label}</a>
                </th>`;
            }
            return `<th style="padding:8px;text-align:right;max-width:180px;">${label}</th>`;
        })
        .join('');

    const body = metrics
        .map((m) => {
            const cells = rows
                .map((r) => {
                    const val = r[m.key];
                    const text = val == null || val === '' ? '—' : m.fmt(val);
                    return `<td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;">${text}</td>`;
                })
                .join('');
            return `<tr>
              <td style="padding:8px;border-bottom:1px solid #f1f5f9;font-weight:600;color:#334155;">${escapeHtml(m.label)}</td>
              ${cells}
            </tr>`;
        })
        .join('');

    return `<h3 style="margin:20px 0 8px;color:#0f172a;">${title}</h3>
      <div style="overflow-x:auto;margin:12px 0;">
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;min-width:480px;font-size:12px;border:1px solid #e2e8f0;">
        <thead>
          <tr style="background:#f8fafc;color:#475569;">
            <th style="padding:8px;text-align:left;">Chỉ số</th>
            ${head}
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

/**
 * Top bài trong khoảng ngày (theo kênh hoặc danh sách so sánh).
 * @param {{
 *   groups: { label: string, posts: object[] }[],
 *   sortLabel?: string,
 * }} opts
 */
function renderTopPostsSections({ groups = [], sortLabel = 'hot_score' } = {}) {
    if (!groups.length) return '';

    let html = `<h3 style="margin:24px 0 8px;color:#0f172a;">Top bài viết trong khoảng ngày</h3>
      <p style="margin:0 0 8px;color:#64748b;font-size:12px;">Xếp theo ${escapeHtml(sortLabel)} · lấy metrics snapshot mới nhất trong khoảng · tối đa 10 bài / kênh</p>`;

    for (const group of groups) {
        html += `<h4 style="margin:16px 0 6px;font-size:14px;color:#0f172a;">${escapeHtml(group.label)}</h4>`;
        const posts = group.posts || [];
        if (!posts.length) {
            html += `<p style="color:#64748b;font-size:12px;">Không có bài trong khoảng ngày.</p>`;
            continue;
        }

        const rows = posts
            .map((p, idx) => {
                const title = p.title || p.post_url || `Bài #${p.scraper_run_id}`;
                const link = p.post_url
                    ? `<a href="${escapeHtml(p.post_url)}" style="color:#2563eb;">${escapeHtml(title)}</a>`
                    : escapeHtml(title);
                return `<tr>
                  <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${idx + 1}</td>
                  <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${link}</td>
                  <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;">${fmtNum(p.views)}</td>
                  <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;">${fmtNum(p.likes)}</td>
                  <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;">${fmtNum(p.comments)}</td>
                  <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;">${fmtScore(p.hot_score)}</td>
                  <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;">${fmtScore(p.trend_score)}</td>
                </tr>`;
            })
            .join('');

        html += `<div style="overflow-x:auto;margin:0 0 12px;">
          <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;min-width:560px;font-size:12px;border:1px solid #e2e8f0;">
            <thead>
              <tr style="background:#f8fafc;color:#475569;">
                <th style="padding:8px;text-align:left;">#</th>
                <th style="padding:8px;text-align:left;">Bài</th>
                <th style="padding:8px;text-align:right;">Views</th>
                <th style="padding:8px;text-align:right;">Likes</th>
                <th style="padding:8px;text-align:right;">Cmt</th>
                <th style="padding:8px;text-align:right;">Hot</th>
                <th style="padding:8px;text-align:right;">Trend</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    return html;
}

function renderPostAnalysisBlocks(videoBlocks = []) {
    if (!videoBlocks.length) {
        return `<h3 style="margin:24px 0 8px;color:#0f172a;">Phân tích comment AI</h3>
          <p style="color:#64748b;">Chưa có bài nào đã phân tích AI trong danh sách so sánh.</p>`;
    }
    let html = `<h3 style="margin:24px 0 8px;color:#0f172a;">Phân tích comment AI</h3>`;
    for (const block of videoBlocks) {
        const v = block.video || {};
        const meta = block.meta || {};
        html += `<div style="margin:12px 0;padding:12px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;">
          <h4 style="margin:0 0 6px;">${escapeHtml(v.title || v.platform_post_id || `Bài #${v.id}`)}</h4>`;
        if (v.post_url) {
            html += `<p style="margin:0 0 8px;"><a href="${escapeHtml(v.post_url)}" style="color:#2563eb;">${escapeHtml(v.post_url)}</a></p>`;
        }
        if (v.content_brief && v.content_brief_status === 'done') {
            html += `<div style="margin:0 0 12px;padding:10px 12px;background:#eef2ff;border-left:4px solid #6366f1;border-radius:6px;">
              <div style="font-size:11px;font-weight:700;color:#4338ca;text-transform:uppercase;margin-bottom:4px;">Tóm tắt nội dung (AI)</div>
              <div style="font-size:13px;color:#334155;line-height:1.45;">${escapeHtml(v.content_brief)}</div>
            </div>`;
        }
        html += `<p style="margin:0 0 12px;color:#64748b;font-size:13px;">Hot ${fmtScore(v.hot_score)} · ${v.comment_total || 0} comment đã scrape`;
        if (meta.analyzed) {
            html += ` · ${meta.analyzed_lone_count || 0} lone + ${meta.analyzed_thread_count || 0} thread từ DB`;
        }
        html += `</p>`;
        html += `<h4 style="margin:12px 0 8px;font-size:14px;color:#0f172a;">Bảng phân tích comment AI</h4>`;
        html += renderAnalysisTable(block);
        html += `</div>`;
    }
    return html;
}

/**
 * @param {{
 *   mode: 'channels'|'posts',
 *   date_from?: string|null,
 *   date_to?: string|null,
 *   entityCount?: number,
 *   endPeriodRows?: object[],
 *   asOfDate?: string|null,
 *   topPostGroups?: { label: string, posts: object[] }[],
 *   topSortLabel?: string,
 *   videoBlocks?: object[],
 * }} payload
 */
function buildCompareReportEmail(payload) {
    const modeLabel = payload.mode === 'channels' ? 'kênh' : 'bài / video';
    const range =
        payload.date_from || payload.date_to
            ? `${payload.date_from || '…'} → ${payload.date_to || '…'}`
            : 'toàn bộ snapshot có sẵn';
    const entityCount = payload.entityCount ?? payload.endPeriodRows?.length ?? 0;
    const isChannels = payload.mode === 'channels';

    return `
      <div style="font-family:Arial,sans-serif;color:#0f172a;max-width:960px;">
        <h2>${escapeHtml(appBrandName())} — Báo cáo so sánh ${escapeHtml(modeLabel)}</h2>
        <p style="color:#475569;">Khoảng ngày: <b>${escapeHtml(range)}</b> · ${entityCount} đối tượng</p>

        ${renderEndPeriodTable({
            mode: payload.mode,
            asOfDate: payload.asOfDate,
            rows: payload.endPeriodRows || [],
        })}

        ${
            isChannels
                ? renderTopPostsSections({
                      groups: payload.topPostGroups || [],
                      sortLabel: payload.topSortLabel || 'hot_score',
                  })
                : renderPostAnalysisBlocks(payload.videoBlocks || [])
        }
      </div>
    `;
}

module.exports = {
    buildCompareReportEmail,
    renderEndPeriodTable,
    renderTopPostsSections,
    fmtNum,
};
