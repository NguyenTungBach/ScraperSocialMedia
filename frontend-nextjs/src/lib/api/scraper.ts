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
  skipped?: number;
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

export type TikTokScrapePayload = YoutubeScrapePayload & {
  commentsPerPost?: number;
  maxRepliesPerComment?: number;
};

export type TikTokScrapeResult = Omit<YoutubeScrapeResult, 'quota_used'> & {
  platform?: string;
  quota_used?: number;
  video_run_id?: string | null;
  comments_run_id?: string | null;
};

export type FacebookScrapePayload = TikTokScrapePayload;

export type FacebookScrapeResult = Omit<TikTokScrapeResult, 'video_run_id' | 'videos'> & {
  posts?: Array<{
    postId: string;
    title?: string | null;
    publishedAt?: string | null;
    likeCount?: number;
    commentCount?: number;
    shareCount?: number;
    angryCount?: number;
    viewCount?: number;
    post_url?: string | null;
  }>;
  posts_run_id?: string | null;
  comment_stats?: YoutubeCommentStats & {
    posts_with_comments?: number;
    videos_with_comments?: number;
  };
};

export interface YoutubeTailRefreshPayload {
  batchSize?: number;
  headSize?: number;
  offset?: number;
}

export interface YoutubeTailRefreshResult {
  source: string;
  batch_size: number;
  offset: number;
  processed: number;
  updated: number;
  not_found: number;
  quota_used: number;
  total_tail: number;
  remaining: number;
  next_offset: number;
  affected_subject_ids: number[];
}

export const scraperApi = {
  runYoutube: (payload: YoutubeScrapePayload) =>
    apiClient.post<YoutubeScrapeResult>('/scraper/youtube/run', payload, {
      skipAuth: true,
      timeout: 1_800_000, // 30 phút — quét nhiều kênh + comment có thể rất lâu
    }) as Promise<ApiResponse<YoutubeScrapeResult>>,

  runTikTok: (payload: TikTokScrapePayload) =>
    apiClient.post<TikTokScrapeResult>('/scraper/tiktok/run', payload, {
      skipAuth: true,
      timeout: 1_800_000,
    }) as Promise<ApiResponse<TikTokScrapeResult>>,

  runFacebook: (payload: FacebookScrapePayload) =>
    apiClient.post<FacebookScrapeResult>('/scraper/facebook/run', payload, {
      skipAuth: true,
      timeout: 1_800_000,
    }) as Promise<ApiResponse<FacebookScrapeResult>>,

  refreshYoutubeTail: (payload: YoutubeTailRefreshPayload = {}) =>
    apiClient.post<YoutubeTailRefreshResult>('/scraper/youtube/refresh-tail', payload, {
      skipAuth: true,
      timeout: 600_000, // 10 phút / batch
    }) as Promise<ApiResponse<YoutubeTailRefreshResult>>,
};
