'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarRange,
  ExternalLink,
  Eye,
  GitCompareArrows,
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
import { Pagination } from '@/components/common/Pagination/Pagination';
import { formatMetric, formatScore, formatShortDate } from '@/lib/mock/hotTopics';
import {
  buildPlatformTabs,
  getPlatformMeta,
  normalizePlatform,
  resolvePostPlatform,
  sortPlatformKeys,
} from '@/lib/utils/socialPlatforms';
import {
  getAggregateHotScoreFormulaTooltip,
  getAggregateInteractionFormulaTooltip,
  getAggregateSentimentFormulaTooltip,
  getAggregateTrendScoreFormulaTooltip,
  getDiscussionFormulaTooltip,
  getHotScoreFormulaTooltip,
  getInteractionFormulaTooltip,
  getSentimentFormulaTooltip,
  getTrendScoreFormulaTooltip,
} from '@/lib/utils/metricFormulas';
import { getCurrentMonthDateRange } from '@/lib/utils/dateRange';
import { cn } from '@/lib/utils';
import type { ChannelItem } from '@/lib/api/channels';
import { PlatformBadge } from './PlatformBadge';
import { CommentPanel } from './CommentPanel';
import { CompareModal, subjectPostsToCandidates } from './CompareModal';
import { ComparePostByDayModal } from './ComparePostByDayModal';
import { PostSnapshotModal } from './PostSnapshotModal';
import styles from './SubjectDetailModal.module.scss';

const PER_PAGE_OPTIONS = [5, 10, 20] as const;
type PostsPerPage = (typeof PER_PAGE_OPTIONS)[number];
const DEFAULT_PER_PAGE: PostsPerPage = 5;

const SORT_OPTIONS: { value: SubjectPostsSortBy; label: string }[] = [
  { value: 'posted_at', label: 'Mới nhất' },
  { value: 'hot_score', label: 'Hot score' },
  { value: 'trend_score', label: 'Trend score' },
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

function PostCard({
  post,
  channelMap,
  onCompare,
  onCompareByDay,
  onStats,
  onCommentAnalyzed,
}: {
  post: SubjectRelatedPost;
  channelMap: Map<number, ChannelItem>;
  onCompare: (post: SubjectRelatedPost) => void;
  onCompareByDay: (post: SubjectRelatedPost) => void;
  onStats: (post: SubjectRelatedPost) => void;
  onCommentAnalyzed?: () => void;
}) {
  const preview = post.title?.trim() || post.text?.trim() || '(Không có nội dung)';
  const channel = post.channel_id ? channelMap.get(post.channel_id) : null;
  const platform = resolvePostPlatform(post, channelMap);
  const platformMeta = getPlatformMeta(platform);

  return (
    <article
      className={styles.postCard}
      style={{ borderLeftColor: platformMeta.color }}
    >
      <div className={styles.postHeader}>
        <div className={styles.postOrigin}>
          <PlatformBadge platform={platform} size="md" />
          {channel ? (
            <span className={styles.channelLabel} title={channel.url}>
              {channel.name}
            </span>
          ) : null}
        </div>
        <div className={styles.postHeaderRight}>
          <button
            type="button"
            className={styles.postCompareBtn}
            onClick={() => onStats(post)}
            title="Xem thống kê / Snapshot bài"
          >
            <BarChart3 size={14} aria-hidden />
            Thống kê
          </button>
          <button
            type="button"
            className={styles.postCompareBtn}
            onClick={() => onCompare(post)}
            title="So sánh với bài viết khác"
          >
            <GitCompareArrows size={14} aria-hidden />
            So sánh bài viết
          </button>
          <button
            type="button"
            className={styles.postCompareByDayBtn}
            onClick={() => onCompareByDay(post)}
            title="So sánh snapshot Ngày A vs Ngày B của bài này"
          >
            <CalendarRange size={14} aria-hidden />
            So sánh theo ngày
          </button>
          <span className={styles.postDate}>{formatDateTime(post.posted_at)}</span>
        </div>
      </div>
      <p className={styles.postText}>{truncate(preview)}</p>
      {post.content_brief && post.content_brief_status === 'done' ? (
        <div className={styles.contentBriefBox}>
          <span className={styles.contentBriefLabel}>Tóm tắt nội dung (AI)</span>
          <p className={styles.contentBriefText}>{post.content_brief}</p>
        </div>
      ) : null}
      <div className={styles.postMetrics}>
        <span title="Likes (scraped)">
          <ThumbsUp size={14} aria-hidden /> {formatMetric(post.likes)}
        </span>
        <span title="Comments (scraped)">
          <MessageCircle size={14} aria-hidden /> {formatMetric(post.comments)}
        </span>
        <span title="Shares (scraped)">
          <Share2 size={14} aria-hidden /> {formatMetric(post.shares)}
        </span>
        <span title="Views / lượt xem (scraped)">
          <Eye size={14} aria-hidden /> {formatMetric(post.views ?? 0)}
        </span>
        <span title="Angry reactions (scraped)">
          <Angry size={14} aria-hidden /> {formatMetric(post.angry_count)}
        </span>
        <span
          title={getInteractionFormulaTooltip({
            platform,
            likes: post.likes,
            comments: post.comments,
            shares: post.shares,
            interaction: post.interaction,
          })}
        >
          IT {formatMetric(post.interaction)}
        </span>
        <span
          title={getHotScoreFormulaTooltip({
            platform,
            likes: post.likes,
            comments: post.comments,
            shares: post.shares,
            angry_count: post.angry_count,
            views: post.views,
            hot_score: post.hot_score,
          })}
        >
          H {formatScore(post.hot_score)}
        </span>
        <span
          title={getTrendScoreFormulaTooltip({
            platform,
            likes: post.likes,
            comments: post.comments,
            shares: post.shares,
            views: post.views,
            trend_score: post.trend_score,
          })}
        >
          T {formatScore(post.trend_score)}
        </span>
        <span
          title={getSentimentFormulaTooltip({
            platform,
            likes: post.likes,
            angry_count: post.angry_count,
            sentiment: post.sentiment,
          })}
        >
          S {post.sentiment.toFixed(2)}
        </span>
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
      <CommentPanel
        scraperRunId={post.id}
        platform={platform}
        videoTitle={preview}
        summary={post.comment_summary}
        contentBrief={post.content_brief}
        contentBriefStatus={post.content_brief_status}
        onAnalyzed={onCommentAnalyzed}
      />
    </article>
  );
}

function groupPostsByPlatform(
  posts: SubjectRelatedPost[],
  channelMap: Map<number, ChannelItem>
): { platform: string; posts: SubjectRelatedPost[] }[] {
  const grouped = new Map<string, SubjectRelatedPost[]>();
  for (const post of posts) {
    const platform = resolvePostPlatform(post, channelMap);
    const bucket = grouped.get(platform) || [];
    bucket.push(post);
    grouped.set(platform, bucket);
  }
  return sortPlatformKeys([...grouped.keys()]).map((platform) => ({
    platform,
    posts: grouped.get(platform) || [],
  }));
}

interface SubjectDetailModalProps {
  subjectId: number | null;
  open: boolean;
  onClose: () => void;
  /** Đồng bộ khoảng thời gian từ dashboard (optional). */
  dateFrom?: string;
  dateTo?: string;
}

export function SubjectDetailModal({
  subjectId,
  open,
  onClose,
  dateFrom: externalDateFrom,
  dateTo: externalDateTo,
}: SubjectDetailModalProps) {
  const initialRange = getCurrentMonthDateRange();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SubjectDetail | null>(null);
  const [sortBy, setSortBy] = useState<SubjectPostsSortBy>('posted_at');
  const [perPage, setPerPage] = useState<PostsPerPage>(DEFAULT_PER_PAGE);
  const [platformFilter, setPlatformFilter] = useState('');
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState(externalDateFrom || initialRange.date_from);
  const [dateTo, setDateTo] = useState(externalDateTo || initialRange.date_to);
  const [appliedDateFrom, setAppliedDateFrom] = useState(
    externalDateFrom || initialRange.date_from
  );
  const [appliedDateTo, setAppliedDateTo] = useState(externalDateTo || initialRange.date_to);
  const [compareSeed, setCompareSeed] = useState<{
    initialPostIds: number[];
  } | null>(null);
  const [compareByDayPost, setCompareByDayPost] = useState<SubjectRelatedPost | null>(null);
  const [statsPost, setStatsPost] = useState<SubjectRelatedPost | null>(null);

  const load = useCallback(
    async (options?: {
      page?: number;
      sort?: SubjectPostsSortBy;
      per_page?: PostsPerPage;
      platform?: string;
      date_from?: string;
      date_to?: string;
    }) => {
      if (!subjectId) return;
      const nextPage = options?.page ?? page;
      const nextSort = options?.sort ?? sortBy;
      const nextPerPage = options?.per_page ?? perPage;
      const nextPlatform = options?.platform ?? platformFilter;
      const nextFrom = options?.date_from ?? appliedDateFrom;
      const nextTo = options?.date_to ?? appliedDateTo;

      setLoading(true);
      setError(null);

      try {
        const res = await subjectsApi.getById(subjectId, {
          page: nextPage,
          per_page: nextPerPage,
          sort_by: nextSort,
          platform: nextPlatform || undefined,
          date_from: nextFrom,
          date_to: nextTo,
        });
        const data = res.data;
        if (!data) throw new Error('Empty subject detail');

        setDetail(data);
        setPage(data.pagination?.current_page ?? nextPage);
        if (options?.sort !== undefined) setSortBy(nextSort);
        if (options?.per_page !== undefined) setPerPage(nextPerPage);
        if (options?.platform !== undefined) setPlatformFilter(nextPlatform);
        if (options?.date_from !== undefined) setAppliedDateFrom(nextFrom);
        if (options?.date_to !== undefined) setAppliedDateTo(nextTo);
      } catch (err) {
        setError(getApiErrorMessage(err));
        setDetail(null);
      } finally {
        setLoading(false);
      }
    },
    [subjectId, sortBy, perPage, platformFilter, page, appliedDateFrom, appliedDateTo]
  );

  useEffect(() => {
    if (!open || !subjectId) {
      setDetail(null);
      setError(null);
      setPage(1);
      setPlatformFilter('');
      setSortBy('posted_at');
      setPerPage(DEFAULT_PER_PAGE);
      return;
    }
    const range = getCurrentMonthDateRange();
    const from = externalDateFrom || range.date_from;
    const to = externalDateTo || range.date_to;
    setDateFrom(from);
    setDateTo(to);
    setAppliedDateFrom(from);
    setAppliedDateTo(to);
    void load({ page: 1, sort: 'posted_at', platform: '', date_from: from, date_to: to });
  }, [open, subjectId, externalDateFrom, externalDateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const channelMap = useMemo(() => {
    const map = new Map<number, ChannelItem>();
    for (const ch of detail?.subject?.channels || []) {
      map.set(ch.id, ch);
    }
    return map;
  }, [detail?.subject?.channels]);

  /** Kênh theo tab nền tảng đang chọn (hoặc tất cả nếu không lọc). */
  const visibleChannels = useMemo(() => {
    const all = detail?.subject?.channels || [];
    if (!platformFilter) return all;
    return all.filter(
      (ch) => normalizePlatform(ch.type_channel) === normalizePlatform(platformFilter)
    );
  }, [detail?.subject?.channels, platformFilter]);

  const channelFollowers = useMemo(
    () => visibleChannels.reduce((sum, ch) => sum + (Number(ch.followers) || 0), 0),
    [visibleChannels]
  );

  const channelPostCount = useMemo(
    () => visibleChannels.reduce((sum, ch) => sum + (Number(ch.post_count) || 0), 0),
    [visibleChannels]
  );

  const platformTabs = useMemo(
    () => buildPlatformTabs(detail?.posts_by_platform),
    [detail?.posts_by_platform]
  );

  const groupedPosts = useMemo(() => {
    if (!detail?.posts?.length) return [];
    if (platformFilter) return [];
    return groupPostsByPlatform(detail.posts, channelMap);
  }, [detail?.posts, platformFilter, channelMap]);

  if (!open) return null;

  const aggregate = detail?.aggregate;
  const pagination = detail?.pagination;
  const totalPages = Math.max(1, pagination?.total_pages ?? 1);
  const totalRecords = pagination?.total_records ?? 0;
  const currentPage = pagination?.current_page ?? page;
  const postsLoading = loading && Boolean(detail);

  const handlePlatformChange = (nextPlatform: string) => {
    setPlatformFilter(nextPlatform);
    void load({ page: 1, platform: nextPlatform, sort: sortBy });
  };

  const handleSortChange = (nextSort: SubjectPostsSortBy) => {
    setSortBy(nextSort);
    void load({ page: 1, sort: nextSort, platform: platformFilter });
  };

  const handlePerPageChange = (nextPerPage: PostsPerPage) => {
    setPerPage(nextPerPage);
    void load({ page: 1, per_page: nextPerPage, platform: platformFilter });
  };

  const handleApplyDates = () => {
    const from = dateFrom || getCurrentMonthDateRange().date_from;
    const to = dateTo || getCurrentMonthDateRange().date_to;
    setDateFrom(from);
    setDateTo(to);
    void load({ page: 1, date_from: from, date_to: to });
  };

  const handleResetMonth = () => {
    const range = getCurrentMonthDateRange();
    setDateFrom(range.date_from);
    setDateTo(range.date_to);
    void load({ page: 1, date_from: range.date_from, date_to: range.date_to });
  };

  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || postsLoading) return;
    void load({ page: nextPage, sort: sortBy, platform: platformFilter });
  };

  const renderPosts = () => {
    if (!detail?.posts?.length) {
      return (
        <div className={styles.empty}>
          {platformFilter
            ? `Chưa có bài viết nào trên ${getPlatformMeta(platformFilter).label} trong khoảng đã chọn.`
            : 'Chưa có bài viết nào trong khoảng thời gian đã chọn.'}
        </div>
      );
    }

    const cardProps = {
      channelMap,
      onCompare: (post: SubjectRelatedPost) =>
        setCompareSeed({ initialPostIds: [post.id] }),
      onCompareByDay: (post: SubjectRelatedPost) => setCompareByDayPost(post),
      onStats: (post: SubjectRelatedPost) => setStatsPost(post),
      onCommentAnalyzed: () =>
        void load({ page, sort: sortBy, platform: platformFilter }),
    };

    if (platformFilter) {
      return detail.posts.map((post) => (
        <PostCard key={post.id} post={post} {...cardProps} />
      ));
    }

    return groupedPosts.map(({ platform, posts }) => {
      const meta = getPlatformMeta(platform);
      const totalOnPlatform = detail.posts_by_platform?.[platform] ?? posts.length;
      return (
        <section key={platform} className={styles.platformGroup}>
          <header
            className={styles.platformGroupHeader}
            style={{ borderColor: meta.border, backgroundColor: meta.bg }}
          >
            <PlatformBadge platform={platform} size="md" />
            <span className={styles.platformGroupTitle}>{meta.label}</span>
            <span className={styles.platformGroupCount}>{totalOnPlatform} bài</span>
          </header>
          <div className={styles.platformGroupList}>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} {...cardProps} />
            ))}
          </div>
        </section>
      );
    });
  };

  return (
    <>
      <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <header className={styles.header}>
            <div>
              <p className={styles.eyebrow}>Chi tiết đối tượng</p>
              <h2 className={styles.title}>
                {detail?.subject?.name || (loading && !detail ? 'Đang tải…' : '—')}
              </h2>
            {detail?.subject?.normalized_name && (
              <p className={styles.subtitle}>Biệt danh: {detail.subject.normalized_name}</p>
            )}
            {(detail?.subject?.channels?.length || 0) > 0 ? (
              <div className={styles.channelSection}>
                {(detail?.subject?.channels || []).map((ch) => (
                  <a
                    key={ch.id}
                    className={styles.channelCard}
                    href={ch.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={ch.url}
                  >
                    <span className={styles.channelCardHead}>
                      <PlatformBadge platform={ch.type_channel} />
                      <strong>{ch.name}</strong>
                    </span>
                    <span className={styles.channelCardMeta}>
                      {formatMetric(ch.followers ?? 0)} followers ·{' '}
                      {formatMetric(ch.post_count ?? 0)} bài viết
                    </span>
                  </a>
                ))}
              </div>
            ) : null}
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
              <div
                className={styles.aggCard}
                title={getDiscussionFormulaTooltip({
                  comments: aggregate?.comments,
                  posts_count: aggregate?.posts_count,
                  discussion: aggregate?.discussion,
                })}
              >
                <span>Thảo luận</span>
                <strong>{formatMetric(aggregate?.discussion ?? 0)}</strong>
              </div>
              <div
                className={styles.aggCard}
                title={getAggregateInteractionFormulaTooltip({
                  channelTypes: (detail.subject.channels || []).map((ch) => ch.type_channel),
                  likes: aggregate?.likes,
                  comments: aggregate?.comments,
                  shares: aggregate?.shares,
                  interaction: aggregate?.interaction,
                })}
              >
                <span>Tương tác</span>
                <strong>{formatMetric(aggregate?.interaction ?? 0)}</strong>
              </div>
              <div className={styles.aggCard} title="Tổng followers các kênh gắn với đối tượng">
                <span>Followers</span>
                <strong>{formatMetric(channelFollowers)}</strong>
              </div>
              <div className={styles.aggCard} title="Tổng số bài viết kênh (từ channel.post_count)">
                <span>Số bài viết kênh</span>
                <strong>{formatMetric(channelPostCount)}</strong>
              </div>
              <div
                className={styles.aggCard}
                title={getAggregateSentimentFormulaTooltip({
                  channelTypes: (detail.subject.channels || []).map((ch) => ch.type_channel),
                  likes: aggregate?.likes,
                  angry_count: aggregate?.angry_count,
                  sentiment: aggregate?.sentiment,
                })}
              >
                <span>Cảm xúc</span>
                <strong>{(aggregate?.sentiment ?? 0).toFixed(2)}</strong>
              </div>
              <div
                className={styles.aggCard}
                title={getAggregateHotScoreFormulaTooltip({
                  channelTypes: (detail.subject.channels || []).map((ch) => ch.type_channel),
                  likes: aggregate?.likes,
                  comments: aggregate?.comments,
                  shares: aggregate?.shares,
                  angry_count: aggregate?.angry_count,
                  views: aggregate?.views,
                  hot_score: aggregate?.hot_score,
                })}
              >
                <span>Hot score</span>
                <strong>{formatScore(aggregate?.hot_score ?? 0)}</strong>
              </div>
              <div
                className={styles.aggCard}
                title={getAggregateTrendScoreFormulaTooltip({
                  channelTypes: (detail.subject.channels || []).map((ch) => ch.type_channel),
                  likes: aggregate?.likes,
                  comments: aggregate?.comments,
                  shares: aggregate?.shares,
                  views: aggregate?.views,
                  trend_score: aggregate?.trend_score,
                })}
              >
                <span>Trend score</span>
                <strong>{formatScore(aggregate?.trend_score ?? 0)}</strong>
              </div>
              <div
                className={styles.aggCard}
                title="Uptrend nếu đạt ngưỡng hot/trend; ngược lại Downtrend"
              >
                <span>Xu hướng</span>
                <strong className={styles.trendValue}>
                  {aggregate?.trend_direction === 'up' ? (
                    <>
                      <TrendingUp size={16} /> Uptrend
                    </>
                  ) : (
                    <>
                      <TrendingDown size={16} /> Downtrend
                    </>
                  )}
                </strong>
              </div>
            </section>

            <section className={styles.metricStrip}>
              <span>Likes {formatMetric(aggregate?.likes ?? 0)}</span>
              <span>Comments {formatMetric(aggregate?.comments ?? 0)}</span>
              <span>Shares {formatMetric(aggregate?.shares ?? 0)}</span>
              <span>Followers {formatMetric(channelFollowers)}</span>
              <span>Số bài viết kênh {formatMetric(channelPostCount)}</span>
              <span>Angry {formatMetric(aggregate?.angry_count ?? 0)}</span>
              <span>Số bài {formatMetric(aggregate?.posts_count ?? 0)}</span>
              <span>
                Cập nhật {formatShortDate(aggregate?.computed_at || detail.subject.updated_at)}
              </span>
            </section>

            <div className={styles.postsToolbar}>
              <h3>
                Bài viết liên quan{' '}
                <em>({totalRecords})</em>
              </h3>
              <div className={styles.postsToolbarRight}>
                <div className={styles.dateRangeFilter}>
                  <label>
                    Từ
                    <input
                      type="date"
                      value={dateFrom}
                      disabled={postsLoading}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </label>
                  <label>
                    Đến
                    <input
                      type="date"
                      value={dateTo}
                      disabled={postsLoading}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </label>
                  <button type="button" disabled={postsLoading} onClick={handleApplyDates}>
                    Áp dụng
                  </button>
                  <button type="button" disabled={postsLoading} onClick={handleResetMonth}>
                    Tháng này
                  </button>
                </div>
                <label>
                  Hiển thị
                  <select
                    value={perPage}
                    disabled={postsLoading}
                    onChange={(e) =>
                      handlePerPageChange(Number(e.target.value) as PostsPerPage)
                    }
                  >
                    {PER_PAGE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n} / trang
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Sắp xếp
                  <select
                    value={sortBy}
                    disabled={postsLoading}
                    onChange={(e) => handleSortChange(e.target.value as SubjectPostsSortBy)}
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {platformTabs.length > 1 && (
              <div className={styles.platformTabs} role="tablist" aria-label="Lọc theo nền tảng">
                {platformTabs.map((tab) => {
                  const active = platformFilter === tab.id;
                  const meta = tab.id ? getPlatformMeta(tab.id) : null;
                  return (
                    <button
                      key={tab.id || 'all'}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={active ? styles.platformTabActive : styles.platformTab}
                      style={
                        active && meta
                          ? {
                              borderColor: meta.border,
                              backgroundColor: meta.bg,
                              color: meta.color,
                            }
                          : undefined
                      }
                      disabled={postsLoading}
                      onClick={() => handlePlatformChange(tab.id)}
                    >
                      {tab.id ? <PlatformBadge platform={tab.id} /> : null}
                      <span>{tab.label}</span>
                      <em>{tab.count}</em>
                    </button>
                  );
                })}
              </div>
            )}

            <div className={cn(styles.postsList, postsLoading && styles.postsListLoading)}>
              {postsLoading && (
                <div className={styles.postsLoadingOverlay}>
                  <Loader2 size={18} className={styles.spin} aria-hidden /> Đang tải bài viết…
                </div>
              )}
              {renderPosts()}
            </div>

            <div className={styles.pagination}>
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                totalRecords={totalRecords}
                unitLabel="bài"
                info={
                  platformFilter
                    ? `Trang ${currentPage}/${totalPages} · ${totalRecords.toLocaleString('vi-VN')} bài · ${getPlatformMeta(platformFilter).label}`
                    : undefined
                }
                disabled={postsLoading}
                onChange={goToPage}
              />
            </div>
          </>
        ) : null}
      </div>
      </div>

      {compareSeed && detail ? (
        <CompareModal
          mode="posts"
          initialPostIds={compareSeed.initialPostIds}
          postCandidates={subjectPostsToCandidates(detail.posts)}
          onClose={() => setCompareSeed(null)}
        />
      ) : null}

      {compareByDayPost ? (
        <ComparePostByDayModal
          post={compareByDayPost}
          onClose={() => setCompareByDayPost(null)}
        />
      ) : null}

      {statsPost ? (
        <PostSnapshotModal post={statsPost} onClose={() => setStatsPost(null)} />
      ) : null}
    </>
  );
}
