'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Crown,
  Film,
  Grid3X3,
  Loader2,
  MessageCircle,
  Music,
  Newspaper,
  Phone,
  Plane,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api/client';
import {
  socialPostsApi,
  type SocialPostItem,
  type SocialPostSortBy,
  type SocialPostStats,
} from '@/lib/api/socialPosts';
import {
  TOPIC_CATEGORIES,
  colorForId,
  formatMetric,
  formatScore,
  formatShortDate,
  type ChartTopic,
  type HotTopic,
  type RankedBy,
  type TopicCategory,
} from '@/lib/mock/hotTopics';
import { cn } from '@/lib/utils';
import { formatMonthRangeLabel, getCurrentMonthDateRange } from '@/lib/utils/dateRange';
import { PlatformBadge } from './PlatformBadge';
import { HotTopicHeader } from './HotTopicHeader';
import { SubjectDetailModal } from './SubjectDetailModal';
import styles from './HotTopicDashboard.module.scss';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  grid: <Grid3X3 size={16} aria-hidden />,
  film: <Film size={16} aria-hidden />,
  music: <Music size={16} aria-hidden />,
  news: <Newspaper size={16} aria-hidden />,
  message: <MessageCircle size={16} aria-hidden />,
  plane: <Plane size={16} aria-hidden />,
};

const RANKED_BY_LABELS: Record<RankedBy, string> = {
  discussion: 'Thảo Luận',
  interaction: 'Tương Tác',
  sentiment: 'Cảm Xúc',
};

const RANKED_BY_TO_SORT: Record<RankedBy, SocialPostSortBy> = {
  discussion: 'discussion',
  interaction: 'interaction',
  sentiment: 'sentiment',
};

const PAGE_SIZE = 20;

function mapToHotTopic(item: SocialPostItem): HotTopic {
  const title = item.subject?.name?.trim() || `Subject #${item.subject_id}`;
  const nickName = item.subject?.normalized_name?.trim() || '';
  const channels = item.subject?.channels || [];
  const channelLabel = channels.length
    ? channels
        .slice(0, 3)
        .map((ch) => ch.name)
        .join(' · ')
    : '';

  return {
    id: String(item.id),
    subjectId: item.subject_id || item.subject?.id || 0,
    rank: item.rank,
    title,
    nickName,
    category: 'social-news',
    categoryLabel: nickName ? `Biệt danh: ${nickName}` : 'Đối tượng theo dõi',
    channelLabel,
    channels: channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      type_channel: ch.type_channel,
      url: ch.url,
    })),
    isNew: item.is_new,
    thumbnailColor: colorForId(item.id),
    discussion: item.discussion,
    discussionTrend: item.trend_direction,
    interaction: item.interaction,
    sentiment: item.sentiment,
    hotScore: item.hot_score,
    trendScore: item.trend_score,
    likes: item.likes,
    comments: item.comments,
    shares: item.shares,
    angryCount: item.angry_count,
    follow: item.follow ?? 0,
    postsCount: item.posts_count,
    startDate: formatShortDate(item.created_at || item.computed_at),
  };
}

function mapToChartTopic(item: SocialPostItem): ChartTopic {
  const topic = mapToHotTopic(item);
  return {
    id: topic.id,
    title: topic.title,
    discussion: topic.discussion,
    interaction: topic.interaction,
    sentiment: topic.sentiment,
    hotScore: topic.hotScore,
    trendScore: topic.trendScore,
    thumbnailColor: topic.thumbnailColor,
    rank: topic.rank,
    categoryLabel: topic.categoryLabel,
    startDate: topic.startDate,
    discussionTrend: topic.discussionTrend,
  };
}

function chartTopicToHotTopic(item: ChartTopic): HotTopic {
  return {
    id: item.id,
    subjectId: 0,
    rank: item.rank,
    title: item.title,
    nickName: '',
    category: 'social-news',
    categoryLabel: item.categoryLabel,
    channelLabel: '',
    thumbnailColor: item.thumbnailColor,
    discussion: item.discussion,
    discussionTrend: item.discussionTrend,
    interaction: item.interaction,
    sentiment: item.sentiment,
    hotScore: item.hotScore,
    trendScore: item.trendScore,
    likes: 0,
    comments: 0,
    shares: 0,
    angryCount: 0,
    follow: 0,
    postsCount: 0,
    startDate: item.startDate,
  };
}

function chartValue(topic: ChartTopic, rankedBy: RankedBy): number {
  if (rankedBy === 'interaction') return topic.interaction;
  if (rankedBy === 'sentiment') return Math.max(topic.sentiment, 0) * 100;
  return topic.discussion;
}

function SentimentFace({ value }: { value: number }) {
  const tone =
    value >= 0.3 ? styles.sentimentPositive : value <= -0.1 ? styles.sentimentNegative : styles.sentimentNeutral;
  const emoji = value >= 0.3 ? '😊' : value <= -0.1 ? '😞' : '😐';
  return (
    <span className={cn(styles.sentimentFace, tone)} aria-hidden>
      {emoji}
    </span>
  );
}

function TopicThumbnail({ color, title }: { color: string; title: string }) {
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <div className={styles.thumbnail} style={{ backgroundColor: color }} aria-hidden>
      {initials || '?'}
    </div>
  );
}

function ChartTooltip({ topic, rankedBy }: { topic: HotTopic; rankedBy: RankedBy }) {
  return (
    <div className={styles.chartTooltip}>
      <div className={styles.chartTooltipHeader}>
        <TopicThumbnail color={topic.thumbnailColor} title={topic.title} />
        <div>
          <div className={styles.chartTooltipRank}>#{topic.rank}</div>
          <div className={styles.chartTooltipTitle}>{topic.title}</div>
          <div className={styles.chartTooltipCategory}>{topic.categoryLabel}</div>
        </div>
      </div>
      <div className={styles.chartTooltipMeta}>
        {topic.startDate} - Hiện tại · theo {RANKED_BY_LABELS[rankedBy]}
      </div>
      <div className={styles.chartTooltipStats}>
        <div>
          <span>Thảo luận</span>
          <strong>{formatMetric(topic.discussion)}</strong>
        </div>
        <div>
          <span>Tương tác</span>
          <strong>{formatMetric(topic.interaction)}</strong>
        </div>
        <div>
          <span>Follow</span>
          <strong>{formatMetric(topic.follow)}</strong>
        </div>
        <div>
          <span>Cảm xúc</span>
          <strong className={topic.sentiment >= 0 ? styles.positive : styles.negative}>
            {topic.sentiment.toFixed(2).replace('.', ',')}
          </strong>
        </div>
      </div>
      <div className={styles.chartTooltipStats}>
        <div>
          <span>Hot score</span>
          <strong>{formatScore(topic.hotScore)}</strong>
        </div>
        <div>
          <span>Trend score</span>
          <strong>{formatScore(topic.trendScore)}</strong>
        </div>
      </div>
    </div>
  );
}

function RankingRow({
  topic,
  onOpenDetail,
}: {
  topic: HotTopic;
  onOpenDetail: (topic: HotTopic) => void;
}) {
  return (
    <article className={styles.rankingRow}>
      <div className={styles.rankNumber}>{topic.rank}</div>

      <div className={styles.topicInfo}>
        <TopicThumbnail color={topic.thumbnailColor} title={topic.title} />
        <div className={styles.topicMeta}>
          <div className={styles.topicTitleRow}>
            <h3 className={styles.topicTitle}>{topic.title}</h3>
            {topic.isNew && <span className={styles.newBadge}>Mới xuất hiện</span>}
          </div>
          <span className={styles.topicCategory}>{topic.categoryLabel}</span>
          {(topic.channels?.length || 0) > 0 ? (
            <div className={styles.topicChannelChips}>
              {topic.channels!.map((ch) => (
                <span key={ch.id} className={styles.topicChannelChip} title={ch.url || ch.name}>
                  <PlatformBadge platform={ch.type_channel} />
                  <span>{ch.name}</span>
                </span>
              ))}
            </div>
          ) : topic.channelLabel ? (
            <span className={styles.topicChannels} title={topic.channelLabel}>
              {topic.channelLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className={styles.metrics}>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Tổng lượng thảo luận</span>
          <span className={styles.metricValue}>
            {formatMetric(topic.discussion)}
            {topic.discussionTrend === 'up' && (
              <TrendingUp size={14} className={styles.trendUp} aria-label="Uptrend" />
            )}
            {topic.discussionTrend === 'down' && (
              <TrendingDown size={14} className={styles.trendDown} aria-label="Downtrend" />
            )}
          </span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Tổng lượng tương tác</span>
          <span className={styles.metricValue}>{formatMetric(topic.interaction)}</span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Follow</span>
          <span className={styles.metricValue}>{formatMetric(topic.follow)}</span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Chỉ số cảm xúc</span>
          <span className={styles.metricValue}>
            {topic.sentiment.toFixed(2).replace('.', ',')}
            <SentimentFace value={topic.sentiment} />
          </span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Hot / Trend score</span>
          <div className={styles.brandList}>
            <span className={styles.brandChip} title={`Hot score: ${formatScore(topic.hotScore)}`}>
              H {formatScore(topic.hotScore)}
            </span>
            <span className={styles.brandChip} title={`Trend score: ${formatScore(topic.trendScore)}`}>
              T {formatScore(topic.trendScore)}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        className={styles.rowActionBtn}
        onClick={() => onOpenDetail(topic)}
        disabled={!topic.subjectId}
      >
        Chi tiết
      </button>
    </article>
  );
}

function buildYAxisLabels(maxValue: number): string[] {
  if (maxValue <= 0) return ['0', '0', '0', '0', '0', '0'];
  const step = maxValue / 5;
  return [5, 4, 3, 2, 1, 0].map((i) => formatMetric(Math.round(step * i)));
}

export function HotTopicDashboard() {
  const initialRange = getCurrentMonthDateRange();
  const [selectedCategory, setSelectedCategory] = useState<TopicCategory>('all');
  const [rankedBy, setRankedBy] = useState<RankedBy>('discussion');
  const [showNewOnly, setShowNewOnly] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [supportOpen, setSupportOpen] = useState(true);
  const [hoveredChartId, setHoveredChartId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState(initialRange.date_from);
  const [dateTo, setDateTo] = useState(initialRange.date_to);
  const [appliedDateFrom, setAppliedDateFrom] = useState(initialRange.date_from);
  const [appliedDateTo, setAppliedDateTo] = useState(initialRange.date_to);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<SocialPostStats | null>(null);
  const [chartTopics, setChartTopics] = useState<ChartTopic[]>([]);
  const [topics, setTopics] = useState<HotTopic[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [periodLabel, setPeriodLabel] = useState(
    formatMonthRangeLabel(initialRange.date_from, initialRange.date_to)
  );
  const [detailSubjectId, setDetailSubjectId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = useCallback((topic: HotTopic) => {
    if (!topic.subjectId) return;
    setDetailSubjectId(topic.subjectId);
    setDetailOpen(true);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
    setDetailSubjectId(null);
  }, []);

  const applyDateRange = () => {
    const from = dateFrom || getCurrentMonthDateRange().date_from;
    const to = dateTo || getCurrentMonthDateRange().date_to;
    setDateFrom(from);
    setDateTo(to);
    setAppliedDateFrom(from);
    setAppliedDateTo(to);
  };

  const resetToCurrentMonth = () => {
    const range = getCurrentMonthDateRange();
    setDateFrom(range.date_from);
    setDateTo(range.date_to);
    setAppliedDateFrom(range.date_from);
    setAppliedDateTo(range.date_to);
  };

  const loadDashboard = useCallback(
    async (options?: { page?: number; append?: boolean }) => {
      const nextPage = options?.page ?? 1;
      const append = Boolean(options?.append);

      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const res = await socialPostsApi.getDashboard({
          page: nextPage,
          per_page: PAGE_SIZE,
          sort_by: RANKED_BY_TO_SORT[rankedBy],
          new_only: showNewOnly,
          chart_limit: 10,
          date_from: appliedDateFrom,
          date_to: appliedDateTo,
        });

        const data = res.data;
        if (!data) {
          throw new Error('Empty dashboard response');
        }

        setStats(data.stats);
        if (!append) {
          setChartTopics((data.chart || []).map(mapToChartTopic));
        }

        const mapped = (data.ranking || []).map(mapToHotTopic);
        setTopics((prev) => (append ? [...prev, ...mapped] : mapped));
        setPage(data.pagination?.current_page ?? nextPage);
        setTotalPages(Math.max(1, data.pagination?.total_pages ?? 1));
        setPeriodLabel(
          formatMonthRangeLabel(
            data.date_from || appliedDateFrom,
            data.date_to || appliedDateTo
          )
        );
      } catch (err) {
        setError(getApiErrorMessage(err));
        if (!append) {
          setStats(null);
          setChartTopics([]);
          setTopics([]);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [rankedBy, showNewOnly, appliedDateFrom, appliedDateTo]
  );

  useEffect(() => {
    setPage(1);
    void loadDashboard({ page: 1, append: false });
  }, [loadDashboard]);

  const maxChartValue = useMemo(() => {
    if (chartTopics.length === 0) return 1;
    return Math.max(...chartTopics.map((t) => chartValue(t, rankedBy)), 1);
  }, [chartTopics, rankedBy]);

  const yAxisLabels = useMemo(() => buildYAxisLabels(maxChartValue), [maxChartValue]);

  const filteredTopics = useMemo(() => {
    if (selectedCategory === 'all') return topics;
    // API chưa có category thật — giữ UI nhóm chủ đề, lọc chỉ áp dụng khi chọn "Tất cả"
    return topics;
  }, [topics, selectedCategory]);

  const hoveredTopic = useMemo(() => {
    const fromRanking = topics.find((t) => t.id === hoveredChartId);
    if (fromRanking) return fromRanking;
    const chartMatch =
      chartTopics.find((t) => t.id === hoveredChartId) || chartTopics[0] || null;
    return chartMatch ? chartTopicToHotTopic(chartMatch) : null;
  }, [topics, chartTopics, hoveredChartId]);

  const canLoadMore = page < totalPages;

  return (
    <div className={styles.dashboard}>
      <HotTopicHeader
        onScrapeSuccess={() => loadDashboard({ page: 1, append: false })}
      />

      <div className={styles.filterBar}>
        <div className={styles.filterBarInner}>
          <div className={styles.rankBySelect}>
            <span>Xếp hạng theo:</span>
            <select
              value={rankedBy}
              onChange={(e) => setRankedBy(e.target.value as RankedBy)}
              aria-label="Xếp hạng theo"
            >
              {Object.entries(RANKED_BY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <strong className={styles.rankByHighlight}>{RANKED_BY_LABELS[rankedBy]}</strong>
          </div>

          <div className={styles.filterBarRight}>
            <label className={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={showNewOnly}
                onChange={(e) => setShowNewOnly(e.target.checked)}
              />
              <span className={styles.toggleSwitch} aria-hidden />
              Chỉ hiện chủ đề mới xuất hiện
            </label>
            <div className={styles.datePicker}>
              <Calendar size={15} aria-hidden />
              <label>
                Từ
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </label>
              <label>
                Đến
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </label>
              <button type="button" onClick={applyDateRange}>
                Áp dụng
              </button>
              <button type="button" onClick={resetToCurrentMonth} title="Tháng hiện tại">
                Tháng này
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.bodyLayout}>
        <aside className={cn(styles.sidebar, sidebarCollapsed && styles.sidebarCollapsed)}>
          <p className={styles.sidebarTitle}>Nhóm chủ đề</p>
          <ul className={styles.sidebarList}>
            {TOPIC_CATEGORIES.map((cat) => (
              <li key={cat.id}>
                <button
                  type="button"
                  className={cn(
                    styles.sidebarItem,
                    selectedCategory === cat.id && styles.sidebarItemActive
                  )}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {CATEGORY_ICONS[cat.icon]}
                  {!sidebarCollapsed && <span>{cat.label}</span>}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={styles.sidebarToggle}
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </aside>

        <main className={styles.mainContent}>
          <section className={styles.promoCards}>
            <div className={cn(styles.promoCard, styles.promoWelcome)}>
              <Trophy size={28} className={styles.promoIcon} aria-hidden />
              <div>
                <h2>Chào mừng bạn đến với SocialTrend!</h2>
                <p>Khám phá các chủ đề hot nhất trên mạng xã hội Việt Nam.</p>
              </div>
            </div>
            <div className={cn(styles.promoCard, styles.promoGuide)}>
              <div className={styles.videoThumb}>
                <span className={styles.playBtn} aria-hidden>
                  ▶
                </span>
                <span className={styles.videoDuration}>20:35</span>
              </div>
              <div>
                <h3>Hướng dẫn sử dụng</h3>
                <p>Xem video hướng dẫn chi tiết các tính năng.</p>
              </div>
            </div>
            <div className={cn(styles.promoCard, styles.promoMethod)}>
              <Sparkles size={28} className={styles.promoIcon} aria-hidden />
              <div>
                <h3>Tóm tắt phương pháp luận</h3>
                <p>
                  YouTube: Trend = likes + comments×2 + ⌊views/100⌋×3 · Hot = likes +
                  comments×3 + ⌊views/100⌋×3 · Cảm xúc tạm = 0. Facebook: Hot = likes +
                  comments×2 + shares×3 + angry×4 · Trend = likes + comments×2 + shares×3.
                </p>
              </div>
            </div>
          </section>

          {error && (
            <div className={styles.emptyState} role="alert">
              {error}
              <div style={{ marginTop: 8 }}>
                <button type="button" className={styles.loadMoreBtn} onClick={() => loadDashboard()}>
                  Thử lại
                </button>
              </div>
            </div>
          )}

          <section className={styles.chartSection}>
            <div className={styles.chartHeader}>
              <h2>Biểu đồ so sánh các chủ đề hot nhất trên mạng xã hội</h2>
              <p>
                {periodLabel} · Xếp hạng theo {RANKED_BY_LABELS[rankedBy]}
              </p>
            </div>

            {loading && chartTopics.length === 0 ? (
              <div className={styles.emptyState}>
                <Loader2 size={20} className={styles.spin} aria-hidden /> Đang tải biểu đồ…
              </div>
            ) : chartTopics.length === 0 ? (
              <div className={styles.emptyState}>Chưa có dữ liệu social posts để vẽ biểu đồ.</div>
            ) : (
              <div className={styles.chartWrapper}>
                <div className={styles.yAxis}>
                  {yAxisLabels.map((label, idx) => (
                    <span key={`y-${idx}`}>{label}</span>
                  ))}
                </div>

                <div className={styles.chartArea}>
                  <div className={styles.chartGrid}>
                    {yAxisLabels.map((_, idx) => (
                      <div key={`g-${idx}`} className={styles.gridLine} />
                    ))}
                  </div>

                  <div className={styles.barsContainer}>
                    {chartTopics.map((item) => {
                      const value = chartValue(item, rankedBy);
                      const heightPct = (value / maxChartValue) * 100;
                      const isHovered = hoveredChartId === item.id;
                      return (
                        <div
                          key={item.id}
                          className={styles.barColumn}
                          onMouseEnter={() => setHoveredChartId(item.id)}
                          onMouseLeave={() => setHoveredChartId(null)}
                        >
                          <div className={styles.barTrack}>
                            <div className={styles.barGrow}>
                              <span className={styles.barValue}>{formatMetric(value)}</span>
                              <div
                                className={cn(styles.bar, isHovered && styles.barHovered)}
                                style={{ height: `${Math.max(heightPct, 2)}%` }}
                              />
                            </div>
                          </div>
                          <TopicThumbnail color={item.thumbnailColor} title={item.title} />
                          <span className={styles.barLabel}>{item.title}</span>
                        </div>
                      );
                    })}
                  </div>

                  {hoveredChartId && hoveredTopic && (
                    <div className={styles.tooltipAnchor}>
                      <ChartTooltip topic={hoveredTopic} rankedBy={rankedBy} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className={styles.statsBar}>
            <div className={styles.statCard} title="Tổng số subject đã có social_posts">
              <span>Tổng số chủ đề</span>
              <strong>{stats?.total ?? (loading ? '…' : 0)}</strong>
            </div>
            <div
              className={cn(styles.statCard, styles.statUptrend)}
              title={stats?.definitions?.uptrend}
            >
              <span>Uptrend</span>
              <strong>{stats?.uptrend ?? (loading ? '…' : 0)}</strong>
            </div>
            <div
              className={cn(styles.statCard, styles.statDowntrend)}
              title={stats?.definitions?.downtrend}
            >
              <span>Downtrend</span>
              <strong>{stats?.downtrend ?? (loading ? '…' : 0)}</strong>
            </div>
          </section>

          <section className={styles.rankingSection}>
            <div className={styles.rankingHeader}>
              <span className={styles.colRank}>Xếp hạng</span>
              <span className={styles.colTopic}>Tên chủ đề</span>
              <span className={styles.colMetrics}>Chỉ số phân tích</span>
              <span className={styles.colAction} />
            </div>

            <div className={styles.rankingList}>
              {loading && topics.length === 0 ? (
                <div className={styles.emptyState}>
                  <Loader2 size={20} className={styles.spin} aria-hidden /> Đang tải bảng xếp hạng…
                </div>
              ) : filteredTopics.length === 0 ? (
                <div className={styles.emptyState}>Không có chủ đề phù hợp bộ lọc.</div>
              ) : (
                filteredTopics.map((topic) => (
                  <RankingRow key={topic.id} topic={topic} onOpenDetail={openDetail} />
                ))
              )}
            </div>

            {canLoadMore && (
              <button
                type="button"
                className={styles.loadMoreBtn}
                disabled={loadingMore}
                onClick={() => loadDashboard({ page: page + 1, append: true })}
              >
                {loadingMore ? 'Đang tải…' : 'Xem thêm'}
              </button>
            )}
          </section>
        </main>
      </div>

      {supportOpen && (
        <div className={styles.supportWidget}>
          <button
            type="button"
            className={styles.supportClose}
            onClick={() => setSupportOpen(false)}
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
          <a href="#" className={styles.supportLink}>
            <Phone size={16} aria-hidden />
            Hotline Tư vấn
          </a>
          <a href="#" className={styles.supportLink}>
            <Crown size={16} aria-hidden />
            Giới thiệu tính năng Premium
          </a>
          <a href="#" className={styles.supportLink}>
            <BarChart3 size={16} aria-hidden />
            Hướng dẫn sử dụng
          </a>
        </div>
      )}

      <SubjectDetailModal
        open={detailOpen}
        subjectId={detailSubjectId}
        onClose={closeDetail}
        dateFrom={appliedDateFrom}
        dateTo={appliedDateTo}
      />
    </div>
  );
}
