'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChannelDailySnapshotRow } from '@/lib/api/snapshots';
import styles from './CompareModal.module.scss';

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

export const CHANNEL_METRICS = [
  { key: 'views_sum', label: 'Views (tracked)' },
  { key: 'likes_sum', label: 'Likes' },
  { key: 'comments_sum', label: 'Comments' },
  { key: 'shares_sum', label: 'Shares' },
  { key: 'followers', label: 'Followers' },
  { key: 'post_count_channel', label: 'Số bài viết' },
  { key: 'post_count_tracked', label: 'Posts tracked' },
] as const;

export type ChannelMetricKey = (typeof CHANNEL_METRICS)[number]['key'];

function fmt(n: number) {
  return Number.isFinite(n) ? n.toLocaleString('vi-VN') : '0';
}

function fmtDelta(n: number | null) {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('vi-VN')}`;
}

function shortLabel(label: string, max = 28) {
  const t = label.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function seriesKey(id: number) {
  return `c${id}`;
}

function normalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max === min) {
    return values.map((v) => (v > 0 ? 100 : 0));
  }
  return values.map((v) => Math.round(((v - min) / (max - min)) * 100));
}

interface CompareChannelChartsProps {
  channelIds: number[];
  rows: ChannelDailySnapshotRow[];
  labelById: Map<number, string>;
  /** Mốc A / B cho Δ (vd. Từ ngày / Đến ngày). Thiếu snapshot → fallback 2 mốc gần nhất. */
  compareDateFrom?: string;
  compareDateTo?: string;
  /** Chỉ hiện Δ kỳ A vs B (modal so sánh theo kỳ) */
  hideOverviewTab?: boolean;
  /** Kiểu kỳ — chỉnh copy tiêu đề Δ */
  periodMode?: 'day' | 'month' | 'year';
}

export function CompareChannelCharts({
  channelIds,
  rows,
  labelById,
  compareDateFrom,
  compareDateTo,
  hideOverviewTab = false,
  periodMode = 'day',
}: CompareChannelChartsProps) {
  const { dates, byIdMetric, radarData, latestLabel, dayOverDay } = useMemo(() => {
    const dateSet = new Set<string>();
    const byIdMetric = new Map<number, Map<ChannelMetricKey, Map<string, number>>>();

    for (const id of channelIds) {
      byIdMetric.set(id, new Map(CHANNEL_METRICS.map((m) => [m.key, new Map()])));
    }

    for (const raw of rows) {
      const id = Number(raw.channel_id);
      if (!byIdMetric.has(id)) continue;
      const date = String(raw.snapshot_date).slice(0, 10);
      dateSet.add(date);
      const metrics = byIdMetric.get(id)!;
      for (const m of CHANNEL_METRICS) {
        metrics.get(m.key)!.set(date, Number(raw[m.key]) || 0);
      }
    }

    const dates = [...dateSet].sort();
    const latest = dates[dates.length - 1] || '';
    const explicitFrom = compareDateFrom?.slice(0, 10) || '';
    const explicitTo = compareDateTo?.slice(0, 10) || '';

    const radarData = CHANNEL_METRICS.map((m) => {
      const rawVals = channelIds.map((id) => {
        const series = byIdMetric.get(id)?.get(m.key);
        if (!series || !latest) return 0;
        if (series.has(latest)) return series.get(latest)!;
        const known = dates.map((d) => series.get(d)).filter((v): v is number => v != null);
        return known.length ? known[known.length - 1] : 0;
      });
      const norm = normalize(rawVals);
      const point: Record<string, string | number> = {
        metric: m.label,
        _raw: rawVals.join('|'),
      };
      channelIds.forEach((id, i) => {
        point[seriesKey(id)] = norm[i];
        point[`${seriesKey(id)}_raw`] = rawVals[i];
      });
      return point;
    });

    const dayOverDay = channelIds.map((id) => {
      const metricMaps = byIdMetric.get(id);
      const channelDates = dates.filter((d) =>
        CHANNEL_METRICS.some((m) => metricMaps?.get(m.key)?.has(d))
      );
      const fallbackLatest = channelDates[channelDates.length - 1] || null;
      const fallbackPrev = channelDates.length >= 2 ? channelDates[channelDates.length - 2] : null;

      const hasExplicitFrom = Boolean(
        explicitFrom &&
          metricMaps &&
          CHANNEL_METRICS.some((m) => metricMaps.get(m.key)?.has(explicitFrom))
      );
      const hasExplicitTo = Boolean(
        explicitTo &&
          metricMaps &&
          CHANNEL_METRICS.some((m) => metricMaps.get(m.key)?.has(explicitTo))
      );

      let prevDate: string | null = null;
      let latestDate: string | null = null;

      if (hasExplicitFrom && hasExplicitTo && explicitFrom !== explicitTo) {
        if (explicitFrom < explicitTo) {
          prevDate = explicitFrom;
          latestDate = explicitTo;
        } else {
          prevDate = explicitTo;
          latestDate = explicitFrom;
        }
      } else {
        prevDate = fallbackPrev;
        latestDate = fallbackLatest;
      }

      const deltas: Partial<Record<ChannelMetricKey, number | null>> = {};
      const prevValues: Partial<Record<ChannelMetricKey, number | null>> = {};
      const latestValues: Partial<Record<ChannelMetricKey, number | null>> = {};

      for (const m of CHANNEL_METRICS) {
        const series = metricMaps?.get(m.key);
        const cur = latestDate != null ? series?.get(latestDate) : undefined;
        const prev = prevDate != null ? series?.get(prevDate) : undefined;
        const curN = cur == null ? null : Number(cur);
        const prevN = prev == null ? null : Number(prev);
        prevValues[m.key] = prevN;
        latestValues[m.key] = curN;
        deltas[m.key] = curN == null || prevN == null ? null : curN - prevN;
      }

      return {
        id,
        label: shortLabel(labelById.get(id) || `Kênh #${id}`, 36),
        latestDate,
        prevDate,
        prevValues,
        latestValues,
        deltas,
        ready: Boolean(latestDate && prevDate),
        usedExplicit: hasExplicitFrom && hasExplicitTo && explicitFrom !== explicitTo,
      };
    });

    return {
      dates,
      byIdMetric,
      radarData,
      latestLabel: latest,
      dayOverDay,
    };
  }, [channelIds, rows, labelById, compareDateFrom, compareDateTo]);

  const lineSeriesByMetric = useMemo(() => {
    const out = new Map<ChannelMetricKey, Array<Record<string, string | number | null>>>();
    for (const m of CHANNEL_METRICS) {
      out.set(
        m.key,
        dates.map((date) => {
          const point: Record<string, string | number | null> = { date };
          for (const id of channelIds) {
            const v = byIdMetric.get(id)?.get(m.key)?.get(date);
            point[seriesKey(id)] = v == null ? null : v;
          }
          return point;
        })
      );
    }
    return out;
  }, [dates, channelIds, byIdMetric]);

  const latestTable = useMemo(() => {
    const latest = dates[dates.length - 1] || '';
    return CHANNEL_METRICS.map((m) => ({
      key: m.key,
      label: m.label,
      values: channelIds.map((id) => {
        const series = byIdMetric.get(id)?.get(m.key);
        if (!series || !latest) return null;
        if (series.has(latest)) return series.get(latest)!;
        for (let i = dates.length - 1; i >= 0; i--) {
          const v = series.get(dates[i]);
          if (v != null) return v;
        }
        return null;
      }),
    }));
  }, [dates, channelIds, byIdMetric]);

  const deltaBarData = useMemo(() => {
    return CHANNEL_METRICS.map((m) => {
      const point: Record<string, string | number | null> = { metric: m.label };
      for (const row of dayOverDay) {
        point[seriesKey(row.id)] = row.deltas[m.key] ?? null;
      }
      return point;
    });
  }, [dayOverDay]);

  const readyDodCount = dayOverDay.filter((r) => r.ready).length;

  if (dates.length === 0) return null;

  return (
    <div className={styles.charts}>
      <div className={styles.legendRow}>
        {channelIds.map((id, i) => (
          <span key={id} className={styles.legendItem}>
            <i style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} aria-hidden />
            {shortLabel(labelById.get(id) || `Kênh #${id}`)}
          </span>
        ))}
      </div>

      {!hideOverviewTab ? (
        <>
          <div className={styles.chartBlock}>
            <h4 className={styles.chartTitle}>
              Profile chỉ số (chuẩn hóa 0–100)
              {latestLabel ? <span className={styles.chartHint}> · mốc {latestLabel}</span> : null}
            </h4>
            <p className={styles.chartSub}>
              Mỗi trục = một chỉ số kênh, đã chuẩn hóa trong nhóm đang so sánh.
            </p>
            <div className={styles.radarWrap}>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                  />
                  {channelIds.map((id, i) => (
                    <Radar
                      key={id}
                      name={shortLabel(labelById.get(id) || `Kênh #${id}`, 20)}
                      dataKey={seriesKey(id)}
                      stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                      fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                      fillOpacity={0.12}
                      strokeWidth={2}
                    />
                  ))}
                  <Tooltip
                    formatter={(value, name, item) => {
                      const rawKey = `${String(item.dataKey ?? '')}_raw`;
                      const raw = (item.payload as Record<string, unknown> | undefined)?.[rawKey];
                      const norm = Number(value ?? 0);
                      return [`${fmt(Number(raw ?? norm))} (norm ${norm})`, String(name)];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={styles.chartBlock}>
            <h4 className={styles.chartTitle}>Diễn biến theo ngày</h4>
            <p className={styles.chartSub}>Mỗi biểu đồ một chỉ số — mỗi đường một kênh.</p>
            <div className={styles.lineGrid}>
              {CHANNEL_METRICS.map((m) => (
                <div key={m.key} className={styles.lineCard}>
                  <h5 className={styles.lineCardTitle}>{m.label}</h5>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart
                      data={lineSeriesByMetric.get(m.key) || []}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        tickFormatter={(d: string) => d.slice(5)}
                        minTickGap={24}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        width={48}
                        tickFormatter={(v: number) =>
                          v >= 1_000_000
                            ? `${(v / 1_000_000).toFixed(1)}M`
                            : v >= 1000
                              ? `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}k`
                              : String(v)
                        }
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          value == null || value === '' ? '—' : fmt(Number(value)),
                          String(name),
                        ]}
                        labelFormatter={(label) => `Ngày ${label}`}
                      />
                      {channelIds.map((id, i) => (
                        <Line
                          key={id}
                          type="monotone"
                          dataKey={seriesKey(id)}
                          name={shortLabel(labelById.get(id) || `Kênh #${id}`, 18)}
                          stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 2.5 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          </div>

          <details className={styles.detailsTable} open={false}>
            <summary>Bảng số liệu cuối kỳ{latestLabel ? ` (${latestLabel})` : ''}</summary>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Chỉ số</th>
                    {channelIds.map((id) => (
                      <th key={id}>{labelById.get(id) || `#${id}`}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {latestTable.map((row) => (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      {row.values.map((val, i) => (
                        <td key={channelIds[i]}>{val == null ? '—' : fmt(val)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <div className={styles.chartBlock}>
          <h4 className={styles.chartTitle}>
            {periodMode === 'month'
              ? 'Δ giữa 2 mốc tháng của cùng kênh'
              : periodMode === 'year'
                ? 'Δ giữa 2 mốc năm của cùng kênh'
                : 'Δ giữa 2 mốc ngày của cùng kênh'}
          </h4>
          <p className={styles.chartSub}>
            {periodMode === 'day' ? (
              <>
                Dùng <b>Ngày A</b> → <b>Ngày B</b> làm 2 mốc snapshot (nếu có dữ liệu). Thiếu mốc
                thì fallback 2 ngày snapshot gần nhất trong khoảng.
              </>
            ) : periodMode === 'month' ? (
              <>
                Dùng snapshot <b>cuối tháng A</b> → <b>cuối tháng B</b> làm 2 mốc. Thiếu mốc thì
                fallback 2 ngày snapshot gần nhất trong khoảng.
              </>
            ) : (
              <>
                Dùng snapshot <b>cuối năm A</b> → <b>cuối năm B</b> làm 2 mốc. Thiếu mốc thì
                fallback 2 ngày snapshot gần nhất trong khoảng.
              </>
            )}
            {readyDodCount < channelIds.length
              ? ` · ${readyDodCount}/${channelIds.length} kênh có đủ ≥ 2 mốc.`
              : null}
          </p>

          {readyDodCount === 0 ? (
            <p className={styles.muted}>
              Chưa đủ snapshot (cần ≥ 2 mốc/kênh). Mở thống kê kênh → Snapshot, hoặc đổi khoảng kỳ
              rồi chạy lại so sánh.
            </p>
          ) : (
            <>
              <div className={styles.dodMetaList}>
                {dayOverDay.map((row, i) => (
                  <div key={row.id} className={styles.dodMetaItem}>
                    <i style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} aria-hidden />
                    <span>
                      <strong>{row.label}</strong>
                      {row.ready ? (
                        <>
                          {' '}
                          · {row.prevDate} → {row.latestDate}
                        </>
                      ) : (
                        <span className={styles.chartHint}> · thiếu mốc trước</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <h5 className={styles.lineCardTitle}>Bảng so sánh snapshot kỳ A vs kỳ B</h5>
              {dayOverDay.map((row) => (
                <div key={row.id} className={styles.tableWrap} style={{ marginTop: 8, marginBottom: 12 }}>
                  {channelIds.length > 1 ? (
                    <p className={styles.chartSub} style={{ margin: '8px 12px 0' }}>
                      <strong>{row.label}</strong>
                      {row.ready ? ` · ${row.prevDate} → ${row.latestDate}` : null}
                    </p>
                  ) : null}
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Chỉ số</th>
                        <th>Kỳ A{row.prevDate ? ` (${row.prevDate})` : ''}</th>
                        <th>Kỳ B{row.latestDate ? ` (${row.latestDate})` : ''}</th>
                        <th>Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CHANNEL_METRICS.map((m) => {
                        const a = row.prevValues[m.key];
                        const b = row.latestValues[m.key];
                        const d = row.deltas[m.key];
                        const cls =
                          d == null
                            ? undefined
                            : d > 0
                              ? styles.deltaUp
                              : d < 0
                                ? styles.deltaDown
                                : undefined;
                        return (
                          <tr key={m.key}>
                            <td className={styles.dodPostCell}>{m.label}</td>
                            <td>{a == null ? '—' : fmt(a)}</td>
                            <td>{b == null ? '—' : fmt(b)}</td>
                            <td className={cls}>{fmtDelta(d ?? null)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}

              <h5 className={styles.lineCardTitle}>Biểu đồ Δ theo chỉ số</h5>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={deltaBarData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                  <XAxis dataKey="metric" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    width={52}
                    tickFormatter={(v: number) =>
                      Math.abs(v) >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(1)}M`
                        : Math.abs(v) >= 1000
                          ? `${(v / 1000).toFixed(1)}k`
                          : String(v)
                    }
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      value == null || value === '' ? '—' : fmtDelta(Number(value)),
                      String(name),
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {dayOverDay.map((row, i) => (
                    <Bar
                      key={row.id}
                      dataKey={seriesKey(row.id)}
                      name={shortLabel(row.label, 18)}
                      fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={36}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      )}
    </div>
  );
}
