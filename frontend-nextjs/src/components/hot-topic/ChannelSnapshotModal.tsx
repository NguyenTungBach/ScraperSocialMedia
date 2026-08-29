'use client';

import { useCallback, useEffect, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api/client';
import {
  snapshotsApi,
  type ChannelDailySnapshotRow,
  type ChannelTopPostRow,
} from '@/lib/api/snapshots';
import type { ChannelItem } from '@/lib/api/channels';
import { formatDateInput } from '@/lib/utils/dateRange';
import { MakeToast } from '@/lib/utils/toast';
import dash from './HotTopicDashboard.module.scss';
import styles from './ChannelSnapshotModal.module.scss';

function fmt(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v.toLocaleString('vi-VN') : '0';
}

function deltaLabel(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('vi-VN')}`;
}

function todayLocal() {
  return formatDateInput(new Date());
}

interface ChannelSnapshotModalProps {
  channel: ChannelItem;
  onClose: () => void;
}

export function ChannelSnapshotModal({ channel, onClose }: ChannelSnapshotModalProps) {
  const [date, setDate] = useState(todayLocal);
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);
  const [snapshot, setSnapshot] = useState<ChannelDailySnapshotRow | null>(null);
  const [delta, setDelta] = useState<Record<string, number> | null>(null);
  const [previousDate, setPreviousDate] = useState<string | null>(null);
  const [topPosts, setTopPosts] = useState<ChannelTopPostRow[]>([]);
  const [sort, setSort] = useState<'hot_score' | 'trend_score'>('hot_score');
  const isToday = date === todayLocal();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detailRes, topRes] = await Promise.all([
        snapshotsApi.channelDetail(channel.id, { date }),
        snapshotsApi.channelTopPosts(channel.id, { date, sort, limit: 10 }),
      ]);
      setSnapshot(detailRes.data?.snapshot ?? null);
      setDelta(detailRes.data?.delta ?? null);
      setPreviousDate(detailRes.data?.previous_date ?? null);
      setTopPosts(topRes.data?.result ?? []);
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [channel.id, date, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSnapshot = async () => {
    if (!isToday) {
      MakeToast({
        variant: 'warning',
        content: 'Chỉ được snapshot ngày hôm nay.',
      });
      return;
    }
    setSnapshotting(true);
    try {
      let res = await snapshotsApi.run({ force: false, channel_id: channel.id });
      if (res.data?.needs_confirm) {
        const ok = window.confirm(
          res.data.message || 'Kênh này đã có snapshot hôm nay. Bạn có muốn ghi đè?'
        );
        if (!ok) return;
        res = await snapshotsApi.run({ force: true, channel_id: channel.id });
      }
      if (res.data?.ok === false) {
        MakeToast({
          variant: 'warning',
          content: res.data.message || 'Snapshot không thành công',
        });
        return;
      }
      const d = res.data;
      MakeToast({
        variant: 'success',
        content: `Đã snapshot kênh: ${d?.posts ?? 0} bài · ${d?.top_comments ?? 0} top comment`,
      });
      await load();
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    } finally {
      setSnapshotting(false);
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>Thống kê kênh — {channel.name}</h2>
            <p className={styles.sub}>Snapshot theo ngày (metrics đã đóng băng)</p>
          </div>
          <div className={styles.headerActions}>
            {isToday ? (
              <button
                type="button"
                className={styles.snapshotBtn}
                onClick={() => void handleSnapshot()}
                disabled={snapshotting}
                title="Chụp metrics kênh này (chỉ ngày hôm nay)"
              >
                {snapshotting ? (
                  <Loader2 size={15} className={dash.spin} aria-hidden />
                ) : (
                  <Camera size={15} aria-hidden />
                )}
                Snapshot
              </button>
            ) : null}
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Đóng">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className={styles.filters}>
          <label>
            Ngày
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Top bài theo
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'hot_score' | 'trend_score')}
            >
              <option value="hot_score">Hot score</option>
              <option value="trend_score">Trend score</option>
            </select>
          </label>
        </div>

        {loading ? (
          <div className={dash.emptyState}>
            <Loader2 size={20} className={dash.spin} aria-hidden /> Đang tải…
          </div>
        ) : !snapshot ? (
          <div className={dash.emptyState}>
            {isToday
              ? `Chưa có snapshot ngày ${date}. Bấm Snapshot ở góc phải để chụp kênh này.`
              : `Chưa có snapshot ngày ${date}. Chỉ được chụp snapshot ngày hôm nay.`}
          </div>
        ) : (
          <>
            <section className={styles.metrics}>
              <div className={styles.metricCard}>
                <span>Followers</span>
                <strong>{fmt(snapshot.followers)}</strong>
                <em>{deltaLabel(delta?.followers)} vs {previousDate || 'hôm trước'}</em>
              </div>
              <div className={styles.metricCard}>
                <span>Views (tracked)</span>
                <strong>{fmt(snapshot.views_sum)}</strong>
                <em>{deltaLabel(delta?.views_sum)}</em>
              </div>
              <div className={styles.metricCard}>
                <span>Likes</span>
                <strong>{fmt(snapshot.likes_sum)}</strong>
                <em>{deltaLabel(delta?.likes_sum)}</em>
              </div>
              <div className={styles.metricCard}>
                <span>Comments</span>
                <strong>{fmt(snapshot.comments_sum)}</strong>
                <em>{deltaLabel(delta?.comments_sum)}</em>
              </div>
              <div className={styles.metricCard}>
                <span>Bài tracked</span>
                <strong>{fmt(snapshot.post_count_tracked)}</strong>
                <em>{deltaLabel(delta?.post_count_tracked)}</em>
              </div>
            </section>

            <section className={styles.topSection}>
              <h3>Top 10 bài ({sort})</h3>
              {topPosts.length === 0 ? (
                <p className={styles.muted}>Không có bài trong snapshot ngày này.</p>
              ) : (
                <div className={styles.topTable}>
                  <div className={styles.topHead}>
                    <span>#</span>
                    <span>Bài</span>
                    <span>Views</span>
                    <span>Likes</span>
                    <span>Cmt</span>
                    <span>Score</span>
                  </div>
                  {topPosts.map((row, idx) => (
                    <div key={row.id} className={styles.topRow}>
                      <span>{idx + 1}</span>
                      <span className={styles.postTitle}>
                        {row.scraperRun?.title ||
                          row.scraperRun?.post_url ||
                          `#${row.scraper_run_id}`}
                      </span>
                      <span>{fmt(row.views)}</span>
                      <span>{fmt(row.likes)}</span>
                      <span>{fmt(row.comments)}</span>
                      <span>
                        {fmt(sort === 'trend_score' ? row.trend_score : row.hot_score)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
