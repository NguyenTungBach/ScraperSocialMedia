'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Sparkles, X } from 'lucide-react';
import { commentsApi, type ScraperRunComments } from '@/lib/api/comments';
import { getApiErrorMessage } from '@/lib/api/client';
import {
  buildAnalysisRows,
  classifyLabel,
  countAnalysisByType,
  filterAnalysisRows,
  hasAnalysisData,
  toneClassName,
  type AnalysisFilter,
  type CommentAnalysisRow,
} from '@/lib/utils/commentAnalysis';
import { cn } from '@/lib/utils';
import styles from './CommentAnalysisModal.module.scss';

interface CommentAnalysisModalProps {
  open: boolean;
  onClose: () => void;
  scraperRunId: number;
  videoTitle?: string;
  contentBrief?: string | null;
  contentBriefStatus?: 'not_start' | 'pending' | 'done' | 'skipped';
  /** Dữ liệu đã tải từ GET /comments (DB). */
  initialData?: ScraperRunComments | null;
}

function truncate(text: string, max = 120): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function AnalysisRowDetails({ row }: { row: CommentAnalysisRow }) {
  const [open, setOpen] = useState(false);

  if (row.groupType !== 'thread' || row.replyCount === 0) {
    return row.reason ? <p className={styles.rowReason}>{row.reason}</p> : null;
  }

  return (
    <div className={styles.threadDetails}>
      <button
        type="button"
        className={styles.threadToggle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
        {row.replyCount} phản hồi trong chuỗi
      </button>
      {open ? (
        <div className={styles.threadReplies}>
          {row.replies.map((reply) => (
            <p key={reply.id} className={styles.threadReply}>
              <b>{reply.author || 'Ẩn danh'}:</b> {reply.text}
            </p>
          ))}
        </div>
      ) : null}
      {row.reason ? <p className={styles.rowReason}>{row.reason}</p> : null}
    </div>
  );
}

const FILTER_OPTIONS: { id: AnalysisFilter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'negative', label: 'Tiêu cực' },
  { id: 'debate', label: 'Tranh luận' },
  { id: 'normal', label: 'Bình thường' },
];

export function CommentAnalysisModal({
  open,
  onClose,
  scraperRunId,
  videoTitle,
  contentBrief,
  contentBriefStatus,
  initialData = null,
}: CommentAnalysisModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ScraperRunComments | null>(initialData);
  const [filter, setFilter] = useState<AnalysisFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await commentsApi.getByScraperRun(scraperRunId);
      setData(res.data || { lone: [], threads: [] });
    } catch (err) {
      setError(getApiErrorMessage(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [scraperRunId]);

  useEffect(() => {
    if (!open) {
      setError(null);
      setFilter('all');
      return;
    }
    if (initialData) {
      setData(initialData);
      return;
    }
    void load();
  }, [open, load, initialData]);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
    }
  }, [initialData]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const allRows = useMemo(() => (data ? buildAnalysisRows(data) : []), [data]);
  const rows = useMemo(() => filterAnalysisRows(allRows, filter), [allRows, filter]);
  const stats = useMemo(() => countAnalysisByType(allRows), [allRows]);
  const analyzed = data
    ? Boolean(data.meta?.analyzed) || hasAnalysisData(data)
    : false;

  if (!open) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>
              <Sparkles size={14} aria-hidden /> Phân tích comment AI
            </p>
            <h2 className={styles.title}>{truncate(videoTitle || 'Video YouTube', 100)}</h2>
            <p className={styles.subtitle}>
              Scraper run #{scraperRunId}
              {data?.meta
                ? ` · ${data.meta.analyzed_lone_count} lone + ${data.meta.analyzed_thread_count} thread từ DB`
                : ''}
            </p>
            {contentBrief && contentBriefStatus === 'done' ? (
              <div className={styles.contentBriefBox}>
                <span className={styles.contentBriefLabel}>Tóm tắt nội dung (AI)</span>
                <p className={styles.contentBriefText}>{contentBrief}</p>
              </div>
            ) : null}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </header>

        {(loading && !data) ? (
          <div className={styles.loading}>
            <Loader2 size={20} className={styles.spin} aria-hidden /> Đang tải phân tích…
          </div>
        ) : null}

        {error ? (
          <div className={styles.error} role="alert">
            {error}
            <button type="button" onClick={() => void load()}>
              Thử lại
            </button>
          </div>
        ) : null}

        {(!loading || data) && !error && data ? (
          <>
            {!analyzed ? (
              <p className={styles.empty}>
                Video này chưa có phân tích AI. Chạy <strong>Check alert</strong> để Gemini phân
                tích comment.
              </p>
            ) : (
              <>
                <div className={styles.stats}>
                  <span>{stats.total} mục đã phân tích</span>
                  {stats.negative > 0 ? <span className={styles.statNegative}>{stats.negative} tiêu cực</span> : null}
                  {stats.debate > 0 ? <span className={styles.statDebate}>{stats.debate} tranh luận</span> : null}
                  {stats.normal > 0 ? <span>{stats.normal} bình thường</span> : null}
                </div>

                <div className={styles.filters} role="tablist" aria-label="Lọc phân loại">
                  {FILTER_OPTIONS.map((opt) => {
                    const count =
                      opt.id === 'all'
                        ? stats.total
                        : stats[opt.id as keyof typeof stats] ?? 0;
                    if (opt.id !== 'all' && count === 0) return null;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="tab"
                        aria-selected={filter === opt.id}
                        className={filter === opt.id ? styles.filterActive : styles.filterBtn}
                        onClick={() => setFilter(opt.id)}
                      >
                        {opt.label}
                        <em>{count}</em>
                      </button>
                    );
                  })}
                </div>

                {rows.length === 0 ? (
                  <p className={styles.empty}>Không có mục nào khớp bộ lọc.</p>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Nhóm</th>
                          <th>Phân loại</th>
                          <th>Tác giả</th>
                          <th>Nội dung</th>
                          <th>Cảm xúc</th>
                          <th>Loại</th>
                          <th>Mức độ</th>
                          <th>Chi tiết</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, index) => (
                          <tr key={row.key}>
                            <td>{index + 1}</td>
                            <td>{classifyLabel(row.groupType)}</td>
                            <td>
                              <span
                                className={cn(
                                  styles.badge,
                                  styles[toneClassName(row.classifiedAs) as keyof typeof styles]
                                )}
                              >
                                {classifyLabel(row.classifiedAs)}
                              </span>
                              {row.hasNegativity ? (
                                <span className={styles.tag}>Có tiêu cực</span>
                              ) : null}
                            </td>
                            <td>{row.author}</td>
                            <td className={styles.textCell} title={row.text}>
                              {truncate(row.text, 160)}
                            </td>
                            <td>{classifyLabel(row.sentiment)}</td>
                            <td>{classifyLabel(row.category)}</td>
                            <td>{classifyLabel(row.severity)}</td>
                            <td className={styles.detailCell}>
                              <AnalysisRowDetails row={row} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
