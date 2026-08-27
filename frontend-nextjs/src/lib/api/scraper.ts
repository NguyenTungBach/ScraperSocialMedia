import { apiClient, type ApiResponse } from './client';

export interface YoutubeScrapePayload {
  channel_id: number[];
  maxResults?: number;
}

export interface YoutubeScrapeUpsertStats {
  inserted: number;
  updated: number;
  skipped: number;
  links_created: number;
  unmatched_channel: number;
}

export interface YoutubeCommentStats {
  inserted: number;
  updated: number;
  threads_upserted: number;
  videos_with_comments: number;
}

export interface YoutubeChannelSkipped {
  channel_id: number;
  name?: string;
  reason: string;
}

export interface YoutubeScrapeVideo {
  videoId: string;
  title?: string | null;
  publishedAt?: string | null;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  follow?: number;
  post_url?: string | null;
}

export interface YoutubeScrapeResult {
  source: string;
  channels_scraped: number;
  channels_skipped?: YoutubeChannelSkipped[];
  items_count: number;
  quota_used: number;
  upsert_stats: YoutubeScrapeUpsertStats;
  comment_stats?: YoutubeCommentStats;
  affected_subject_ids: number[];
  videos: YoutubeScrapeVideo[];
}

export const scraperApi = {
  runYoutube: (payload: YoutubeScrapePayload) =>
    apiClient.post<YoutubeScrapeResult>('/scraper/youtube/run', payload, {
      skipAuth: true,
      timeout: 180_000,
    }) as Promise<ApiResponse<YoutubeScrapeResult>>,
};
