'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Loader2, Sparkles } from 'lucide-react';
import {
  commentsApi,
  type CommentThreadItem,
  type PostCommentItem,
  type ScraperRunComments,
} from '@/lib/api/comments';
import { getApiErrorMessage } from '@/lib/api/client';
import { classifyLabel, hasAnalysisData } from '@/lib/utils/commentAnalysis';
import { CommentAnalysisModal } from './CommentAnalysisModal';
import styles from './SubjectDetailModal.module.scss';

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
  extra?: ReactNode;
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
}

export function CommentPanel({ scraperRunId, platform, videoTitle, contentBrief, contentBriefStatus, summary }: CommentPanelProps) {
  const [open, setOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ScraperRunComments | null>(null);

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

  // Tải comment + phân tích đã lưu DB ngay khi render (không cần mở panel trước)
  useEffect(() => {
    if (total === 0 || platform !== 'youtube') return;
    void load();
  }, [scraperRunId, total, platform, load]);

  const topLevelComments = useMemo(
    () => (data ? buildTopLevelComments(data) : []),
    [data]
  );

  const hasAnalysisFromDb = useMemo(() => {
    if (data?.meta?.analyzed) return true;
    if (data && hasAnalysisData(data)) return true;
    return Boolean(summary?.analyzed);
  }, [data, summary?.analyzed]);

  if (platform !== 'youtube') return null;
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

        {hasAnalysisFromDb ? (
          <button
            type="button"
            className={styles.commentAnalysisBtn}
            onClick={() => setAnalysisOpen(true)}
          >
            <Sparkles size={14} aria-hidden />
            Xem bảng phân tích chi tiết
          </button>
        ) : null}

        <p className={styles.commentScopeHint}>
          Mỗi lần chạy cào dữ liệu chỉ lấy 20 comment gốc mới nhất · tối đa 10 reply/comment gốc
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
                    {topLevelComments.map((item) => (
                      <CommentRootRow key={item.root.id} item={item} />
                    ))}
                  </section>
                ) : (
                  <p className={styles.commentEmpty}>Chưa có comment được lưu.</p>
                )}

                {!hasAnalysisFromDb ? (
                  <p className={styles.commentHint}>
                    Phân tích AI sẽ chạy khi gọi Check alert (POST /alerts/gmail).
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
        contentBrief={contentBrief}
        contentBriefStatus={contentBriefStatus}
        initialData={data}
      />
    </>
  );
}
