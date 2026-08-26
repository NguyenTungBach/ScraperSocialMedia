import { apiClient, type ApiResponse } from './client';
import type { ChannelItem } from './channels';

export type SocialPostSortBy =
  | 'hot_score'
  | 'trend_score'
  | 'discussion'
  | 'interaction'
  | 'sentiment';

export type TrendDirection = 'up' | 'down';

export interface SocialPostSubject {
  id: number;
  name: string;
  normalized_name?: string | null;
  status?: string;
  channels?: ChannelItem[];
}

export interface SocialPostItem {
  id: number;
  subject_id: number;
  likes: number;
  angry_count: number;
  comments: number;
  shares: number;
  posts_count: number;
  hot_score: number;
  trend_score: number;
  discussion: number;
  interaction: number;
  sentiment: number;
  trend_direction: TrendDirection;
  is_new: boolean;
  rank: number;
  computed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  subject?: SocialPostSubject | null;
}

export interface SocialPostStats {
  total: number;
  uptrend: number;
  downtrend: number;
  new_count: number;
  thresholds: {
    hot_score: number;
    trend_score: number;
  };
  definitions: {
    uptrend: string;
    downtrend: string;
  };
}

export interface SocialPostsPagination {
  display: number;
  total_records: number;
  per_page: number;
  current_page: number;
  total_pages: number;
}

export interface SocialPostsDashboard {
  stats: SocialPostStats;
  chart: SocialPostItem[];
  ranking: SocialPostItem[];
  pagination: SocialPostsPagination;
  sort_by: SocialPostSortBy;
  new_only: boolean;
  date_from?: string | null;
  date_to?: string | null;
}

export interface SocialPostsDashboardParams {
  page?: number;
  per_page?: number;
  sort_by?: SocialPostSortBy;
  new_only?: boolean;
  chart_limit?: number;
  date_from?: string;
  date_to?: string;
}

export const socialPostsApi = {
  getDashboard: (params: SocialPostsDashboardParams = {}) =>
    apiClient.get<SocialPostsDashboard>('/social-posts/dashboard', {
      skipAuth: true,
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 20,
        sort_by: params.sort_by ?? 'discussion',
        new_only: params.new_only ? 'true' : 'false',
        chart_limit: params.chart_limit ?? 10,
        date_from: params.date_from || undefined,
        date_to: params.date_to || undefined,
      },
    }) as Promise<ApiResponse<SocialPostsDashboard>>,

  getStats: (params: { date_from?: string; date_to?: string } = {}) =>
    apiClient.get<SocialPostStats>('/social-posts/stats', {
      skipAuth: true,
      params: {
        date_from: params.date_from || undefined,
        date_to: params.date_to || undefined,
      },
    }),

  list: (params: Omit<SocialPostsDashboardParams, 'chart_limit'> = {}) =>
    apiClient.get<{ result: SocialPostItem[]; pagination: SocialPostsPagination }>(
      '/social-posts',
      {
        skipAuth: true,
        params: {
          page: params.page ?? 1,
          per_page: params.per_page ?? 20,
          sort_by: params.sort_by ?? 'hot_score',
          new_only: params.new_only ? 'true' : 'false',
          date_from: params.date_from || undefined,
          date_to: params.date_to || undefined,
        },
      }
    ),
};
