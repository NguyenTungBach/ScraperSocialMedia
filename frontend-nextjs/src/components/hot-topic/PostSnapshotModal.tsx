'use client';

import { useCallback, useEffect, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api/client';
import {
  snapshotsApi,
  type PostDailySnapshotRow,
} from '@/lib/api/snapshots';
import type { SubjectRelatedPost } from '@/lib/api/subjects';
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

function truncate(text: string, max = 80) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

interface PostSnapshotModalProps {
  post: SubjectRelatedPost;
  onClose: () => void;
}

export function PostSnapshotModal({ post, onClose }: PostSnapshotModalProps) {
  const title = post.title?.trim() || post.text?.trim() || post.post_url || `Bài #${post.id}`;
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);
  const [snapshot, setSnapshot] = useState<PostDailySnapshotRow | null>(null);
  const [delta, setDelta] = useState<Record<string, number> | null>(null);
  const [previousDate, setPreviousDate] = useState<string | null>(null);
  const [topComments, setTopComments] = useState<
    Array<{
      rank: number;
      author?: string | null;
      text?: string | null;
      like_count: number;
    }>
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detailRes, topRes] = await Promise.all([
        snapshotsApi.postDetail(post.id, { date }),
        snapshotsApi.postTopComments(post.id, { date }),
      ]);
      setSnapshot(detailRes.data?.snapshot ?? null);
      setDelta(detailRes.data?.delta ?? null);
      setPreviousDate(detailRes.data?.previous_date ?? null);
      setTopComments(topRes.data?.result ?? []);
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [post.id, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSnapshot = async () => {
    setSnapshotting(true);
    try {
      let res = await snapshotsApi.run({ force: false, scraper_run_id: post.id });
      if (res.data?.needs_confirm) {
        const ok = window.confirm(
          res.data.message || 'Bài này đã có snapshot hôm nay. Bạn có muốn ghi đè?'
        );
        if (!ok) return;
        res = await snapshotsApi.run({ force: true, scraper_run_id: post.id });
      }
      if (res.data?.ok === false) {
        MakeToast({
          variant: 'warning',
          content: res.data.message || 'Snapshot không thành công',
        });
        return;
      }
      MakeToast({
        variant: 'success',
        content: `Đã snapshot bài (kèm kênh): ${res.data?.posts ?? 0} bài`,
      });
      const today = new Date().toISOString().slice(0, 10);
      if (date !== today) setDate(today);
      else await load();
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    } finally {
      setSnapshotting(false);
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
      <div className={styles.modal}>
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>Thống kê bài — {truncate(title, 60)}</h2>
            <p className={styles.sub}>Snapshot theo ngày (metrics đã đóng băng)</p>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.snapshotBtn}
              onClick={() => void handleSnapshot()}
              disabled={snapshotting}
              title="Chụp metrics bài này (và refresh kênh chứa bài)"
            >
              {snapshotting ? (
                <Loader2 size={15} className={dash.spin} aria-hidden />
              ) : (
                <Camera size={15} aria-hidden />
              )}
              Snapshot
            </button>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Đóng">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className={styles.filters}>
          <label>
            Ngày
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>

        {loading ? (
          <div className={dash.emptyState}>
            <Loader2 size={20} className={dash.spin} aria-hidden /> Đang tải…
          </div>
        ) : !snapshot ? (
          <div className={dash.emptyState}>
            Chưa có snapshot ngày {date}. Bấm Snapshot để chụp bài này.
          </div>
        ) : (
          <>
            <section className={styles.metrics}>
              <div className={styles.metricCard}>
                <span>Views</span>
                <strong>{fmt(snapshot.views)}</strong>
                <em>{deltaLabel(delta?.views)} vs {previousDate || 'hôm trước'}</em>
              </div>
              <div className={styles.metricCard}>
                <span>Likes</span>
                <strong>{fmt(snapshot.likes)}</strong>
                <em>{deltaLabel(delta?.likes)}</em>
              </div>
              <div className={styles.metricCard}>
                <span>Comments</span>
                <strong>{fmt(snapshot.comments)}</strong>
                <em>{deltaLabel(delta?.comments)}</em>
              </div>
              <div className={styles.metricCard}>
                <span>Shares</span>
                <strong>{fmt(snapshot.shares)}</strong>
                <em>{deltaLabel(delta?.shares)}</em>
              </div>
              <div className={styles.metricCard}>
                <span>Hot</span>
                <strong>{fmt(snapshot.hot_score)}</strong>
                <em>{deltaLabel(delta?.hot_score)}</em>
              </div>
              <div className={styles.metricCard}>
                <span>Trend</span>
                <strong>{fmt(snapshot.trend_score)}</strong>
                <em>{deltaLabel(delta?.trend_score)}</em>
              </div>
            </section>

            <section className={styles.topSection}>
              <h3>Top comment (like)</h3>
              {topComments.length === 0 ? (
                <p className={styles.muted}>Chưa có top comment cho ngày này.</p>
              ) : (
                <div className={styles.topTable}>
                  <div className={styles.topHead} style={{ gridTemplateColumns: '36px minmax(0, 1fr) 72px' }}>
                    <span>#</span>
                    <span>Comment</span>
                    <span>Likes</span>
                  </div>
                  {topComments.map((row) => (
                    <div
                      key={row.rank}
                      className={styles.topRow}
                      style={{ gridTemplateColumns: '36px minmax(0, 1fr) 72px' }}
                    >
                      <span>{row.rank}</span>
                      <span className={styles.postTitle}>
                        <b>{row.author || 'Ẩn danh'}:</b> {truncate(row.text || '', 100)}
                      </span>
                      <span>{fmt(row.like_count)}</span>
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
