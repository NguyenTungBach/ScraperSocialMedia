'use strict';

const { formatScore, normalizePlatform } = require('./PostScoreHelper');
const {
    classifyLabel,
    countAnalysisByType,
} = require('./CommentAnalysisHelper');

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function truncate(text, max = 160) {
    const t = String(text || '')
        .replace(/\s+/g, ' ')
        .trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max)}…`;
}

function platformLabel(platform) {
    const labels = {
        facebook: 'Facebook',
        youtube: 'YouTube',
        tiktok: 'TikTok',
    };
    return labels[normalizePlatform(platform)] || String(platform || '—');
}

function platformBadge(platform) {
    const label = platformLabel(platform);
    const colors = {
        facebook: { bg: '#dbeafe', color: '#1d4ed8' },
        youtube: { bg: '#fee2e2', color: '#b91c1c' },
        tiktok: { bg: '#f3e8ff', color: '#7e22ce' },
    };
    const tone = colors[normalizePlatform(platform)] || { bg: '#f1f5f9', color: '#475569' };
    return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${tone.bg};color:${tone.color};font-size:11px;font-weight:600;">${escapeHtml(label)}</span>`;
}

function classifiedBadge(classifiedAs) {
    const value = classifiedAs || 'unknown';
    const colors = {
        negative: { bg: '#fee2e2', color: '#b91c1c' },
        debate: { bg: '#dbeafe', color: '#1d4ed8' },
        normal: { bg: '#f1f5f9', color: '#475569' },
        unknown: { bg: '#fef3c7', color: '#92400e' },
    };
    const tone = colors[value] || colors.unknown;
    return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${tone.bg};color:${tone.color};font-size:11px;font-weight:600;">${escapeHtml(classifyLabel(value))}</span>`;
}

function renderAnalysisStats(stats) {
    const parts = [`<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border-radius:999px;background:#f8fafc;border:1px solid #e2e8f0;font-size:12px;">${stats.total} mục đã phân tích</span>`];
    if (stats.negative > 0) {
        parts.push(
            `<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border-radius:999px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:12px;">${stats.negative} tiêu cực</span>`
        );
    }
    if (stats.debate > 0) {
        parts.push(
            `<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border-radius:999px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-size:12px;">${stats.debate} tranh luận</span>`
        );
    }
    if (stats.normal > 0) {
        parts.push(
            `<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border-radius:999px;background:#f8fafc;border:1px solid #e2e8f0;font-size:12px;">${stats.normal} bình thường</span>`
        );
    }
    return `<div style="margin:10px 0 12px;">${parts.join('')}</div>`;
}

function renderRowDetails(row) {
    const chunks = [];
    if (row.groupType === 'thread' && row.replyCount > 0) {
        const preview = (row.replies || [])
            .slice(0, 3)
            .map(
                (reply) =>
                    `<div style="margin:2px 0;font-size:12px;color:#334155;"><b>${escapeHtml(reply.author || 'Ẩn danh')}:</b> ${escapeHtml(truncate(reply.text, 100))}</div>`
            )
            .join('');
        const more =
            row.replyCount > 3
                ? `<div style="font-size:11px;color:#64748b;">… và ${row.replyCount - 3} phản hồi khác</div>`
                : '';
        chunks.push(
            `<div style="margin-bottom:6px;font-size:12px;color:#4338ca;font-weight:600;">${row.replyCount} phản hồi trong chuỗi</div>${preview}${more}`
        );
    }
    if (row.reason) {
        chunks.push(
            `<div style="font-size:12px;color:#64748b;font-style:italic;line-height:1.4;">${escapeHtml(row.reason)}</div>`
        );
    }
    return chunks.join('') || '—';
}

function renderAnalysisTable(videoBlock) {
    const rows = videoBlock.analysis_rows || [];
    if (rows.length === 0) {
        return `<p style="color:#64748b;margin:8px 0;">Chưa có phân tích AI trong DB cho bài viết này.</p>`;
    }

    const stats = countAnalysisByType(rows);
    const body = rows
        .map((row, index) => {
            const extraTag = row.hasNegativity
                ? `<span style="display:inline-block;margin-left:4px;padding:2px 6px;border-radius:999px;background:#fff7ed;color:#c2410c;font-size:10px;">Có tiêu cực</span>`
                : '';
            return `<tr>
              <td style="padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:top;">${index + 1}</td>
              <td style="padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:top;">${escapeHtml(classifyLabel(row.groupType))}</td>
              <td style="padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:top;">${classifiedBadge(row.classifiedAs)}${extraTag}</td>
              <td style="padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:top;">${escapeHtml(row.author)}</td>
              <td style="padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:top;max-width:260px;line-height:1.4;">${escapeHtml(truncate(row.text, 160))}</td>
              <td style="padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:top;">${escapeHtml(classifyLabel(row.sentiment))}</td>
              <td style="padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:top;">${escapeHtml(classifyLabel(row.category))}</td>
              <td style="padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:top;">${escapeHtml(classifyLabel(row.severity))}</td>
              <td style="padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:top;max-width:240px;">${renderRowDetails(row)}</td>
            </tr>`;
        })
        .join('');

    return `${renderAnalysisStats(stats)}
      <div style="overflow-x:auto;margin-top:4px;">
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;min-width:860px;font-size:12px;border:1px solid #e2e8f0;border-radius:8px;">
          <thead>
            <tr style="background:#f8fafc;color:#475569;text-transform:uppercase;font-size:11px;">
              <th style="padding:8px;text-align:left;">#</th>
              <th style="padding:8px;text-align:left;">Nhóm</th>
              <th style="padding:8px;text-align:left;">Phân loại</th>
              <th style="padding:8px;text-align:left;">Tác giả</th>
              <th style="padding:8px;text-align:left;">Nội dung</th>
              <th style="padding:8px;text-align:left;">Cảm xúc</th>
              <th style="padding:8px;text-align:left;">Loại</th>
              <th style="padding:8px;text-align:left;">Mức độ</th>
              <th style="padding:8px;text-align:left;">Chi tiết</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
}

function buildSubjectAnalysisSection(subjectAnalysis) {
    const { subjectName, subjectStats, videos = [], geminiDisabled } = subjectAnalysis;
    let html = `<div style="margin:24px 0 12px;padding-top:16px;border-top:2px solid #e2e8f0;">
      <h2 style="margin:0 0 8px;color:#0f172a;">▼ ${escapeHtml(subjectName)}</h2>
      <p style="margin:0 0 12px;color:#475569;">Hot ${formatScore(subjectStats?.hot_score)} · Trend ${formatScore(subjectStats?.trend_score)} · ${videos.length} bài viết</p>`;

    if (geminiDisabled) {
        html += `<p style="color:#b45309;">AI chưa bật — chưa phân tích comment.</p></div>`;
        return html;
    }

    if (videos.length === 0) {
        html += `<p style="color:#64748b;">Chưa có bài viết hoặc comment để phân tích.</p></div>`;
        return html;
    }

    for (const videoBlock of videos) {
        const v = videoBlock.video || {};
        const meta = videoBlock.meta || {};
        const title = v.title || v.platform_post_id || 'Bài viết';
        html += `<div style="margin:16px 0;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;">
          <h3 style="margin:0 0 6px;font-size:16px;">${platformBadge(v.platform)} ${escapeHtml(title)}</h3>`;

        if (v.post_url) {
            html += `<p style="margin:0 0 8px;"><a href="${escapeHtml(v.post_url)}" style="color:#2563eb;">${escapeHtml(v.post_url)}</a></p>`;
        }

        if (v.content_brief && v.content_brief_status === 'done') {
            html += `<div style="margin:0 0 12px;padding:10px 12px;background:#eef2ff;border-left:4px solid #6366f1;border-radius:6px;">
              <div style="font-size:11px;font-weight:700;color:#4338ca;text-transform:uppercase;margin-bottom:4px;">Tóm tắt nội dung (AI)</div>
              <div style="font-size:13px;color:#334155;line-height:1.45;">${escapeHtml(v.content_brief)}</div>
            </div>`;
        }

        html += `<p style="margin:0 0 12px;color:#64748b;font-size:13px;">Hot ${formatScore(v.hot_score)} · Trend ${formatScore(v.trend_score)} · ${v.comment_total || 0} comment đã scrape`;
        if (meta.analyzed) {
            html += ` · ${meta.analyzed_lone_count || 0} lone + ${meta.analyzed_thread_count || 0} thread từ DB`;
        }
        html += `</p>`;

        if ((v.comment_total || 0) === 0) {
            html += `<p style="color:#64748b;">Chưa có dữ liệu comment — cần quét bài trước.</p></div>`;
            continue;
        }

        const analysisRows = videoBlock.analysis_rows || [];
        if (analysisRows.length > 0) {
            html += renderAnalysisStats(countAnalysisByType(analysisRows));
        } else {
            html += `<p style="color:#64748b;margin:8px 0;">Chưa có phân tích AI trong DB cho bài viết này.</p>`;
        }

        // TODO: bật lại bảng comment chi tiết khi cần — renderAnalysisTable()
        // html += `<h4 style="margin:12px 0 8px;font-size:14px;color:#0f172a;">Bảng phân tích comment AI</h4>`;
        // html += renderAnalysisTable(videoBlock);
        html += `</div>`;
    }

    html += `</div>`;
    return html;
}

function buildNoAlertEmail({ thresholds = {}, subject_id = null } = {}) {
    const scopeNote = subject_id
        ? `<p>Phạm vi kiểm tra: subject #${escapeHtml(subject_id)}</p>`
        : `<p>Phạm vi kiểm tra: tất cả subject (Facebook, YouTube, TikTok — tháng hiện tại)</p>`;

    return `
      <div style="font-family:Arial,sans-serif;color:#0f172a;max-width:960px;">
        <h2>ScraperSocialMedia — Báo cáo alert hot/trend</h2>
        <p style="padding:12px 16px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:6px;">
          <b>Không có đối tượng vượt ngưỡng</b> trong phạm vi kiểm tra lần này.
        </p>
        <p>Ngưỡng: hot_score &gt;= <b>${thresholds.hot}</b> <b>hoặc</b> trend_score &gt;= <b>${thresholds.trend}</b></p>
        ${scopeNote}
        <p style="color:#64748b;font-size:13px;margin-top:20px;">Email tự động từ cron alert — không cần xử lý thêm.</p>
      </div>
    `;
}

function buildAlertEmail({ alertPosts = [], subjectAnalyses = [], thresholds = {}, geminiDisabled = false }) {
    const rowsHtml = alertPosts
        .map((row) => {
            const name = row.subject?.name || `#${row.subject_id}`;
            const title = truncate(row.title || row.platform_post_id || '—', 80);
            const titleCell = row.post_url
                ? `<a href="${escapeHtml(row.post_url)}" style="color:#2563eb;">${escapeHtml(title)}</a>`
                : escapeHtml(title);
            return `<tr>
              <td>${escapeHtml(name)}</td>
              <td>${platformBadge(row.platform)}</td>
              <td>${titleCell}</td>
              <td>${row.likes ?? 0}</td>
              <td>${row.comments ?? 0}</td>
              <td>${row.shares ?? 0}</td>
              <td>${row.views ?? 0}</td>
              <td>${row.angry_count ?? 0}</td>
              <td>${formatScore(row.trend_score)}</td>
              <td>${formatScore(row.hot_score)}</td>
            </tr>`;
        })
        .join('');

    let analysisHtml = `<h2 style="margin-top:28px;color:#0f172a;">Phân tích comment AI (top bài hot)</h2>`;
    if (geminiDisabled) {
        analysisHtml += `<p style="color:#b45309;">GEMINI_ENABLED=false hoặc thiếu API key — chỉ gửi bảng tổng quan.</p>`;
    } else if (subjectAnalyses.length === 0) {
        analysisHtml += `<p style="color:#64748b;">Không có dữ liệu phân tích comment.</p>`;
    } else {
        for (const sa of subjectAnalyses) {
            analysisHtml += buildSubjectAnalysisSection(sa);
        }
    }

    const html = `
      <div style="font-family:Arial,sans-serif;color:#0f172a;max-width:960px;">
        <h2>ScraperSocialMedia — Alert vượt ngưỡng</h2>
        <p>Ngưỡng: hot_score &gt;= <b>${thresholds.hot}</b> <b>hoặc</b> trend_score &gt;= <b>${thresholds.trend}</b></p>
        <h3 style="margin-top:20px;">Bài viết vượt ngưỡng (${alertPosts.length})</h3>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th>Subject</th><th>Platform</th><th>Bài viết</th><th>Likes</th><th>Comments</th>
              <th>Shares</th><th>Views</th><th>Angry</th><th>Trend</th><th>Hot</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        ${analysisHtml}
      </div>
    `;

    return html;
}

module.exports = {
    buildAlertEmail,
    buildNoAlertEmail,
    escapeHtml,
    renderAnalysisTable,
};
