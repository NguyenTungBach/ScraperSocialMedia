import { apiClient, type ApiResponse } from './client';
import {
  getLatestScraperAsyncStatus,
  waitForScraperAsyncJob,
  type ScraperAsyncStatusData,
} from './scraper';

export interface PostCommentItem {
  id: number;
  scraper_run_id: number;
  platform_comment_id: string;
  parent_platform_comment_id?: string | null;
  thread_key: string;
  author?: string | null;
  text: string;
  like_count: number;
  published_at?: string | null;
  sort_order: number;
  group_type: 'lone' | 'thread';
  classified_as?: 'negative' | 'normal' | 'unknown' | null;
  sentiment?: string | null;
  category?: string | null;
  severity?: string | null;
  reason?: string | null;
  analysis_status: 'pending' | 'done' | 'skipped';
  scraped_at?: string | null;
}

export interface CommentThreadItem {
  id: number;
  thread_key: string;
  root_comment_id?: number | null;
  comment_count: number;
  classified_as?: 'negative' | 'debate' | 'unknown' | null;
  has_negativity: boolean;
  sentiment?: string | null;
  category?: string | null;
  severity?: string | null;
  reason?: string | null;
  analysis_status: 'pending' | 'done' | 'skipped';
  analyzed_at?: string | null;
  comments: PostCommentItem[];
}

export interface ScraperRunComments {
  lone: PostCommentItem[];
  threads: CommentThreadItem[];
  meta?: {
    analyzed: boolean;
    analyzed_lone_count: number;
    analyzed_thread_count: number;
    pending_lone_count?: number;
    pending_thread_count?: number;
  };
}

export interface CommentSummary {
  total: number;
  lone_count: number;
  thread_count: number;
  negative_count: number;
  debate_count: number;
  analyzed: boolean;
}

export interface CommentAnalyzeEnqueueResult {
  async_job_id: number;
  job_type: 'comment_analysis';
  scope_key: string;
  status: string;
  queue_job_id: number | null;
  attempts: number;
  error_message: string | null;
  payload_json?: {
    scraper_run_id?: number;
    max_comments?: number;
    max_replies?: number;
  } | null;
  result_json?: unknown;
  started_at?: string | null;
  finished_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CommentAnalyzeLimits {
  max_comments?: number;
  max_replies?: number;
}

export const DEFAULT_ANALYZE_MAX_COMMENTS = 30;
export const DEFAULT_ANALYZE_MAX_REPLIES = 10;

export const commentsApi = {
  getByScraperRun: (scraperRunId: number) =>
    apiClient.get<ScraperRunComments>('/comments', {
      params: { scraper_run_id: scraperRunId },
    }) as Promise<ApiResponse<ScraperRunComments>>,

  /** Enqueue phân tích comment (async) — trả async_job_id để poll. */
  analyze: (scraperRunId: number, limits?: CommentAnalyzeLimits) =>
    apiClient.post<CommentAnalyzeEnqueueResult>('/comments/analyze', {
      scraper_run_id: scraperRunId,
      max_comments: limits?.max_comments ?? DEFAULT_ANALYZE_MAX_COMMENTS,
      max_replies: limits?.max_replies ?? DEFAULT_ANALYZE_MAX_REPLIES,
    }) as Promise<ApiResponse<CommentAnalyzeEnqueueResult>>,

  getLatestAnalysisJob: (scraperRunId: number) =>
    getLatestScraperAsyncStatus('comment_analysis', `scraper_run:${scraperRunId}`),

  waitForAnalysisJob: (
    asyncJobId: number,
    options?: Parameters<typeof waitForScraperAsyncJob>[1]
  ) => waitForScraperAsyncJob(asyncJobId, options),
};

export type { ScraperAsyncStatusData };
