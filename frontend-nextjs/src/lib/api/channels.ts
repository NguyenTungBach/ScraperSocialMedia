import { apiClient, type ApiResponse } from './client';
import type { SocialPostsPagination } from './socialPosts';

export interface ChannelItem {
  id: number;
  name: string;
  url: string;
  type_channel: string;
  scraper_runs_count?: number;
  has_scraper_runs?: boolean;
  /** false khi kênh đã có bài scrape — không cho sửa URL */
  can_edit_url?: boolean;
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
}

export const channelsApi = {
  list: (params: ChannelListParams = {}) =>
    apiClient.get<ChannelListData>('/channels', {
      skipAuth: true,
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 100,
        q: params.q || undefined,
        type_channel: params.type_channel || undefined,
      },
    }) as Promise<ApiResponse<ChannelListData>>,

  create: (payload: ChannelPayload) =>
    apiClient.post<ChannelItem>('/channels', payload, {
      skipAuth: true,
    }) as Promise<ApiResponse<ChannelItem>>,

  update: (id: number | string, payload: Partial<ChannelPayload>) =>
    apiClient.put<ChannelItem>(`/channels/${id}`, payload, {
      skipAuth: true,
    }) as Promise<ApiResponse<ChannelItem>>,

  remove: (id: number | string) =>
    apiClient.delete<{ id: number; deleted: boolean }>(`/channels/${id}`, {
      skipAuth: true,
    }) as Promise<ApiResponse<{ id: number; deleted: boolean }>>,
};
