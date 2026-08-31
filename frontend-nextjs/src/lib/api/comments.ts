import { apiClient, type ApiResponse } from './client';

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

export interface CommentAnalyzeResult {
  scraper_run_id: number;
  content_brief: {
    analyzed: boolean;
    reason?: string;
    content_brief?: string | null;
  };
  comments_analysis: {
    analyzed: boolean;
    reason?: string;
    scraper_run_id: number;
    model?: string;
  };
  comments: ScraperRunComments;
}

export const commentsApi = {
  getByScraperRun: (scraperRunId: number) =>
    apiClient.get<ScraperRunComments>('/comments', {
      params: { scraper_run_id: scraperRunId },
      skipAuth: true,
    }) as Promise<ApiResponse<ScraperRunComments>>,

  analyze: (scraperRunId: number) =>
    apiClient.post<CommentAnalyzeResult>(
      '/comments/analyze',
      { scraper_run_id: scraperRunId },
      {
        skipAuth: true,
        timeout: 1_800_000,
      }
    ) as Promise<ApiResponse<CommentAnalyzeResult>>,
};
