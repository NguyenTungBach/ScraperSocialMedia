export type RankedBy = 'discussion' | 'interaction' | 'sentiment';

export type TopicCategory = 'all' | 'movies' | 'music' | 'social-news' | 'slang' | 'travel';

export interface HotTopic {
  id: string;
  subjectId: number;
  rank: number;
  title: string;
  nickName: string;
  category: TopicCategory;
  categoryLabel: string;
  channelLabel?: string;
  channels?: { id: number; name: string; type_channel: string; url?: string }[];
  isNew?: boolean;
  thumbnailColor: string;
  discussion: number;
  discussionTrend: 'up' | 'down';
  interaction: number;
  sentiment: number;
  hotScore: number;
  trendScore: number;
  likes: number;
  comments: number;
  shares: number;
  angryCount: number;
  follow: number;
  postsCount: number;
  startDate: string;
}

export interface ChartTopic {
  id: string;
  title: string;
  discussion: number;
  interaction: number;
  sentiment: number;
  hotScore: number;
  trendScore: number;
  thumbnailColor: string;
  rank: number;
  categoryLabel: string;
  startDate: string;
  discussionTrend: 'up' | 'down';
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

const THUMB_COLORS = [
  '#c084fc',
  '#f97316',
  '#64748b',
  '#22c55e',
  '#3b82f6',
  '#14b8a6',
  '#eab308',
  '#ef4444',
  '#ec4899',
  '#6366f1',
];

export function colorForId(id: string | number): string {
  const n = typeof id === 'number' ? id : Number(id) || 0;
  return THUMB_COLORS[Math.abs(n) % THUMB_COLORS.length];
}

export function formatMetric(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1000) {
    const formatted = (value / 1000).toFixed(2).replace('.', ',');
    return `${formatted}K`;
  }
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace('.', ',');
}

export function formatScore(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (value >= 1000) return formatMetric(value);
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatShortDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

export function formatDateRangeLabel(iso?: string | null): string {
  if (!iso) {
    const now = new Date();
    return formatShortDate(now.toISOString());
  }
  const end = new Date(iso);
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return `${formatShortDate(start.toISOString())} - ${formatShortDate(end.toISOString())}`;
}
