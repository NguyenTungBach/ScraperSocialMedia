import { apiClient, ApiRequestError, type ApiResponse } from './client';

export interface YoutubeScrapePayload {
  channel_id: number[];
  maxResults?: number;
  subject_id?: number;
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
  comments_inserted?: number;
  replies_inserted?: number;
  comments_updated?: number;
  replies_updated?: number;
  threads_upserted: number;
  videos_with_comments: number;
  posts_with_comments?: number;
  ai_briefs_analyzed?: number;
  ai_comments_analyzed?: number;
  ai_skipped?: number;
}

export interface YoutubeChannelSkipped {
  channel_id: number;
  name?: string;
  reason: string;
}

/** Lightweight summary stored on async job result_json (no video/post lists). */
export interface ScraperResultSummary {
  source?: string | null;
  platform?: string | null;
  channels_scraped?: number;
  channels_skipped?: YoutubeChannelSkipped[];
  items_count?: number;
  upsert_stats?: YoutubeScrapeUpsertStats;
  comment_stats?: YoutubeCommentStats & {
    posts_with_comments?: number;
  };
  affected_subject_ids?: number[];
  quota_used?: number;
  video_run_id?: string | null;
  comments_run_id?: string | null;
  posts_run_id?: string | null;
}

export type ScraperAsyncJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'stale';

export type ScraperAsyncJobType =
  | 'youtube_scrape'
  | 'tiktok_scrape'
  | 'facebook_scrape';

export interface ScraperAsyncStatusData {
  async_job_id: number;
  job_type: ScraperAsyncJobType;
  scope_key: string;
  status: ScraperAsyncJobStatus;
  queue_job_id: number | null;
  attempts: number;
  error_message: string | null;
  payload_json?: {
    channel_id?: number[];
    channel_names?: Array<{ id: number; name: string }>;
    subject_id?: number;
    subject_name?: string;
    maxResults?: number;
    commentsPerPost?: number;
    maxRepliesPerComment?: number;
  } | null;
  result_json: ScraperResultSummary | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type TikTokScrapePayload = YoutubeScrapePayload & {
  commentsPerPost?: number;
  maxRepliesPerComment?: number;
};

export type FacebookScrapePayload = TikTokScrapePayload;

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

const TERMINAL_STATUSES = new Set<ScraperAsyncJobStatus>(['completed', 'failed', 'stale']);
const DEFAULT_POLL_INTERVAL_MS = 2500;
const DEFAULT_MAX_POLL_MS = 60 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function isScraperAsyncInProgress(status: ScraperAsyncJobStatus | undefined): boolean {
  return status === 'pending' || status === 'running';
}

export async function getScraperAsyncStatus(
  asyncJobId: number
): Promise<ApiResponse<ScraperAsyncStatusData>> {
  return apiClient.get<ScraperAsyncStatusData>(`/scraper/async-status/${asyncJobId}`);
}

export async function getLatestScraperAsyncStatus(
  jobType: ScraperAsyncJobType,
  scopeKey: string
): Promise<ApiResponse<ScraperAsyncStatusData | null>> {
  return apiClient.get<ScraperAsyncStatusData | null>('/scraper/async-status', {
    params: { job_type: jobType, scope_key: scopeKey },
  });
}

export async function listActiveScraperJobs(): Promise<
  ApiResponse<ScraperAsyncStatusData[]>
> {
  return apiClient.get<ScraperAsyncStatusData[]>('/scraper/async-active');
}

export async function waitForScraperAsyncJob(
  asyncJobId: number,
  options?: {
    intervalMs?: number;
    maxWaitMs?: number;
    isCancelled?: () => boolean;
    onStatus?: (status: ScraperAsyncStatusData) => void;
  }
): Promise<ScraperAsyncStatusData> {
  const intervalMs = options?.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxWaitMs = options?.maxWaitMs ?? DEFAULT_MAX_POLL_MS;
  const startedAt = Date.now();

  while (Date.now() - startedAt < maxWaitMs) {
    if (options?.isCancelled?.()) {
      throw new Error('Scraper poll cancelled');
    }

    const response = await getScraperAsyncStatus(asyncJobId);
    const status = response.data;
    if (!status) {
      throw new Error('Scraper job status not found');
    }

    options?.onStatus?.(status);

    if (TERMINAL_STATUSES.has(status.status)) {
      return status;
    }

    await sleep(intervalMs);
  }

  throw new Error('Scraper poll timed out');
}

/**
 * Enqueue a scrape, then poll until terminal. On 409, returns the existing active job status after polling it.
 */
export async function runAndWaitScraperJob(
  enqueue: () => Promise<ApiResponse<ScraperAsyncStatusData>>,
  options?: Parameters<typeof waitForScraperAsyncJob>[1]
): Promise<ScraperAsyncStatusData> {
  try {
    const enqueued = await enqueue();
    const asyncJobId = enqueued.data?.async_job_id;
    if (asyncJobId == null) {
      throw new Error('Missing async_job_id from enqueue response');
    }
    return waitForScraperAsyncJob(asyncJobId, options);
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 409) {
      throw err;
    }
    throw err;
  }
}

export function normalizeScraperResultJson(
  value: ScraperAsyncStatusData['result_json'] | string | null | undefined
): ScraperResultSummary | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as ScraperResultSummary;
    } catch {
      return null;
    }
  }
  return value;
}

export function aggregateScrapeSummaries(statuses: ScraperAsyncStatusData[]): {
  count: number;
  inserted: number;
  updated: number;
  commentsInserted: number;
  repliesInserted: number;
  commentsUpdated: number;
  repliesUpdated: number;
  aiBriefs: number;
  aiComments: number;
  aiSkipped: number;
  failed: ScraperAsyncStatusData[];
} {
  let count = 0;
  let inserted = 0;
  let updated = 0;
  let commentsInserted = 0;
  let repliesInserted = 0;
  let commentsUpdated = 0;
  let repliesUpdated = 0;
  let aiBriefs = 0;
  let aiComments = 0;
  let aiSkipped = 0;
  const failed: ScraperAsyncStatusData[] = [];

  for (const status of statuses) {
    if (status.status === 'completed') {
      const summary = normalizeScraperResultJson(status.result_json);
      const cs = summary?.comment_stats;
      count += Number(summary?.items_count ?? 0);
      inserted += Number(summary?.upsert_stats?.inserted ?? 0);
      updated += Number(summary?.upsert_stats?.updated ?? 0);

      const totalInserted = Number(cs?.inserted ?? 0);
      const splitComments = Number(cs?.comments_inserted ?? 0);
      const splitReplies = Number(cs?.replies_inserted ?? 0);
      // Job cũ chưa có split → gộp vào comment để không mất số
      if (cs?.comments_inserted != null || cs?.replies_inserted != null) {
        commentsInserted += splitComments;
        repliesInserted += splitReplies;
      } else {
        commentsInserted += totalInserted;
      }

      commentsUpdated += Number(cs?.comments_updated ?? 0);
      repliesUpdated += Number(cs?.replies_updated ?? 0);
      aiBriefs += Number(cs?.ai_briefs_analyzed ?? 0);
      aiComments += Number(cs?.ai_comments_analyzed ?? 0);
      aiSkipped += Number(cs?.ai_skipped ?? 0);
    } else {
      failed.push(status);
    }
  }

  return {
    count,
    inserted,
    updated,
    commentsInserted,
    repliesInserted,
    commentsUpdated,
    repliesUpdated,
    aiBriefs,
    aiComments,
    aiSkipped,
    failed,
  };
}

export function formatScrapeSuccessToast(
  label: string,
  agg: ReturnType<typeof aggregateScrapeSummaries>
): string {
  const parts = [
    `Đã quét ${agg.count} bài từ "${label}" (${agg.inserted} bài mới, ${agg.updated} bài cập nhật chỉ số)`,
  ];

  const commentParts: string[] = [];
  if (agg.commentsInserted > 0) commentParts.push(`${agg.commentsInserted} comment mới`);
  if (agg.repliesInserted > 0) commentParts.push(`${agg.repliesInserted} reply mới`);
  if (agg.commentsUpdated > 0) commentParts.push(`${agg.commentsUpdated} comment cập nhật`);
  if (agg.repliesUpdated > 0) commentParts.push(`${agg.repliesUpdated} reply cập nhật`);
  if (commentParts.length > 0) {
    parts.push(commentParts.join(', '));
  }

  const aiParts: string[] = [];
  if (agg.aiBriefs > 0) aiParts.push(`${agg.aiBriefs} brief nội dung`);
  if (agg.aiComments > 0) {
    aiParts.push(`${agg.aiComments} bài phân tích comment`);
  }
  if (agg.aiSkipped > 0) {
    aiParts.push(
      `${agg.aiSkipped} bài bỏ qua phân tích comment (đã phân tích trước)`
    );
  }
  if (aiParts.length > 0) {
    parts.push(`Gemini: ${aiParts.join(', ')}`);
  }
  return parts.join(' · ');
}

export const scraperApi = {
  runYoutube: (payload: YoutubeScrapePayload) =>
    apiClient.post<ScraperAsyncStatusData>('/scraper/youtube/run', payload) as Promise<
      ApiResponse<ScraperAsyncStatusData>
    >,

  runTikTok: (payload: TikTokScrapePayload) =>
    apiClient.post<ScraperAsyncStatusData>('/scraper/tiktok/run', payload) as Promise<
      ApiResponse<ScraperAsyncStatusData>
    >,

  runFacebook: (payload: FacebookScrapePayload) =>
    apiClient.post<ScraperAsyncStatusData>('/scraper/facebook/run', payload) as Promise<
      ApiResponse<ScraperAsyncStatusData>
    >,

  getAsyncStatus: getScraperAsyncStatus,
  getLatestAsyncStatus: getLatestScraperAsyncStatus,
  listActive: listActiveScraperJobs,
  waitForAsyncJob: waitForScraperAsyncJob,

  refreshYoutubeTail: (payload: YoutubeTailRefreshPayload = {}) =>
    apiClient.post<YoutubeTailRefreshResult>('/scraper/youtube/refresh-tail', payload, {
      timeout: 600_000,
    }) as Promise<ApiResponse<YoutubeTailRefreshResult>>,
};
