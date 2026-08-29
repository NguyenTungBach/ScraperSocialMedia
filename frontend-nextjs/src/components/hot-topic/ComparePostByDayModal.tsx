'use client';

import { useCallback, useMemo, useState } from 'react';
import { CalendarRange, Loader2, RefreshCw, X } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api/client';
import { snapshotsApi, type PostDailySnapshotRow } from '@/lib/api/snapshots';
import type { SubjectRelatedPost } from '@/lib/api/subjects';
import { formatDateInput, getCurrentMonthDateRange } from '@/lib/utils/dateRange';
import { MakeToast } from '@/lib/utils/toast';
import { PlatformBadge } from './PlatformBadge';
import { ComparePostCharts } from './ComparePostCharts';
import dash from './HotTopicDashboard.module.scss';
import styles from './CompareModal.module.scss';

export type ComparePeriodMode = 'day' | 'month' | 'year';

function padMonth(y: number, m: number) {
  return `${y}-${String(m).padStart(2, '0')}`;
}

function defaultDayRange() {
  const month = getCurrentMonthDateRange();
  const to = formatDateInput(new Date());
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 7);
  const from = formatDateInput(fromDate);
  return {
    date_from: from < month.date_from ? month.date_from : from,
    date_to: to,
  };
}

function defaultMonthRange() {
  const now = new Date();
  const cur = padMonth(now.getFullYear(), now.getMonth() + 1);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {
    month_from: padMonth(prev.getFullYear(), prev.getMonth() + 1),
    month_to: cur,
  };
}

function defaultYearRange() {
  const y = new Date().getFullYear();
  return { year_from: String(y - 1), year_to: String(y) };
}

/** Khoảng ngày API + biên kỳ A/B để chọn snapshot cuối mỗi kỳ. */
function resolvePeriodBounds(
  mode: ComparePeriodMode,
  dayFrom: string,
  dayTo: string,
  monthFrom: string,
  monthTo: string,
  yearFrom: string,
  yearTo: string
): {
  date_from: string;
  date_to: string;
  periodAStart: string;
  periodAEnd: string;
  periodBStart: string;
  periodBEnd: string;
  labelA: string;
  labelB: string;
} | null {
  if (mode === 'day') {
    if (!dayFrom || !dayTo || dayFrom === dayTo) return null;
    const aFirst = dayFrom < dayTo;
    return {
      date_from: aFirst ? dayFrom : dayTo,
      date_to: aFirst ? dayTo : dayFrom,
      periodAStart: dayFrom,
      periodAEnd: dayFrom,
      periodBStart: dayTo,
      periodBEnd: dayTo,
      labelA: dayFrom,
      labelB: dayTo,
    };
  }

  if (mode === 'month') {
    if (!monthFrom || !monthTo || monthFrom === monthTo) return null;
    const [y1, m1] = monthFrom.split('-').map(Number);
    const [y2, m2] = monthTo.split('-').map(Number);
    if (!y1 || !m1 || !y2 || !m2) return null;
    const aStart = `${monthFrom}-01`;
    const aEnd = formatDateInput(new Date(y1, m1, 0));
    const bStart = `${monthTo}-01`;
    const bEnd = formatDateInput(new Date(y2, m2, 0));
    const earlier = aStart < bStart;
    return {
      date_from: earlier ? aStart : bStart,
      date_to: earlier ? bEnd : aEnd,
      periodAStart: aStart,
      periodAEnd: aEnd,
      periodBStart: bStart,
      periodBEnd: bEnd,
      labelA: monthFrom,
      labelB: monthTo,
    };
  }

  const yA = Number(yearFrom);
  const yB = Number(yearTo);
  if (!Number.isInteger(yA) || !Number.isInteger(yB) || yA === yB) return null;
  const aStart = `${yA}-01-01`;
  const aEnd = `${yA}-12-31`;
  const bStart = `${yB}-01-01`;
  const bEnd = `${yB}-12-31`;
  const earlier = aStart < bStart;
  return {
    date_from: earlier ? aStart : bStart,
    date_to: earlier ? bEnd : aEnd,
    periodAStart: aStart,
    periodAEnd: aEnd,
    periodBStart: bStart,
    periodBEnd: bEnd,
    labelA: String(yA),
    labelB: String(yB),
  };
}

/** Snapshot cuối cùng trong [start, end] của bài. */
function lastSnapshotInRange(
  rows: PostDailySnapshotRow[],
  postId: number,
  start: string,
  end: string
): string | null {
  const dates = rows
    .filter((r) => Number(r.scraper_run_id) === postId)
    .map((r) => String(r.snapshot_date).slice(0, 10))
    .filter((d) => d >= start && d <= end)
    .sort();
  return dates.length ? dates[dates.length - 1]! : null;
}

function truncate(text: string, max = 72) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

const MODE_LABEL: Record<ComparePeriodMode, string> = {
  day: 'ngày',
  month: 'tháng',
  year: 'năm',
};

interface ComparePostByDayModalProps {
  post: SubjectRelatedPost;
  onClose: () => void;
}

export function ComparePostByDayModal({ post, onClose }: ComparePostByDayModalProps) {
  const dayInit = defaultDayRange();
  const monthInit = defaultMonthRange();
  const yearInit = defaultYearRange();

  const [mode, setMode] = useState<ComparePeriodMode>('day');
  const [dateFrom, setDateFrom] = useState(dayInit.date_from);
  const [dateTo, setDateTo] = useState(dayInit.date_to);
  const [monthFrom, setMonthFrom] = useState(monthInit.month_from);
  const [monthTo, setMonthTo] = useState(monthInit.month_to);
  const [yearFrom, setYearFrom] = useState(yearInit.year_from);
  const [yearTo, setYearTo] = useState(yearInit.year_to);

  const [loading, setLoading] = useState(false);
  const [hasCompared, setHasCompared] = useState(false);
  const [rows, setRows] = useState<PostDailySnapshotRow[]>([]);
  const [compareFrom, setCompareFrom] = useState<string>('');
  const [compareTo, setCompareTo] = useState<string>('');

  const title = truncate(post.title?.trim() || post.text?.trim() || post.post_url || `Bài #${post.id}`);

  const labelById = useMemo(() => {
    const map = new Map<number, string>();
    map.set(post.id, title);
    return map;
  }, [post.id, title]);

  const yearOptions = useMemo(() => {
    const cur = new Date().getFullYear();
    const years: number[] = [];
    for (let y = cur; y >= cur - 10; y -= 1) years.push(y);
    return years;
  }, []);

  const samePeriod =
    mode === 'day'
      ? dateFrom === dateTo
      : mode === 'month'
        ? monthFrom === monthTo
        : yearFrom === yearTo;

  const runCompare = useCallback(async () => {
    const bounds = resolvePeriodBounds(mode, dateFrom, dateTo, monthFrom, monthTo, yearFrom, yearTo);
    if (!bounds) {
      MakeToast({
        variant: 'warning',
        content: `Chọn 2 ${MODE_LABEL[mode]} khác nhau (A ≠ B)`,
      });
      return;
    }

    setLoading(true);
    try {
      const res = await snapshotsApi.comparePosts({
        scraper_run_ids: [post.id],
        date_from: bounds.date_from,
        date_to: bounds.date_to,
      });
      const result = res.data?.result || [];
      setRows(result);

      const snapA = lastSnapshotInRange(result, post.id, bounds.periodAStart, bounds.periodAEnd);
      const snapB = lastSnapshotInRange(result, post.id, bounds.periodBStart, bounds.periodBEnd);

      if (mode === 'day') {
        setCompareFrom(bounds.periodAStart);
        setCompareTo(bounds.periodBStart);
      } else {
        setCompareFrom(snapA || '');
        setCompareTo(snapB || '');
      }

      setHasCompared(true);

      if (!result.length) {
        MakeToast({
          variant: 'warning',
          content: 'Không có snapshot trong khoảng đã chọn. Mở Thống kê → Snapshot rồi thử lại.',
        });
      } else if (mode !== 'day' && (!snapA || !snapB)) {
        MakeToast({
          variant: 'warning',
          content: `Thiếu snapshot ở ${!snapA ? `kỳ A (${bounds.labelA})` : `kỳ B (${bounds.labelB})`}.`,
        });
      }
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [post.id, mode, dateFrom, dateTo, monthFrom, monthTo, yearFrom, yearTo]);

  const resetFilters = useCallback(() => {
    const day = defaultDayRange();
    const month = defaultMonthRange();
    const year = defaultYearRange();
    setMode('day');
    setDateFrom(day.date_from);
    setDateTo(day.date_to);
    setMonthFrom(month.month_from);
    setMonthTo(month.month_to);
    setYearFrom(year.year_from);
    setYearTo(year.year_to);
    setRows([]);
    setCompareFrom('');
    setCompareTo('');
    setHasCompared(false);
  }, []);

  const periodHint =
    mode === 'day'
      ? 'Chọn Ngày A / Ngày B khác nhau rồi bấm «Chạy so sánh».'
      : mode === 'month'
        ? 'Chọn Tháng A / Tháng B khác nhau — dùng snapshot cuối mỗi tháng làm mốc Δ.'
        : 'Chọn Năm A / Năm B khác nhau — dùng snapshot cuối mỗi năm làm mốc Δ.';

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
              <CalendarRange size={18} aria-hidden /> So sánh theo kỳ
            </h2>
            <p className={styles.sub}>
              Cùng một bài — so snapshot kỳ A vs kỳ B (Δ chỉ số) theo ngày / tháng / năm
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

        <div className={styles.periodTabs} role="tablist" aria-label="Kiểu kỳ so sánh">
          {(
            [
              { id: 'day', label: 'Ngày' },
              { id: 'month', label: 'Tháng' },
              { id: 'year', label: 'Năm' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mode === tab.id}
              className={mode === tab.id ? styles.periodTabActive : styles.periodTab}
              onClick={() => {
                setMode(tab.id);
                setHasCompared(false);
                setRows([]);
                setCompareFrom('');
                setCompareTo('');
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.filters}>
          {mode === 'day' ? (
            <>
              <label>
                Ngày A (cũ)
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </label>
              <label>
                Ngày B (mới)
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </label>
            </>
          ) : null}

          {mode === 'month' ? (
            <>
              <label>
                Tháng A (cũ)
                <input
                  type="month"
                  value={monthFrom}
                  onChange={(e) => setMonthFrom(e.target.value)}
                />
              </label>
              <label>
                Tháng B (mới)
                <input type="month" value={monthTo} onChange={(e) => setMonthTo(e.target.value)} />
              </label>
            </>
          ) : null}

          {mode === 'year' ? (
            <>
              <label>
                Năm A (cũ)
                <select value={yearFrom} onChange={(e) => setYearFrom(e.target.value)}>
                  {yearOptions.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Năm B (mới)
                <select value={yearTo} onChange={(e) => setYearTo(e.target.value)}>
                  {yearOptions.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <button
            type="button"
            className={styles.dayCompareBtn}
            onClick={() => void runCompare()}
            disabled={loading || samePeriod}
          >
            {loading ? <Loader2 size={16} className={dash.spin} /> : <CalendarRange size={16} />}
            Chạy so sánh
          </button>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={resetFilters}
            title="Trả bộ lọc về mặc định và xóa kết quả"
          >
            <RefreshCw size={16} />
            Refresh bộ lọc
          </button>
        </div>

        <div className={styles.dayBody}>
          {!hasCompared ? (
            <p className={styles.muted}>{periodHint}</p>
          ) : rows.length === 0 ? (
            <p className={styles.muted}>
              Không có snapshot. Mở thống kê bài → Snapshot cho cả hai kỳ, rồi chạy lại so sánh.
            </p>
          ) : (
            <ComparePostCharts
              postIds={[post.id]}
              rows={rows}
              labelById={labelById}
              compareDateFrom={compareFrom || undefined}
              compareDateTo={compareTo || undefined}
              hideOverviewTab
              periodMode={mode}
            />
          )}
        </div>
      </div>
    </div>
  );
}
