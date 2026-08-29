'use client';

import { useMemo } from 'react';
import {
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
  { key: 'post_count_tracked', label: 'Posts tracked' },
] as const;

export type ChannelMetricKey = (typeof CHANNEL_METRICS)[number]['key'];

function fmt(n: number) {
  return Number.isFinite(n) ? n.toLocaleString('vi-VN') : '0';
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
}

export function CompareChannelCharts({ channelIds, rows, labelById }: CompareChannelChartsProps) {
  const { dates, byIdMetric, radarData, latestLabel } = useMemo(() => {
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

    return { dates, byIdMetric, radarData, latestLabel: latest };
  }, [channelIds, rows]);

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
    </div>
  );
}
