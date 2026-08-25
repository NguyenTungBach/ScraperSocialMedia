import { apiClient, type ApiResponse } from './client';
import type { SocialPostItem, SocialPostsPagination, TrendDirection } from './socialPosts';

export interface SubjectInfo {
  id: number;
  name: string;
  normalized_name?: string | null;
  item_type?: string;
  status?: string;
  source?: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SubjectAggregate {
  likes: number;
  comments: number;
  shares: number;
  angry_count: number;
  posts_count: number;
  hot_score: number;
  trend_score: number;
  discussion: number;
  interaction: number;
  sentiment: number;
  trend_direction: TrendDirection;
  is_new?: boolean;
  computed_at?: string | null;
}

export interface SubjectRelatedPost {
  id: number;
  platform: string;
  platform_post_id: string;
  post_url?: string | null;
  title?: string | null;
  text?: string | null;
  likes: number;
  comments: number;
  shares: number;
  angry_count: number;
  posted_at?: string | null;
  scraped_at?: string | null;
  source?: string;
  external_run_id?: string | null;
  scraper_id?: string | null;
  hot_score: number;
  trend_score: number;
  discussion: number;
  interaction: number;
  sentiment: number;
  linked_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type SubjectPostsSortBy =
  | 'posted_at'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'interaction'
  | 'hot_score';

export interface SubjectDetail {
  subject: SubjectInfo;
  aggregate: SubjectAggregate | SocialPostItem;
  posts: SubjectRelatedPost[];
  pagination: SocialPostsPagination;
  sort_by: SubjectPostsSortBy;
}

export interface SubjectDetailParams {
  page?: number;
  per_page?: number;
  sort_by?: SubjectPostsSortBy;
}

export const subjectsApi = {
  getById: (id: number | string, params: SubjectDetailParams = {}) =>
    apiClient.get<SubjectDetail>(`/subjects/${id}`, {
      skipAuth: true,
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 20,
        sort_by: params.sort_by ?? 'posted_at',
      },
    }) as Promise<ApiResponse<SubjectDetail>>,
};
