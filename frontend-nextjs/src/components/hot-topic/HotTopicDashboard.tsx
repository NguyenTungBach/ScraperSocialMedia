'use client';

import { useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Compass,
  Crown,
  Film,
  Globe,
  Grid3X3,
  MessageCircle,
  Music,
  Newspaper,
  Phone,
  Plane,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react';
import {
  CHART_TOPICS,
  HOT_TOPICS,
  TOPIC_CATEGORIES,
  formatMetric,
  type HotTopic,
  type RankedBy,
  type TopicCategory,
} from '@/lib/mock/hotTopics';
import { cn } from '@/lib/utils';
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
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <div className={styles.thumbnail} style={{ backgroundColor: color }} aria-hidden>
      {initials}
    </div>
  );
}

function ChartTooltip({ topic }: { topic: HotTopic }) {
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
        {topic.startDate} - Hiện tại
      </div>
      <div className={styles.chartTooltipStats}>
        <div>
          <span>Thảo Luận</span>
          <strong>{formatMetric(topic.discussion)}</strong>
        </div>
        <div>
          <span>Tương Tác</span>
          <strong>{formatMetric(topic.interaction)}</strong>
        </div>
        <div>
          <span>Chỉ số cảm xúc</span>
          <strong className={topic.sentiment >= 0 ? styles.positive : styles.negative}>
            {topic.sentiment.toFixed(2).replace('.', ',')}
          </strong>
        </div>
      </div>
      <button type="button" className={styles.viewAnalysisBtn}>
        Xem phân tích
      </button>
    </div>
  );
}

function RankingRow({ topic }: { topic: HotTopic }) {
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
        </div>
      </div>

      <div className={styles.metrics}>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Tổng lượng thảo luận</span>
          <span className={styles.metricValue}>
            {formatMetric(topic.discussion)}
            {topic.discussionTrend === 'up' && (
              <TrendingUp size={14} className={styles.trendUp} aria-label="Tăng" />
            )}
            {topic.discussionTrend === 'down' && (
              <TrendingDown size={14} className={styles.trendDown} aria-label="Giảm" />
            )}
          </span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Tổng lượng tương tác</span>
          <span className={styles.metricValue}>{formatMetric(topic.interaction)}</span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Chỉ số cảm xúc</span>
          <span className={styles.metricValue}>
            {topic.sentiment.toFixed(2).replace('.', ',')}
            <SentimentFace value={topic.sentiment} />
          </span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Thương hiệu đang sát trend</span>
          <div className={styles.brandList}>
            {topic.brands.map((brand) => (
              <span key={brand} className={styles.brandChip} title={brand}>
                {brand.slice(0, 2).toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </div>

      <button type="button" className={styles.rowActionBtn}>
        Xem phân tích
      </button>
    </article>
  );
}

export function HotTopicDashboard() {
  const [selectedCategory, setSelectedCategory] = useState<TopicCategory>('all');
  const [rankedBy, setRankedBy] = useState<RankedBy>('discussion');
  const [showNewOnly, setShowNewOnly] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [supportOpen, setSupportOpen] = useState(true);
  const [hoveredChartId, setHoveredChartId] = useState<string | null>(null);

  const maxDiscussion = useMemo(
    () => Math.max(...CHART_TOPICS.map((t) => t.discussion)),
    []
  );

  const filteredTopics = useMemo(() => {
    return HOT_TOPICS.filter((topic) => {
      if (selectedCategory !== 'all' && topic.category !== selectedCategory) return false;
      if (showNewOnly && !topic.isNew) return false;
      return true;
    });
  }, [selectedCategory, showNewOnly]);

  const hoveredTopic = HOT_TOPICS.find((t) => t.id === hoveredChartId) ?? HOT_TOPICS[0];

  const yAxisLabels = ['100k', '80k', '60k', '40k', '20k', '0'];

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <span className={styles.logoSocial}>social</span>
            <span className={styles.logoTrend}>trend</span>
            <span className={styles.logoBy}>by Younet Media</span>
          </div>

          <nav className={styles.mainNav} aria-label="Main navigation">
            <a href="#" className={cn(styles.navLink, styles.navLinkActive)}>
              <BarChart3 size={16} aria-hidden />
              Xếp hạng
            </a>
            <a href="#" className={styles.navLink}>
              <Compass size={16} aria-hidden />
              Khám phá
            </a>
            <a href="#" className={styles.navLink}>
              <Crown size={16} aria-hidden />
              Bảng giá
            </a>
          </nav>

          <div className={styles.headerActions}>
            <button type="button" className={styles.searchBtn}>
              <Search size={16} aria-hidden />
              Tìm kiếm
            </button>
            <button type="button" className={styles.loginBtn}>
              Đăng nhập
            </button>
            <button type="button" className={styles.langBtn} aria-label="Ngôn ngữ">
              <Globe size={18} aria-hidden />
            </button>
          </div>
        </div>
      </header>

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
            <button type="button" className={styles.datePicker}>
              <Calendar size={15} aria-hidden />
              24 giờ trước
            </button>
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
                <span className={styles.playBtn} aria-hidden>▶</span>
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
                <p>Cách SocialTrend thu thập và phân tích dữ liệu MXH.</p>
              </div>
            </div>
          </section>

          <section className={styles.chartSection}>
            <div className={styles.chartHeader}>
              <h2>Biểu đồ so sánh các chủ đề hot nhất trên mạng xã hội</h2>
              <p>23/08/2026 - 24/08/2026 · Xếp hạng theo {RANKED_BY_LABELS[rankedBy]}</p>
            </div>

            <div className={styles.chartWrapper}>
              <div className={styles.yAxis}>
                {yAxisLabels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>

              <div className={styles.chartArea}>
                <div className={styles.chartGrid}>
                  {yAxisLabels.map((label) => (
                    <div key={label} className={styles.gridLine} />
                  ))}
                </div>

                <div className={styles.barsContainer}>
                  {CHART_TOPICS.map((item) => {
                    const heightPct = (item.discussion / maxDiscussion) * 100;
                    const isHovered = hoveredChartId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={styles.barColumn}
                        onMouseEnter={() => setHoveredChartId(item.id)}
                        onMouseLeave={() => setHoveredChartId(null)}
                      >
                        <span className={styles.barValue}>{formatMetric(item.discussion)}</span>
                        <div
                          className={cn(styles.bar, isHovered && styles.barHovered)}
                          style={{ height: `${heightPct}%` }}
                        />
                        <TopicThumbnail color={item.thumbnailColor} title={item.title} />
                        <span className={styles.barLabel}>{item.title}</span>
                      </div>
                    );
                  })}
                </div>

                {hoveredChartId && (
                  <div className={styles.tooltipAnchor}>
                    <ChartTooltip topic={hoveredTopic} />
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className={styles.statsBar}>
            <div className={styles.statCard}>
              <span>Tổng số chủ đề</span>
              <strong>120</strong>
            </div>
            <div className={cn(styles.statCard, styles.statUptrend)}>
              <span>Uptrend</span>
              <strong>30</strong>
            </div>
            <div className={cn(styles.statCard, styles.statDowntrend)}>
              <span>Downtrend</span>
              <strong>89</strong>
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
              {filteredTopics.length === 0 ? (
                <div className={styles.emptyState}>Không có chủ đề phù hợp bộ lọc.</div>
              ) : (
                filteredTopics.map((topic) => <RankingRow key={topic.id} topic={topic} />)
              )}
            </div>

            <button type="button" className={styles.loadMoreBtn}>
              Xem thêm
            </button>
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
    </div>
  );
}
