import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiRequestError, getApiErrorMessage } from '@/lib/api/client';
import { channelsApi } from '@/lib/api/channels';
import {
  aggregateScrapeSummaries,
  formatScrapeSuccessToast,
  getScraperAsyncStatus,
  isScraperAsyncInProgress,
  listActiveScraperJobs,
  scraperApi,
  waitForScraperAsyncJob,
  type ScraperAsyncStatusData,
} from '@/lib/api/scraper';
import { MakeToast } from '@/lib/utils/toast';

function parseSubjectId(scopeKey: string): number | null {
  const m = /^subject:(\d+)$/.exec(scopeKey);
  return m ? Number(m[1]) : null;
}

function parseChannelIds(scopeKey: string): number[] {
  const m = /^channels:([\d,]+)$/.exec(scopeKey);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function normalizePayload(
  payload: ScraperAsyncStatusData['payload_json'] | string | null | undefined
): ScraperAsyncStatusData['payload_json'] {
  if (payload == null) return null;
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as ScraperAsyncStatusData['payload_json'];
    } catch {
      return null;
    }
  }
  return payload;
}

/** Channel ids từ scope `channels:…` hoặc payload_json.channel_id (kể cả job scope subject:*). */
export function channelIdsFromJob(job: ScraperAsyncStatusData): number[] {
  const fromScope = parseChannelIds(job.scope_key);
  const payload = normalizePayload(job.payload_json);
  const raw = payload?.channel_id;
  const fromPayload = Array.isArray(raw)
    ? raw.map((id) => Number(id)).filter((n) => Number.isFinite(n) && n > 0)
    : [];

  return [...new Set([...fromScope, ...fromPayload])];
}

function collectChannelIds(
  jobs: ScraperAsyncStatusData[],
  extra: number[] = []
): number[] {
  const ids = new Set<number>(extra.filter((n) => Number.isFinite(n) && n > 0));
  for (const job of jobs) {
    for (const id of channelIdsFromJob(job)) {
      ids.add(id);
    }
  }
  return [...ids];
}

function collectSubjectIds(jobs: ScraperAsyncStatusData[]): number[] {
  const ids = new Set<number>();
  for (const job of jobs) {
    const fromScope = parseSubjectId(job.scope_key);
    if (fromScope != null) ids.add(fromScope);
    const subjectId = Number(normalizePayload(job.payload_json)?.subject_id);
    if (Number.isFinite(subjectId) && subjectId > 0) ids.add(subjectId);
  }
  return [...ids];
}

function labelFromPayload(job: ScraperAsyncStatusData): string | null {
  const payload = normalizePayload(job.payload_json);
  if (!payload) return null;

  const subjectName = String(payload.subject_name || '').trim();
  if (subjectName) return subjectName;

  const names = Array.isArray(payload.channel_names)
    ? payload.channel_names
        .map((row) => String(row?.name || '').trim())
        .filter(Boolean)
    : [];
  if (names.length > 0) return names.join(', ');

  return null;
}

function labelForJobs(jobs: ScraperAsyncStatusData[], fallback: string): string {
  if (fallback.trim()) return fallback;
  const first = jobs[0];
  if (!first) return 'quét';

  const fromPayload = labelFromPayload(first);
  if (fromPayload) return fromPayload;

  const subjectIds = collectSubjectIds([first]);
  if (subjectIds.length > 0) return `đối tượng #${subjectIds[0]}`;
  const channelIds = channelIdsFromJob(first);
  if (channelIds.length > 0) return `kênh #${channelIds.join(',')}`;
  return first.scope_key;
}

/** Resolve tên kênh từ catalog khi payload cũ chưa có channel_names (vd. F5). */
async function resolveLabelForJobs(
  jobs: ScraperAsyncStatusData[],
  fallback: string
): Promise<string> {
  const quick = labelForJobs(jobs, fallback);
  if (fallback.trim() || !/^kênh #/.test(quick)) return quick;

  const channelIds = collectChannelIds(jobs);
  if (channelIds.length === 0) return quick;

  try {
    const res = await channelsApi.list({ per_page: 100 });
    const byId = new Map(
      (res.data?.result ?? []).map((ch) => [Number(ch.id), String(ch.name || '').trim()])
    );
    const names = channelIds
      .map((id) => byId.get(id))
      .filter((name): name is string => Boolean(name));
    if (names.length > 0) return names.join(', ');
  } catch {
    // giữ fallback id
  }
  return quick;
}

/**
 * Fire-and-forget scrape watcher (AWA ListShift F5 pattern):
 * - enqueue → toast queued → poll nền bằng waitFor*
 * - mount/F5 → listActive / resume poll nếu còn pending|running
 * - highlightChannelIds / highlightSubjectIds giữ ổn định cho spinner UI
 */
export function useScraperAsyncWatcher(options?: {
  onSettledReload?: () => void | Promise<void>;
}) {
  const onSettledReloadRef = useRef(options?.onSettledReload);
  onSettledReloadRef.current = options?.onSettledReload;

  const [activeJobs, setActiveJobs] = useState<ScraperAsyncStatusData[]>([]);
  const [highlightChannelIds, setHighlightChannelIds] = useState<number[]>([]);
  const [highlightSubjectIds, setHighlightSubjectIds] = useState<number[]>([]);
  const [enqueueing, setEnqueueing] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [tracking, setTracking] = useState(false);

  const cancelledRef = useRef(false);
  const pollGenerationRef = useRef(0);

  const scrapeLocked = enqueueing || tracking || activeJobs.length > 0;

  const scrapingChannelIdSet = useMemo(
    () => new Set(highlightChannelIds),
    [highlightChannelIds]
  );
  const scrapingSubjectIdSet = useMemo(
    () => new Set(highlightSubjectIds),
    [highlightSubjectIds]
  );

  const isSubjectScraping = useCallback(
    (subjectId: number | string) => scrapingSubjectIdSet.has(Number(subjectId)),
    [scrapingSubjectIdSet]
  );

  const isChannelScraping = useCallback(
    (channelId: number) => scrapingChannelIdSet.has(Number(channelId)),
    [scrapingChannelIdSet]
  );

  const clearProgress = useCallback(() => {
    setActiveJobs([]);
    setHighlightChannelIds([]);
    setHighlightSubjectIds([]);
    setTracking(false);
    setResumed(false);
  }, []);

  const applyHighlights = useCallback(
    (jobs: ScraperAsyncStatusData[], extraChannelIds: number[] = []) => {
      setActiveJobs(jobs);
      setHighlightChannelIds(collectChannelIds(jobs, extraChannelIds));
      setHighlightSubjectIds(collectSubjectIds(jobs));
      setTracking(true);
    },
    []
  );

  const pollJobs = useCallback(
    async (
      jobs: ScraperAsyncStatusData[],
      label: string,
      options?: {
        isCancelled?: () => boolean;
        resumed?: boolean;
        extraChannelIds?: number[];
      }
    ): Promise<void> => {
      const jobIds = jobs
        .map((j) => j.async_job_id)
        .filter((id) => Number.isFinite(id));
      if (jobIds.length === 0) return;

      const generation = ++pollGenerationRef.current;
      applyHighlights(jobs, options?.extraChannelIds ?? []);
      if (options?.resumed) {
        setResumed(true);
      }

      // Giữ map id → job gốc (có payload) vì getStatus vẫn có payload nhưng merge an toàn hơn
      const seedById = new Map(jobs.map((j) => [j.async_job_id, j]));

      try {
        const finals = await Promise.all(
          jobIds.map((id) =>
            waitForScraperAsyncJob(id, {
              intervalMs: 2500,
              isCancelled: () =>
                cancelledRef.current ||
                options?.isCancelled?.() === true ||
                generation !== pollGenerationRef.current,
              onStatus: (status) => {
                if (generation !== pollGenerationRef.current) return;
                const seed = seedById.get(status.async_job_id);
                const merged: ScraperAsyncStatusData = {
                  ...seed,
                  ...status,
                  payload_json: status.payload_json ?? seed?.payload_json ?? null,
                  result_json: status.result_json ?? seed?.result_json ?? null,
                };
                setActiveJobs((prev) => {
                  const next = prev.filter((j) => j.async_job_id !== status.async_job_id);
                  if (isScraperAsyncInProgress(status.status)) {
                    next.push(merged);
                  }
                  return next;
                });
              },
            })
          )
        );

        // Re-fetch once for fresh result_json (tránh race đọc trước khi markCompleted flush)
        const refreshed = await Promise.all(
          finals.map(async (row) => {
            try {
              const res = await getScraperAsyncStatus(row.async_job_id);
              return res.data ?? row;
            } catch {
              return row;
            }
          })
        );

        if (
          cancelledRef.current ||
          options?.isCancelled?.() ||
          generation !== pollGenerationRef.current
        ) {
          return;
        }

        const agg = aggregateScrapeSummaries(refreshed);
        if (agg.failed.length > 0) {
          const first = agg.failed[0];
          MakeToast({
            variant: 'danger',
            content:
              first.error_message ||
              `Quét thất bại (${first.status}) cho "${label}"`,
          });
        }
        if (refreshed.some((s) => s.status === 'completed')) {
          MakeToast({
            variant: 'success',
            content: formatScrapeSuccessToast(label, agg),
          });
        }
        await onSettledReloadRef.current?.();
      } catch (error) {
        if (
          cancelledRef.current ||
          options?.isCancelled?.() ||
          generation !== pollGenerationRef.current
        ) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('cancelled')) return;
        MakeToast({ variant: 'danger', content: getApiErrorMessage(error) });
      } finally {
        if (generation === pollGenerationRef.current) {
          clearProgress();
        }
      }
    },
    [applyHighlights, clearProgress]
  );

  useEffect(() => {
    cancelledRef.current = false;
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const res = await listActiveScraperJobs();
        if (cancelled || cancelledRef.current) return;

        const active = (res.data ?? []).filter((row) =>
          isScraperAsyncInProgress(row.status)
        );
        if (active.length === 0) return;

        applyHighlights(active);
        setResumed(true);

        MakeToast({
          variant: 'warning',
          content: 'Phát hiện job quét đang chạy — tiếp tục theo dõi sau khi tải lại trang',
        });

        // Một lần poll tất cả job active (tránh Promise.all pollJobs đụng generation)
        const resumeLabel = await resolveLabelForJobs(active, '');
        if (cancelled || cancelledRef.current) return;
        await pollJobs(active, resumeLabel, {
          isCancelled: () => cancelled || cancelledRef.current,
          resumed: true,
        });
      } catch {
        // Ignore bootstrap errors
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      cancelledRef.current = true;
      pollGenerationRef.current += 1;
    };
  }, [applyHighlights, pollJobs]);

  const enqueueSubjectScrape = useCallback(
    async (input: {
      label: string;
      subjectId?: number;
      ytIds: number[];
      ttIds: number[];
      fbIds: number[];
    }) => {
      if (scrapeLocked) return;
      if (input.ytIds.length === 0 && input.ttIds.length === 0 && input.fbIds.length === 0) {
        MakeToast({
          variant: 'warning',
          content: 'Chưa gắn kênh YouTube/TikTok/Facebook để quét',
        });
        return;
      }

      const previewChannelIds = [...input.ytIds, ...input.ttIds, ...input.fbIds];
      // Spinner ngay khi click (trước khi API trả)
      setHighlightChannelIds(previewChannelIds);
      if (input.subjectId != null) {
        setHighlightSubjectIds([input.subjectId]);
      }
      setEnqueueing(true);
      setTracking(true);

      const enqueued: ScraperAsyncStatusData[] = [];
      try {
        const subject_id = input.subjectId;
        if (input.ytIds.length > 0) {
          const res = await scraperApi.runYoutube({
            channel_id: input.ytIds,
            subject_id,
          });
          if (res.data) enqueued.push(res.data);
        }
        if (input.ttIds.length > 0) {
          const res = await scraperApi.runTikTok({
            channel_id: input.ttIds,
            subject_id,
          });
          if (res.data) enqueued.push(res.data);
        }
        if (input.fbIds.length > 0) {
          const res = await scraperApi.runFacebook({
            channel_id: input.fbIds,
            subject_id,
          });
          if (res.data) enqueued.push(res.data);
        }

        MakeToast({
          variant: 'success',
          content: `Đã xếp hàng quét "${input.label}" — có thể F5 / rời trang, hệ thống chạy nền`,
        });
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 409) {
          MakeToast({
            variant: 'warning',
            content: 'Đang có job quét chạy — vui lòng đợi xong rồi thử lại',
          });
          try {
            const res = await listActiveScraperJobs();
            const active = (res.data ?? []).filter((row) =>
              isScraperAsyncInProgress(row.status)
            );
            if (active.length > 0) {
              setEnqueueing(false);
              await pollJobs(active, input.label, {
                resumed: true,
                extraChannelIds: previewChannelIds,
              });
              return;
            }
          } catch {
            // fall through
          }
        } else {
          MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
        }
        setEnqueueing(false);
        clearProgress();
        return;
      }

      setEnqueueing(false);
      if (enqueued.length > 0) {
        await pollJobs(enqueued, input.label, { extraChannelIds: previewChannelIds });
      } else {
        clearProgress();
      }
    },
    [clearProgress, pollJobs, scrapeLocked]
  );

  const enqueueChannelScrape = useCallback(
    async (input: {
      label: string;
      channelId: number;
      platform: 'youtube' | 'tiktok' | 'facebook';
    }) => {
      if (scrapeLocked) return;

      // Spinner ngay trên đúng kênh
      setHighlightChannelIds([input.channelId]);
      setEnqueueing(true);
      setTracking(true);

      try {
        const payload = { channel_id: [input.channelId] };
        const res =
          input.platform === 'tiktok'
            ? await scraperApi.runTikTok(payload)
            : input.platform === 'facebook'
              ? await scraperApi.runFacebook(payload)
              : await scraperApi.runYoutube(payload);

        MakeToast({
          variant: 'success',
          content: `Đã xếp hàng quét "${input.label}" — có thể F5 / rời trang, hệ thống chạy nền`,
        });
        setEnqueueing(false);
        if (res.data) {
          await pollJobs([res.data], input.label, {
            extraChannelIds: [input.channelId],
          });
        } else {
          clearProgress();
        }
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 409) {
          MakeToast({
            variant: 'warning',
            content: 'Đang có job quét chạy cho kênh này — vui lòng đợi',
          });
          try {
            const activeRes = await listActiveScraperJobs();
            const active = (activeRes.data ?? []).filter((row) =>
              isScraperAsyncInProgress(row.status)
            );
            if (active.length > 0) {
              setEnqueueing(false);
              await pollJobs(active, input.label, {
                resumed: true,
                extraChannelIds: [input.channelId],
              });
              return;
            }
          } catch {
            // fall through
          }
        } else {
          MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
        }
        setEnqueueing(false);
        clearProgress();
      }
    },
    [clearProgress, pollJobs, scrapeLocked]
  );

  return {
    scrapeLocked,
    resumed,
    activeJobs,
    highlightChannelIds,
    highlightSubjectIds,
    isSubjectScraping,
    isChannelScraping,
    enqueueSubjectScrape,
    enqueueChannelScrape,
  };
}
