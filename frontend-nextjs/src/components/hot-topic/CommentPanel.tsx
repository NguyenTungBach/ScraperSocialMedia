'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Loader2, Sparkles } from 'lucide-react';
import { ConfirmActionModal } from '@/components/common/ConfirmActionModal/ConfirmActionModal';
import { Pagination } from '@/components/common/Pagination/Pagination';
import {
  commentsApi,
  DEFAULT_ANALYZE_MAX_COMMENTS,
  DEFAULT_ANALYZE_MAX_REPLIES,
  type CommentThreadItem,
  type PostCommentItem,
  type ScraperRunComments,
} from '@/lib/api/comments';
import { ApiRequestError, getApiErrorMessage } from '@/lib/api/client';
import {
  isScraperAsyncInProgress,
  type CommentAnalysisResultSummary,
  type ScraperAsyncStatusData,
} from '@/lib/api/scraper';
import { classifyLabel, hasAnalysisData } from '@/lib/utils/commentAnalysis';
import { isCommentSupportedPlatform, normalizePlatform } from '@/lib/utils/socialPlatforms';
import { MakeToast } from '@/lib/utils/toast';
import { canWrite } from '@/lib/config/auth';
import { useAuthStore } from '@/store/auth';
import { CommentAnalysisModal } from './CommentAnalysisModal';
import styles from './SubjectDetailModal.module.scss';

const COMMENT_PAGE_SIZE = 10;

function clampAnalyzeLimit(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function commentAnalysisFromResult(
  resultJson: ScraperAsyncStatusData['result_json']
): CommentAnalysisResultSummary['comments_analysis'] | null {
  if (!resultJson || typeof resultJson !== 'object') return null;
  if ('kind' in resultJson && resultJson.kind === 'comment_analysis') {
    return resultJson.comments_analysis ?? null;
  }
  return null;
}

function contentBriefFromResult(
  resultJson: ScraperAsyncStatusData['result_json']
): string | null {
  if (!resultJson || typeof resultJson !== 'object') return null;
  if ('kind' in resultJson && resultJson.kind === 'comment_analysis') {
    const brief = resultJson.content_brief?.content_brief;
    return typeof brief === 'string' && brief.trim() ? brief : null;
  }
  return null;
}

function toneClass(classified?: string | null) {
  if (classified === 'negative') return styles.commentBadgeNegative;
  if (classified === 'debate') return styles.commentBadgeDebate;
  if (classified === 'normal') return styles.commentBadgeNormal;
  return styles.commentBadgeUnknown;
}

interface TopLevelComment {
  root: PostCommentItem;
  replies: PostCommentItem[];
  thread: CommentThreadItem | null;
}

/** Giữ thứ tự scrape (YouTube Hàng đầu = sort_order từ API relevance). */
function buildTopLevelComments(data: ScraperRunComments): TopLevelComment[] {
  const items: TopLevelComment[] = [];

  for (const root of data.lone) {
    items.push({ root, replies: [], thread: null });
  }

  for (const thread of data.threads) {
    if (thread.comments.length === 0) continue;
    const [root, ...replies] = thread.comments;
    items.push({ root, replies, thread });
  }

  return items.sort((a, b) => a.root.sort_order - b.root.sort_order);
}

function CommentBadges({
  classifiedAs,
  sentiment,
  category,
  severity,
  extra,
}: {
  classifiedAs?: string | null;
  sentiment?: string | null;
  category?: string | null;
  severity?: string | null;
  extra?: React.ReactNode;
}) {
  if (!classifiedAs && !sentiment && !category && !severity && !extra) return null;

  return (
    <div className={styles.commentMeta}>
      {classifiedAs ? (
        <span className={toneClass(classifiedAs)}>{classifyLabel(classifiedAs)}</span>
      ) : null}
      {extra}
      {sentiment && sentiment !== 'unknown' ? (
        <span className={styles.commentTag}>{classifyLabel(sentiment)}</span>
      ) : null}
      {category && category !== 'unknown' ? (
        <span className={styles.commentTag}>{classifyLabel(category)}</span>
      ) : null}
      {severity && severity !== 'unknown' ? (
        <span className={styles.commentTag}>{classifyLabel(severity)}</span>
      ) : null}
    </div>
  );
}

function CommentRootRow({ item }: { item: TopLevelComment }) {
  const [repliesOpen, setRepliesOpen] = useState(false);
  const { root, replies, thread } = item;
  const hasReplies = replies.length > 0;

  const badgeClassified = thread?.classified_as ?? root.classified_as;
  const badgeSentiment = thread?.sentiment ?? root.sentiment;
  const badgeCategory = thread?.category ?? root.category;
  const badgeSeverity = thread?.severity ?? root.severity;

  return (
    <div className={styles.commentItem}>
      <p className={styles.commentText}>
        <b>{root.author || 'Ẩn danh'}:</b> {root.text}
      </p>

      <CommentBadges
        classifiedAs={badgeClassified}
        sentiment={badgeSentiment}
        category={badgeCategory}
        severity={badgeSeverity}
        extra={
          thread?.has_negativity ? (
            <span className={styles.commentTag}>Có tiêu cực</span>
          ) : null
        }
      />

      {!thread && root.reason ? (
        <p className={styles.commentReason}>{root.reason}</p>
      ) : null}

      {hasReplies ? (
        <>
          <button
            type="button"
            className={styles.commentReplyToggle}
            onClick={() => setRepliesOpen((v) => !v)}
            aria-expanded={repliesOpen}
          >
            {repliesOpen ? (
              <ChevronDown size={14} aria-hidden />
            ) : (
              <ChevronRight size={14} aria-hidden />
            )}
            {replies.length} phản hồi
          </button>

          {repliesOpen ? (
            <div className={styles.commentReplies}>
              {replies.map((reply) => (
                <div key={reply.id} className={styles.commentReplyItem}>
                  <p className={styles.commentText}>
                    <b>{reply.author || 'Ẩn danh'}:</b> {reply.text}
                  </p>
                  <CommentBadges
                    classifiedAs={reply.classified_as}
                    sentiment={reply.sentiment}
                    category={reply.category}
                    severity={reply.severity}
                  />
                  {reply.reason ? (
                    <p className={styles.commentReason}>{reply.reason}</p>
                  ) : null}
                </div>
              ))}
              {thread?.reason ? (
                <p className={styles.commentReason}>{thread.reason}</p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

interface CommentPanelProps {
  scraperRunId: number;
  platform: string;
  videoTitle?: string;
  contentBrief?: string | null;
  contentBriefStatus?: 'not_start' | 'pending' | 'done' | 'skipped';
  summary?: {
    total: number;
    lone_count?: number;
    thread_count: number;
    negative_count: number;
    debate_count: number;
    analyzed: boolean;
  };
  onAnalyzed?: () => void;
}

export function CommentPanel({
  scraperRunId,
  platform,
  videoTitle,
  contentBrief,
  contentBriefStatus,
  summary,
  onAnalyzed,
}: CommentPanelProps) {
  const canMutate = canWrite(useAuthStore((s) => s.user?.role));
  const [open, setOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ScraperRunComments | null>(null);
  const [localBrief, setLocalBrief] = useState(contentBrief);
  const [localBriefStatus, setLocalBriefStatus] = useState(contentBriefStatus);
  const [commentPage, setCommentPage] = useState(1);
  const [maxComments, setMaxComments] = useState(DEFAULT_ANALYZE_MAX_COMMENTS);
  const [maxReplies, setMaxReplies] = useState(DEFAULT_ANALYZE_MAX_REPLIES);
  const [analyzeConfirmOpen, setAnalyzeConfirmOpen] = useState(false);
  const analysePollCancelRef = useRef(false);
  const analysePollGenRef = useRef(0);

  useEffect(() => {
    setLocalBrief(contentBrief);
    setLocalBriefStatus(contentBriefStatus);
  }, [contentBrief, contentBriefStatus]);

  useEffect(() => {
    setMaxComments(DEFAULT_ANALYZE_MAX_COMMENTS);
    setMaxReplies(DEFAULT_ANALYZE_MAX_REPLIES);
  }, [scraperRunId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await commentsApi.getByScraperRun(scraperRunId);
      setData(res.data || { lone: [], threads: [] });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [scraperRunId]);

  const total = summary?.total ?? 0;

  useEffect(() => {
    if (total === 0 || !isCommentSupportedPlatform(platform)) return;
    void load();
  }, [scraperRunId, total, platform, load]);

  const finishAnalysisJob = useCallback(
    async (status: ScraperAsyncStatusData) => {
      await load();
      const brief = contentBriefFromResult(status.result_json);
      if (brief) {
        setLocalBrief(brief);
        setLocalBriefStatus('done');
      }

      if (status.status === 'failed' || status.status === 'stale') {
        MakeToast({
          variant: 'danger',
          content: status.error_message || 'Phân tích comment thất bại',
        });
        return;
      }

      const ca = commentAnalysisFromResult(status.result_json);
      if (ca?.analyzed) {
        const remaining = Number(ca.units_remaining_pending || 0);
        MakeToast({
          variant: 'success',
          content:
            remaining > 0
              ? `Đã phân tích ${ca.units_analyzed ?? 0} comment — còn ${remaining} chưa xử lý`
              : 'Đã phân tích comment bằng AI',
        });
        setAnalysisOpen(true);
      } else if (ca?.reason === 'already_done') {
        MakeToast({ variant: 'success', content: 'Bài này đã phân tích trước đó' });
        setAnalysisOpen(true);
      } else if (ca?.reason === 'no_comments') {
        MakeToast({ variant: 'warning', content: 'Chưa có comment để phân tích' });
      } else {
        MakeToast({
          variant: 'warning',
          content: ca?.reason
            ? `Bỏ qua: ${ca.reason}`
            : 'Không có comment pending để phân tích',
        });
      }
      onAnalyzed?.();
    },
    [load, onAnalyzed]
  );

  const pollAnalysisJob = useCallback(
    async (asyncJobId: number) => {
      const generation = ++analysePollGenRef.current;
      setAnalyzing(true);
      try {
        const status = await commentsApi.waitForAnalysisJob(asyncJobId, {
          intervalMs: 2500,
          isCancelled: () =>
            analysePollCancelRef.current || generation !== analysePollGenRef.current,
        });
        if (
          analysePollCancelRef.current ||
          generation !== analysePollGenRef.current
        ) {
          return;
        }
        await finishAnalysisJob(status);
      } catch (err) {
        if (
          analysePollCancelRef.current ||
          generation !== analysePollGenRef.current
        ) {
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('cancelled')) return;
        MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
      } finally {
        if (generation === analysePollGenRef.current) {
          setAnalyzing(false);
        }
      }
    },
    [finishAnalysisJob]
  );

  useEffect(() => {
    analysePollCancelRef.current = false;
    let cancelled = false;

    const resume = async () => {
      if (!canMutate) return;
      try {
        const res = await commentsApi.getLatestAnalysisJob(scraperRunId);
        const job = res.data;
        if (!job || cancelled || analysePollCancelRef.current) return;
        if (!isScraperAsyncInProgress(job.status)) return;
        MakeToast({
          variant: 'warning',
          content: 'Đang có job phân tích comment — tiếp tục theo dõi',
        });
        await pollAnalysisJob(job.async_job_id);
      } catch {
        // ignore resume errors
      }
    };

    void resume();

    return () => {
      cancelled = true;
      analysePollCancelRef.current = true;
      analysePollGenRef.current += 1;
    };
  }, [scraperRunId, canMutate, pollAnalysisJob]);

  const topLevelComments = useMemo(
    () => (data ? buildTopLevelComments(data) : []),
    [data]
  );

  const commentTotalPages = Math.max(
    1,
    Math.ceil(topLevelComments.length / COMMENT_PAGE_SIZE)
  );
  const commentCurrentPage = Math.min(commentPage, commentTotalPages);
  const pagedTopLevelComments = useMemo(() => {
    const start = (commentCurrentPage - 1) * COMMENT_PAGE_SIZE;
    return topLevelComments.slice(start, start + COMMENT_PAGE_SIZE);
  }, [topLevelComments, commentCurrentPage]);

  useEffect(() => {
    setCommentPage(1);
  }, [scraperRunId, data]);

  useEffect(() => {
    if (open) setCommentPage(1);
  }, [open]);

  const hasAnalysisFromDb = useMemo(() => {
    if (data?.meta?.analyzed) return true;
    if (data && hasAnalysisData(data)) return true;
    return Boolean(summary?.analyzed);
  }, [data, summary?.analyzed]);

  const handleAnalyze = async () => {
    const commentsLimit = clampAnalyzeLimit(
      maxComments,
      1,
      200,
      DEFAULT_ANALYZE_MAX_COMMENTS
    );
    const repliesLimit = clampAnalyzeLimit(
      maxReplies,
      0,
      50,
      DEFAULT_ANALYZE_MAX_REPLIES
    );
    setMaxComments(commentsLimit);
    setMaxReplies(repliesLimit);
    setAnalyzing(true);

    try {
      const res = await commentsApi.analyze(scraperRunId, {
        max_comments: commentsLimit,
        max_replies: repliesLimit,
      });
      const asyncJobId = res.data?.async_job_id;
      if (asyncJobId == null) {
        throw new Error('Missing async_job_id from analyze response');
      }
      MakeToast({
        variant: 'success',
        content: `Đã xếp hàng phân tích (tối đa ${commentsLimit} comment · ${repliesLimit} reply/thread)`,
      });
      await pollAnalysisJob(asyncJobId);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) {
        MakeToast({
          variant: 'warning',
          content: 'Đang có job phân tích comment cho bài này — vui lòng đợi',
        });
        try {
          const latest = await commentsApi.getLatestAnalysisJob(scraperRunId);
          if (latest.data && isScraperAsyncInProgress(latest.data.status)) {
            await pollAnalysisJob(latest.data.async_job_id);
            return;
          }
        } catch {
          // fall through
        }
        setAnalyzing(false);
        return;
      }
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
      setAnalyzing(false);
    }
  };

  if (!isCommentSupportedPlatform(platform)) return null;
  if (total === 0) return null;

  const replyCount = Math.max(
    0,
    total - (summary?.lone_count ?? 0) - (summary?.thread_count ?? 0)
  );

  const summaryText = [
    `${total} comment`,
    replyCount > 0 ? `${replyCount} reply` : null,
    summary?.negative_count ? `${summary.negative_count} tiêu cực` : null,
    summary?.debate_count ? `${summary.debate_count} tranh luận` : null,
    hasAnalysisFromDb ? 'đã phân tích AI' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const commentRangeStart =
    topLevelComments.length === 0 ? 0 : (commentCurrentPage - 1) * COMMENT_PAGE_SIZE + 1;
  const commentRangeEnd = Math.min(
    commentCurrentPage * COMMENT_PAGE_SIZE,
    topLevelComments.length
  );
  const showCommentPagination = topLevelComments.length > COMMENT_PAGE_SIZE;

  const renderCommentPagination = (position: 'top' | 'bottom') =>
    showCommentPagination ? (
      <Pagination
        key={`comment-page-${position}`}
        className={
          position === 'top' ? styles.commentPaginationTop : styles.commentPaginationBottom
        }
        page={commentCurrentPage}
        totalPages={commentTotalPages}
        totalRecords={topLevelComments.length}
        unitLabel="comment gốc"
        info={`Hiển thị ${commentRangeStart}–${commentRangeEnd} / ${topLevelComments.length} comment gốc · Trang ${commentCurrentPage}/${commentTotalPages}`}
        onChange={setCommentPage}
      />
    ) : position === 'top' && topLevelComments.length > 0 ? (
      <p className={styles.commentPageInfo}>{topLevelComments.length} comment gốc</p>
    ) : null;

  return (
    <>
      <div className={styles.commentPanel}>
        <button
          type="button"
          className={styles.commentToggle}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{summaryText}</span>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        <div className={styles.commentActionRow}>
          {canMutate && (
            <>
              <div className={styles.commentLimitFields}>
                <div className={styles.commentLimitField}>
                  <label htmlFor={`analyze-max-comments-${scraperRunId}`}>Comment</label>
                  <input
                    id={`analyze-max-comments-${scraperRunId}`}
                    type="number"
                    min={1}
                    max={200}
                    value={maxComments}
                    disabled={analyzing}
                    onChange={(e) => setMaxComments(Number(e.target.value))}
                  />
                </div>
                <div className={styles.commentLimitField}>
                  <label htmlFor={`analyze-max-replies-${scraperRunId}`}>Reply</label>
                  <input
                    id={`analyze-max-replies-${scraperRunId}`}
                    type="number"
                    min={0}
                    max={50}
                    value={maxReplies}
                    disabled={analyzing}
                    onChange={(e) => setMaxReplies(Number(e.target.value))}
                  />
                </div>
              </div>
              <button
                type="button"
                className={styles.commentAnalysisBtn}
                onClick={() => setAnalyzeConfirmOpen(true)}
                disabled={analyzing}
                title="Xếp hàng Gemini trên comment pending (theo giới hạn Comment / Reply)"
              >
                {analyzing ? (
                  <Loader2 size={14} className={styles.spin} aria-hidden />
                ) : (
                  <Sparkles size={14} aria-hidden />
                )}
                {analyzing
                  ? 'Đang phân tích…'
                  : hasAnalysisFromDb
                    ? 'Phân tích lại (comment thiếu kết quả)'
                    : 'Phân tích comment'}
              </button>
            </>
          )}

          {hasAnalysisFromDb ? (
            <button
              type="button"
              className={styles.commentAnalysisBtnSecondary}
              onClick={() => setAnalysisOpen(true)}
            >
              Xem bảng phân tích chi tiết
            </button>
          ) : null}
        </div>

        <p className={styles.commentScopeHint}>
          Phân tích AI (queue): tối đa Comment gốc + Reply/thread chưa có kết quả · mặc định{' '}
          {DEFAULT_ANALYZE_MAX_COMMENTS}+{DEFAULT_ANALYZE_MAX_REPLIES}
          {normalizePlatform(platform) === 'youtube'
            ? ' · Lưu comment theo cấu hình kênh (YouTube API tối đa 100 gốc + 100 reply/comment)'
            : ' · Lưu comment theo cấu hình kênh'}
          {' · '}
          Gemini theo lô 10 đơn vị/lần
        </p>

        {open ? (
          <div className={styles.commentBody}>
            {loading && !data ? (
              <div className={styles.commentLoading}>
                <Loader2 size={16} className={styles.spin} aria-hidden /> Đang tải comment…
              </div>
            ) : null}
            {error ? <p className={styles.commentError}>{error}</p> : null}
            {data ? (
              <>
                {topLevelComments.length > 0 ? (
                  <section className={styles.commentSection}>
                    {renderCommentPagination('top')}

                    {pagedTopLevelComments.map((item) => (
                      <CommentRootRow key={item.root.id} item={item} />
                    ))}

                    {renderCommentPagination('bottom')}
                  </section>
                ) : (
                  <p className={styles.commentEmpty}>Chưa có comment được lưu.</p>
                )}

                {!hasAnalysisFromDb ? (
                  <p className={styles.commentHint}>
                    Bấm «Phân tích comment» để chạy Gemini trên bài này (mọi MXH đã scrape).
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <CommentAnalysisModal
        open={analysisOpen}
        onClose={() => setAnalysisOpen(false)}
        scraperRunId={scraperRunId}
        videoTitle={videoTitle}
        contentBrief={localBrief}
        contentBriefStatus={localBriefStatus}
        initialData={data}
      />

      <ConfirmActionModal
        open={analyzeConfirmOpen}
        title={hasAnalysisFromDb ? 'Xác nhận phân tích lại' : 'Xác nhận phân tích comment'}
        message={
          hasAnalysisFromDb ? (
            <>
              Bạn có chắc muốn phân tích lại comment chưa có kết quả cho bài{' '}
              <strong>{videoTitle || 'này'}</strong>? Giới hạn: tối đa{' '}
              {clampAnalyzeLimit(maxComments, 1, 200, DEFAULT_ANALYZE_MAX_COMMENTS)} comment gốc
              và{' '}
              {clampAnalyzeLimit(maxReplies, 0, 50, DEFAULT_ANALYZE_MAX_REPLIES)} reply/thread.
            </>
          ) : (
            <>
              Bạn có chắc muốn phân tích comment cho bài{' '}
              <strong>{videoTitle || 'này'}</strong>? Giới hạn: tối đa{' '}
              {clampAnalyzeLimit(maxComments, 1, 200, DEFAULT_ANALYZE_MAX_COMMENTS)} comment gốc
              và{' '}
              {clampAnalyzeLimit(maxReplies, 0, 50, DEFAULT_ANALYZE_MAX_REPLIES)} reply/thread.
            </>
          )
        }
        confirmLabel="Phân tích"
        onClose={() => setAnalyzeConfirmOpen(false)}
        onConfirm={async () => {
          setAnalyzeConfirmOpen(false);
          await handleAnalyze();
        }}
      />
    </>
  );
}
