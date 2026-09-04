import { apiClient, type ApiResponse } from './client';

export interface SnapshotRunResult {
  ok?: boolean;
  needs_confirm?: boolean;
  message?: string;
  overwritten?: boolean;
  snapshot_date?: string;
  channel_id?: number;
  scraper_run_id?: number;
  channels?: number;
  posts?: number;
  top_comments?: number;
  captured_at?: string;
}

export interface SnapshotStatus {
  snapshot_date: string;
  exists: boolean;
}

export interface ChannelDailySnapshotRow {
  id?: number;
  channel_id: number;
  snapshot_date: string;
  platform: string;
  followers: number;
  post_count_channel: number;
  post_count_tracked: number;
  views_sum: number;
  likes_sum: number;
  comments_sum: number;
  shares_sum: number;
  angry_sum: number;
  captured_at?: string;
  channel?: {
    id: number;
    name?: string;
    type_channel?: string;
    url?: string;
  } | null;
}

export interface ChannelSnapshotDetail {
  channel_id: number;
  snapshot_date: string;
  snapshot: ChannelDailySnapshotRow | null;
  previous_date?: string | null;
  previous?: ChannelDailySnapshotRow | null;
  delta?: Record<string, number> | null;
  series?: ChannelDailySnapshotRow[];
  date_from?: string | null;
  date_to?: string | null;
}

export interface ChannelTopPostRow {
  id: number;
  scraper_run_id: number;
  channel_id: number;
  snapshot_date: string;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  angry_count: number;
  hot_score: number | string;
  trend_score: number | string;
  scraperRun?: {
    id: number;
    title?: string | null;
    post_url?: string | null;
    platform?: string;
    posted_at?: string | null;
  } | null;
}

export interface PostDailySnapshotRow {
  id?: number;
  scraper_run_id: number;
  channel_id: number;
  snapshot_date: string;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  angry_count: number;
  hot_score?: number | string;
  trend_score?: number | string;
  scraperRun?: {
    id: number;
    title?: string | null;
    post_url?: string | null;
    platform?: string;
  } | null;
  channel?: {
    id: number;
    name?: string;
    type_channel?: string;
  } | null;
}

export interface PostSnapshotDetail {
  scraper_run_id: number;
  snapshot_date?: string;
  snapshot?: PostDailySnapshotRow | null;
  previous_date?: string | null;
  previous?: PostDailySnapshotRow | null;
  delta?: Record<string, number> | null;
  series?: PostDailySnapshotRow[];
  date_from?: string | null;
  date_to?: string | null;
}

export interface CompareChannelsResult {
  channel_ids: number[];
  date_from?: string | null;
  date_to?: string | null;
  result: ChannelDailySnapshotRow[];
}

export interface ComparePostsResult {
  scraper_run_ids: number[];
  date_from?: string | null;
  date_to?: string | null;
  result: PostDailySnapshotRow[];
}

export interface PostCatalogItem {
  id: number;
  platform: string;
  title?: string | null;
  text?: string | null;
  post_url?: string | null;
  channel_id?: number | null;
  posted_at?: string | null;
  views?: number;
  likes?: number;
  comments?: number;
  channel?: {
    id: number;
    name?: string;
    type_channel?: string;
  } | null;
}

export interface PostCatalogResult {
  result: PostCatalogItem[];
  pagination: {
    display: number;
    total_records: number;
    per_page: number;
    current_page: number;
    total_pages: number;
  };
}

export const snapshotsApi = {
  run: (
    payload: {
      force?: boolean;
      snapshot_date?: string;
      channel_id?: number;
      scraper_run_id?: number;
    } = {}
  ) =>
    apiClient.post<SnapshotRunResult>('/snapshots/run', payload, {}) as Promise<ApiResponse<SnapshotRunResult>>,

  status: (date = 'today') =>
    apiClient.get<SnapshotStatus>('/snapshots/status', {params: { date },
    }) as Promise<ApiResponse<SnapshotStatus>>,

  channelDetail: (
    channelId: number | string,
    params: { date?: string; date_from?: string; date_to?: string } = {}
  ) =>
    apiClient.get<ChannelSnapshotDetail>(`/snapshots/channels/${channelId}`, {params,
    }) as Promise<ApiResponse<ChannelSnapshotDetail>>,

  channelTopPosts: (
    channelId: number | string,
    params: { date?: string; sort?: 'hot_score' | 'trend_score'; limit?: number } = {}
  ) =>
    apiClient.get<{
      channel_id: number;
      snapshot_date: string;
      sort: string;
      result: ChannelTopPostRow[];
    }>(`/snapshots/channels/${channelId}/top-posts`, {params,
    }) as Promise<
      ApiResponse<{
        channel_id: number;
        snapshot_date: string;
        sort: string;
        result: ChannelTopPostRow[];
      }>
    >,

  postDetail: (
    scraperRunId: number | string,
    params: { date?: string; date_from?: string; date_to?: string } = {}
  ) =>
    apiClient.get<PostSnapshotDetail>(`/snapshots/posts/${scraperRunId}`, {params,
    }) as Promise<ApiResponse<PostSnapshotDetail>>,

  postTopComments: (
    scraperRunId: number | string,
    params: { date?: string } = {}
  ) =>
    apiClient.get<{
      scraper_run_id: number;
      snapshot_date: string;
      result: Array<{
        id?: number;
        rank: number;
        author?: string | null;
        text?: string | null;
        like_count: number;
      }>;
    }>(`/snapshots/posts/${scraperRunId}/top-comments`, {params,
    }) as Promise<
      ApiResponse<{
        scraper_run_id: number;
        snapshot_date: string;
        result: Array<{
          id?: number;
          rank: number;
          author?: string | null;
          text?: string | null;
          like_count: number;
        }>;
      }>
    >,

  compareChannels: (params: {
    channel_ids: Array<number | string> | string;
    date_from?: string;
    date_to?: string;
  }) =>
    apiClient.get<CompareChannelsResult>('/snapshots/channels/compare', {params: {
        channel_ids: Array.isArray(params.channel_ids)
          ? params.channel_ids.join(',')
          : params.channel_ids,
        date_from: params.date_from || undefined,
        date_to: params.date_to || undefined,
      },
    }) as Promise<ApiResponse<CompareChannelsResult>>,

  comparePosts: (params: {
    scraper_run_ids: Array<number | string> | string;
    date_from?: string;
    date_to?: string;
  }) =>
    apiClient.get<ComparePostsResult>('/snapshots/posts/compare', {params: {
        scraper_run_ids: Array.isArray(params.scraper_run_ids)
          ? params.scraper_run_ids.join(',')
          : params.scraper_run_ids,
        date_from: params.date_from || undefined,
        date_to: params.date_to || undefined,
      },
    }) as Promise<ApiResponse<ComparePostsResult>>,

  catalogPosts: (params: {
    channel_id?: number | string;
    q?: string;
    page?: number;
    per_page?: number;
  } = {}) =>
    apiClient.get<PostCatalogResult>('/snapshots/posts/catalog', {params: {
        channel_id: params.channel_id || undefined,
        q: params.q || undefined,
        page: params.page ?? 1,
        per_page: params.per_page ?? 50,
      },
    }) as Promise<ApiResponse<PostCatalogResult>>,
};
