export type TopicCategory =
  | 'all'
  | 'movies'
  | 'music'
  | 'social-news'
  | 'slang'
  | 'travel';

export type RankedBy = 'discussion' | 'interaction' | 'sentiment';

export interface HotTopic {
  id: string;
  rank: number;
  title: string;
  category: TopicCategory;
  categoryLabel: string;
  isNew?: boolean;
  thumbnailColor: string;
  discussion: number;
  discussionTrend: 'up' | 'down' | 'neutral';
  interaction: number;
  sentiment: number;
  brands: string[];
  startDate: string;
}

export interface ChartTopic {
  id: string;
  title: string;
  discussion: number;
  thumbnailColor: string;
}

export const TOPIC_CATEGORIES: {
  id: TopicCategory;
  label: string;
  icon: string;
}[] = [
  { id: 'all', label: 'Tất cả', icon: 'grid' },
  { id: 'movies', label: 'Phim ảnh', icon: 'film' },
  { id: 'music', label: 'Âm nhạc', icon: 'music' },
  { id: 'social-news', label: 'Tin tức MXH', icon: 'news' },
  { id: 'slang', label: 'Social Slang', icon: 'message' },
  { id: 'travel', label: 'Du lịch', icon: 'plane' },
];

export const CHART_TOPICS: ChartTopic[] = [
  { id: '1', title: 'Miss World 2026', discussion: 80490, thumbnailColor: '#c084fc' },
  { id: '2', title: 'Black Myth Wukong', discussion: 56750, thumbnailColor: '#f97316' },
  { id: '3', title: 'iPhone 17', discussion: 45200, thumbnailColor: '#64748b' },
  { id: '4', title: 'V-League 2026', discussion: 38100, thumbnailColor: '#22c55e' },
  { id: '5', title: 'Son Tung MTP', discussion: 29800, thumbnailColor: '#3b82f6' },
  { id: '6', title: 'Da Lat Travel', discussion: 24500, thumbnailColor: '#14b8a6' },
  { id: '7', title: 'Gen Z Slang', discussion: 19200, thumbnailColor: '#eab308' },
  { id: '8', title: 'Netflix Vietnam', discussion: 15800, thumbnailColor: '#ef4444' },
  { id: '9', title: 'K-pop Comeback', discussion: 12400, thumbnailColor: '#ec4899' },
  { id: '10', title: 'Startup Việt', discussion: 9800, thumbnailColor: '#6366f1' },
];

export const HOT_TOPICS: HotTopic[] = [
  {
    id: '1',
    rank: 1,
    title: 'Miss World 2026',
    category: 'social-news',
    categoryLabel: 'Tin tức MXH',
    isNew: true,
    thumbnailColor: '#c084fc',
    discussion: 50490,
    discussionTrend: 'down',
    interaction: 435600,
    sentiment: 0.14,
    brands: ['Vinamilk', 'Pepsi', 'Samsung'],
    startDate: '03/08',
  },
  {
    id: '2',
    rank: 2,
    title: 'Black Myth: Wukong',
    category: 'social-news',
    categoryLabel: 'Tin tức MXH',
    thumbnailColor: '#f97316',
    discussion: 48200,
    discussionTrend: 'up',
    interaction: 312400,
    sentiment: 0.62,
    brands: ['NVIDIA', 'Steam'],
    startDate: '15/07',
  },
  {
    id: '3',
    rank: 3,
    title: 'iPhone 17 Series',
    category: 'social-news',
    categoryLabel: 'Tin tức MXH',
    thumbnailColor: '#64748b',
    discussion: 42100,
    discussionTrend: 'up',
    interaction: 289100,
    sentiment: 0.38,
    brands: ['Apple', 'FPT Shop'],
    startDate: '01/08',
  },
  {
    id: '4',
    rank: 4,
    title: 'V-League mùa giải 2026',
    category: 'social-news',
    categoryLabel: 'Tin tức MXH',
    isNew: true,
    thumbnailColor: '#22c55e',
    discussion: 38500,
    discussionTrend: 'down',
    interaction: 198700,
    sentiment: -0.12,
    brands: ['Viettel', 'Castrol'],
    startDate: '20/08',
  },
  {
    id: '5',
    rank: 5,
    title: 'Son Tung MTP - Concert Tour',
    category: 'music',
    categoryLabel: 'Âm nhạc',
    thumbnailColor: '#3b82f6',
    discussion: 35200,
    discussionTrend: 'up',
    interaction: 456800,
    sentiment: 0.71,
    brands: ['Pepsi', 'Shopee'],
    startDate: '10/06',
  },
  {
    id: '6',
    rank: 6,
    title: 'Du lịch Đà Lạt mùa hè',
    category: 'travel',
    categoryLabel: 'Du lịch',
    thumbnailColor: '#14b8a6',
    discussion: 29800,
    discussionTrend: 'neutral',
    interaction: 124500,
    sentiment: 0.45,
    brands: ['Vietnam Airlines', 'Agoda'],
    startDate: '05/07',
  },
];

export function formatMetric(value: number): string {
  if (value >= 1000) {
    const formatted = (value / 1000).toFixed(2).replace('.', ',');
    return `${formatted}K`;
  }
  return String(value);
}
