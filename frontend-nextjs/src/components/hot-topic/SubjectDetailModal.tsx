'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ExternalLink,
  Loader2,
  MessageCircle,
  Share2,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  X,
  Angry,
} from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api/client';
import {
  subjectsApi,
  type SubjectDetail,
  type SubjectPostsSortBy,
  type SubjectRelatedPost,
} from '@/lib/api/subjects';
import { formatMetric, formatScore, formatShortDate } from '@/lib/mock/hotTopics';
import styles from './SubjectDetailModal.module.scss';

const SORT_OPTIONS: { value: SubjectPostsSortBy; label: string }[] = [
  { value: 'posted_at', label: 'Mới nhất' },
  { value: 'hot_score', label: 'Hot score' },
  { value: 'interaction', label: 'Tương tác' },
  { value: 'likes', label: 'Likes' },
  { value: 'comments', label: 'Comments' },
  { value: 'shares', label: 'Shares' },
];

function truncate(text: string, max = 220): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PostCard({ post }: { post: SubjectRelatedPost }) {
  const preview = post.title?.trim() || post.text?.trim() || '(Không có nội dung)';
  return (
    <article className={styles.postCard}>
      <div className={styles.postHeader}>
        <span className={styles.platform}>{post.platform || 'facebook'}</span>
        <span className={styles.postDate}>{formatDateTime(post.posted_at)}</span>
      </div>
      <p className={styles.postText}>{truncate(preview)}</p>
      <div className={styles.postMetrics}>
        <span title="Likes">
          <ThumbsUp size={14} aria-hidden /> {formatMetric(post.likes)}
        </span>
        <span title="Comments">
          <MessageCircle size={14} aria-hidden /> {formatMetric(post.comments)}
        </span>
        <span title="Shares">
          <Share2 size={14} aria-hidden /> {formatMetric(post.shares)}
        </span>
        <span title="Angry">
          <Angry size={14} aria-hidden /> {formatMetric(post.angry_count)}
        </span>
        <span title="Interaction">IT {formatMetric(post.interaction)}</span>
        <span title="Hot score">H {formatScore(post.hot_score)}</span>
        <span title="Trend score">T {formatScore(post.trend_score)}</span>
        <span title="Sentiment">S {post.sentiment.toFixed(2)}</span>
      </div>
      {post.post_url && (
        <a
          href={post.post_url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.postLink}
        >
          Mở bài gốc <ExternalLink size={14} aria-hidden />
        </a>
      )}
    </article>
  );
}

interface SubjectDetailModalProps {
  subjectId: number | null;
  open: boolean;
  onClose: () => void;
}

export function SubjectDetailModal({ subjectId, open, onClose }: SubjectDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SubjectDetail | null>(null);
  const [sortBy, setSortBy] = useState<SubjectPostsSortBy>('posted_at');
  const [page, setPage] = useState(1);

  const load = useCallback(
    async (options?: { page?: number; append?: boolean; sort?: SubjectPostsSortBy }) => {
      if (!subjectId) return;
      const nextPage = options?.page ?? 1;
      const append = Boolean(options?.append);
      const nextSort = options?.sort ?? sortBy;

      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const res = await subjectsApi.getById(subjectId, {
          page: nextPage,
          per_page: 10,
          sort_by: nextSort,
        });
        const data = res.data;
        if (!data) throw new Error('Empty subject detail');

        setDetail((prev) => {
          if (!append || !prev) return data;
          return {
            ...data,
            posts: [...prev.posts, ...data.posts],
          };
        });
        setPage(data.pagination?.current_page ?? nextPage);
      } catch (err) {
        setError(getApiErrorMessage(err));
        if (!append) setDetail(null);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [subjectId, sortBy]
  );

  useEffect(() => {
    if (!open || !subjectId) {
      setDetail(null);
      setError(null);
      setPage(1);
      return;
    }
    setSortBy('posted_at');
    void load({ page: 1, append: false, sort: 'posted_at' });
  }, [open, subjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const aggregate = detail?.aggregate;
  const canLoadMore = Boolean(
    detail && detail.pagination.current_page < detail.pagination.total_pages
  );

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Chi tiết đối tượng</p>
            <h2 className={styles.title}>
              {detail?.subject?.name || (loading ? 'Đang tải…' : '—')}
            </h2>
            {detail?.subject?.normalized_name && (
              <p className={styles.subtitle}>Biệt danh: {detail.subject.normalized_name}</p>
            )}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </header>

        {error && (
          <div className={styles.error} role="alert">
            {error}
            <button type="button" onClick={() => load({ page: 1 })}>
              Thử lại
            </button>
          </div>
        )}

        {loading && !detail ? (
          <div className={styles.loading}>
            <Loader2 size={22} className={styles.spin} /> Đang tải chi tiết…
          </div>
        ) : detail ? (
          <>
            <section className={styles.aggregate}>
              <div className={styles.aggCard}>
                <span>Thảo luận</span>
                <strong>{formatMetric(aggregate?.discussion ?? 0)}</strong>
              </div>
              <div className={styles.aggCard}>
                <span>Tương tác</span>
                <strong>{formatMetric(aggregate?.interaction ?? 0)}</strong>
              </div>
              <div className={styles.aggCard}>
                <span>Cảm xúc</span>
                <strong>{(aggregate?.sentiment ?? 0).toFixed(2)}</strong>
              </div>
              <div className={styles.aggCard}>
                <span>Hot score</span>
                <strong>{formatScore(aggregate?.hot_score ?? 0)}</strong>
              </div>
              <div className={styles.aggCard}>
                <span>Trend score</span>
                <strong>{formatScore(aggregate?.trend_score ?? 0)}</strong>
              </div>
              <div className={styles.aggCard}>
                <span>Xu hướng</span>
                <strong className={styles.trendValue}>
                  {aggregate?.trend_direction === 'up' && (
                    <>
                      <TrendingUp size={16} /> Uptrend
                    </>
                  )}
                  {aggregate?.trend_direction === 'down' && (
                    <>
                      <TrendingDown size={16} /> Downtrend
                    </>
                  )}
                  {aggregate?.trend_direction === 'neutral' && 'Neutral'}
                </strong>
              </div>
            </section>

            <section className={styles.metricStrip}>
              <span>Likes {formatMetric(aggregate?.likes ?? 0)}</span>
              <span>Comments {formatMetric(aggregate?.comments ?? 0)}</span>
              <span>Shares {formatMetric(aggregate?.shares ?? 0)}</span>
              <span>Angry {formatMetric(aggregate?.angry_count ?? 0)}</span>
              <span>Số bài {formatMetric(aggregate?.posts_count ?? 0)}</span>
              <span>
                Cập nhật {formatShortDate(aggregate?.computed_at || detail.subject.updated_at)}
              </span>
            </section>

            <div className={styles.postsToolbar}>
              <h3>
                Bài viết liên quan{' '}
                <em>({detail.pagination.total_records})</em>
              </h3>
              <label>
                Sắp xếp
                <select
                  value={sortBy}
                  onChange={(e) => {
                    const next = e.target.value as SubjectPostsSortBy;
                    setSortBy(next);
                    void load({ page: 1, append: false, sort: next });
                  }}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className={styles.postsList}>
              {detail.posts.length === 0 ? (
                <div className={styles.empty}>Chưa có bài viết nào gắn với đối tượng này.</div>
              ) : (
                detail.posts.map((post) => <PostCard key={post.id} post={post} />)
              )}
            </div>

            {canLoadMore && (
              <button
                type="button"
                className={styles.loadMore}
                disabled={loadingMore}
                onClick={() => load({ page: page + 1, append: true })}
              >
                {loadingMore ? 'Đang tải…' : 'Xem thêm bài viết'}
              </button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
