import { apiClient, type ApiResponse } from './client';
import type { SocialPostsPagination } from './socialPosts';

export interface ChannelItem {
  id: number;
  name: string;
  url: string;
  type_channel: string;
  followers?: number;
  post_count?: number;
  max_posts?: number;
  max_top_comments?: number;
  max_replies?: number;
  scraper_runs_count?: number;
  has_scraper_runs?: boolean;
  /** Luôn false — URL cố định sau khi lưu (mọi nền tảng) */
  can_edit_url?: boolean;
  /** Luôn false — nền tảng cố định sau khi lưu */
  can_edit_type_channel?: boolean;
  /** false khi đã có scraper_runs thuộc kênh này */
  can_delete?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ChannelListParams {
  page?: number;
  per_page?: number;
  q?: string;
  type_channel?: string;
}

export interface ChannelListData {
  result: ChannelItem[];
  pagination: SocialPostsPagination;
}

export interface ChannelPayload {
  name: string;
  url: string;
  type_channel?: string;
  max_posts?: number;
  max_top_comments?: number;
  max_replies?: number;
}

export const channelsApi = {
  list: (params: ChannelListParams = {}) =>
    apiClient.get<ChannelListData>('/channels', {params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 100,
        q: params.q || undefined,
        type_channel: params.type_channel || undefined,
      },
    }) as Promise<ApiResponse<ChannelListData>>,

  create: (payload: ChannelPayload) =>
    apiClient.post<ChannelItem>('/channels', payload, {}) as Promise<ApiResponse<ChannelItem>>,

  update: (id: number | string, payload: Partial<ChannelPayload>) =>
    apiClient.put<ChannelItem>(`/channels/${id}`, payload, {}) as Promise<ApiResponse<ChannelItem>>,

  remove: (id: number | string) =>
    apiClient.delete<{ id: number; deleted: boolean }>(`/channels/${id}`, {}) as Promise<ApiResponse<{ id: number; deleted: boolean }>>,
};
