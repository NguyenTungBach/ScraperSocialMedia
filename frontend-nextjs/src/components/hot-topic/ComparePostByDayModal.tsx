'use client';

import { useCallback, useMemo, useState } from 'react';
import { CalendarRange, Loader2, RefreshCw, X } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api/client';
import { snapshotsApi, type PostDailySnapshotRow } from '@/lib/api/snapshots';
import type { SubjectRelatedPost } from '@/lib/api/subjects';
import { getCurrentMonthDateRange } from '@/lib/utils/dateRange';
import { MakeToast } from '@/lib/utils/toast';
import { PlatformBadge } from './PlatformBadge';
import { ComparePostCharts } from './ComparePostCharts';
import dash from './HotTopicDashboard.module.scss';
import styles from './CompareModal.module.scss';

function defaultRange() {
  const month = getCurrentMonthDateRange();
  const to = new Date().toISOString().slice(0, 10);
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 7);
  const from = fromDate.toISOString().slice(0, 10);
  return {
    date_from: from < month.date_from ? month.date_from : from,
    date_to: to,
  };
}

function truncate(text: string, max = 72) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

interface ComparePostByDayModalProps {
  post: SubjectRelatedPost;
  onClose: () => void;
}

export function ComparePostByDayModal({ post, onClose }: ComparePostByDayModalProps) {
  const initial = defaultRange();
  const [dateFrom, setDateFrom] = useState(initial.date_from);
  const [dateTo, setDateTo] = useState(initial.date_to);
  const [loading, setLoading] = useState(false);
  const [hasCompared, setHasCompared] = useState(false);
  const [rows, setRows] = useState<PostDailySnapshotRow[]>([]);

  const title = truncate(post.title?.trim() || post.text?.trim() || post.post_url || `Bài #${post.id}`);

  const labelById = useMemo(() => {
    const map = new Map<number, string>();
    map.set(post.id, title);
    return map;
  }, [post.id, title]);

  const runCompare = useCallback(async () => {
    if (dateFrom === dateTo) {
      MakeToast({
        variant: 'warning',
        content: 'Chọn 2 ngày khác nhau (Ngày A ≠ Ngày B)',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await snapshotsApi.comparePosts({
        scraper_run_ids: [post.id],
        date_from: dateFrom,
        date_to: dateTo,
      });
      setRows(res.data?.result || []);
      setHasCompared(true);
      if (!(res.data?.result || []).length) {
        MakeToast({
          variant: 'warning',
          content: 'Không có snapshot trong khoảng ngày. Mở Thống kê → Snapshot rồi thử lại.',
        });
      }
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [post.id, dateFrom, dateTo]);

  const resetFilters = useCallback(() => {
    const range = defaultRange();
    setDateFrom(range.date_from);
    setDateTo(range.date_to);
    setRows([]);
    setHasCompared(false);
  }, []);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
    >
      <div className={`${styles.modal} ${styles.dayModal}`} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>
              <CalendarRange size={18} aria-hidden /> So sánh theo ngày
            </h2>
            <p className={styles.sub}>
              Cùng một bài — so snapshot Ngày A vs Ngày B (Δ chỉ số)
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </header>

        <div className={styles.dayPostBanner}>
          {post.platform ? <PlatformBadge platform={post.platform} size="sm" /> : null}
          <span className={styles.dayPostTitle}>{title}</span>
        </div>

        <div className={styles.filters}>
          <label>
            Ngày A (cũ)
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label>
            Ngày B (mới)
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <button
            type="button"
            className={styles.dayCompareBtn}
            onClick={() => void runCompare()}
            disabled={loading || dateFrom === dateTo}
          >
            {loading ? <Loader2 size={16} className={dash.spin} /> : <CalendarRange size={16} />}
            Chạy so sánh
          </button>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={resetFilters}
            title="Trả Ngày A/B về mặc định và xóa kết quả"
          >
            <RefreshCw size={16} />
            Refresh bộ lọc
          </button>
        </div>

        <div className={styles.dayBody}>
          {!hasCompared ? (
            <p className={styles.muted}>
              Chọn Ngày A / Ngày B khác nhau rồi bấm «Chạy so sánh».
            </p>
          ) : rows.length === 0 ? (
            <p className={styles.muted}>
              Không có snapshot. Mở Thống kê bài → Snapshot cho cả hai ngày, rồi chạy lại so sánh.
            </p>
          ) : (
            <ComparePostCharts
              postIds={[post.id]}
              rows={rows}
              labelById={labelById}
              compareDateFrom={dateFrom}
              compareDateTo={dateTo}
              hideOverviewTab
            />
          )}
        </div>
      </div>
    </div>
  );
}
