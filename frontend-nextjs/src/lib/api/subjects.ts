import { apiClient, type ApiResponse } from './client';
import type { ChannelItem } from './channels';
import type { CommentSummary } from './comments';
import type { SocialPostItem, SocialPostsPagination, TrendDirection } from './socialPosts';

export type { ChannelItem, CommentSummary };

export interface SubjectInfo {
  id: number;
  name: string;
  normalized_name?: string | null;
  item_type?: string;
  status?: string;
  source?: string;
  created_at?: string | null;
  updated_at?: string | null;
  channels?: ChannelItem[];
}

export interface SubjectAggregate {
  likes: number;
  comments: number;
  shares: number;
  angry_count: number;
  follow: number;
  views?: number;
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

export interface SubjectListItem extends SubjectInfo {
  scraper_runs_count: number;
  has_scraper_runs: boolean;
  can_delete: boolean;
  socialPost?: SocialPostItem | null;
  aggregate: SubjectAggregate;
}

export interface SubjectListParams {
  page?: number;
  per_page?: number;
  status?: string;
  q?: string;
}

export interface SubjectListData {
  result: SubjectListItem[];
  pagination: SocialPostsPagination;
}

export interface SubjectCreatePayload {
  name: string;
  normalized_name?: string | null;
  item_type?: string;
  status?: string;
  source?: string;
  channel_ids?: number[];
}

export interface SubjectUpdatePayload {
  name?: string;
  normalized_name?: string | null;
  item_type?: string;
  status?: string;
  channel_ids?: number[];
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
  follow: number;
  views?: number;
  posted_at?: string | null;
  scraped_at?: string | null;
  source?: string;
  external_run_id?: string | null;
  scraper_id?: string | null;
  channel_id?: number | null;
  hot_score: number;
  trend_score: number;
  discussion: number;
  interaction: number;
  sentiment: number;
  linked_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  comment_summary?: CommentSummary;
  content_brief?: string | null;
  content_brief_status?: 'not_start' | 'pending' | 'done' | 'skipped';
  content_brief_at?: string | null;
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
  posts_by_platform?: Record<string, number>;
  pagination: SocialPostsPagination;
  sort_by: SubjectPostsSortBy;
  platform?: string | null;
  date_from?: string | null;
  date_to?: string | null;
}

export interface SubjectDetailParams {
  page?: number;
  per_page?: number;
  sort_by?: SubjectPostsSortBy;
  platform?: string;
  date_from?: string;
  date_to?: string;
}

export const subjectsApi = {
  list: (params: SubjectListParams = {}) =>
    apiClient.get<SubjectListData>('/subjects', {
      skipAuth: true,
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 20,
        status: params.status,
        q: params.q || undefined,
      },
    }) as Promise<ApiResponse<SubjectListData>>,

  create: (payload: SubjectCreatePayload) =>
    apiClient.post<SubjectListItem>('/subjects', payload, {
      skipAuth: true,
    }) as Promise<ApiResponse<SubjectListItem>>,

  update: (id: number | string, payload: SubjectUpdatePayload) =>
    apiClient.put<SubjectListItem>(`/subjects/${id}`, payload, {
      skipAuth: true,
    }) as Promise<ApiResponse<SubjectListItem>>,

  remove: (id: number | string) =>
    apiClient.delete<{ id: number; deleted: boolean }>(`/subjects/${id}`, {
      skipAuth: true,
    }) as Promise<ApiResponse<{ id: number; deleted: boolean }>>,

  getById: (id: number | string, params: SubjectDetailParams = {}) =>
    apiClient.get<SubjectDetail>(`/subjects/${id}`, {
      skipAuth: true,
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 20,
        sort_by: params.sort_by ?? 'posted_at',
        platform: params.platform || undefined,
        date_from: params.date_from || undefined,
        date_to: params.date_to || undefined,
      },
    }) as Promise<ApiResponse<SubjectDetail>>,
};
