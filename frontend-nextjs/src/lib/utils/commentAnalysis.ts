import type { CommentThreadItem, PostCommentItem, ScraperRunComments } from '@/lib/api/comments';

const LABEL_MAP: Record<string, string> = {
  negative: 'Tiêu cực',
  normal: 'Bình thường',
  debate: 'Tranh luận',
  unknown: 'Không xác định',
  attack: 'Công kích',
  provoke: 'Khiêu khích',
  argument: 'Tranh cãi',
  opinion: 'Nhận định',
  other: 'Khác',
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  positive: 'Tích cực',
  neutral: 'Trung tính',
  lone: 'Đơn lẻ',
  thread: 'Chuỗi hội thoại',
};

export function classifyLabel(value?: string | null): string {
  if (!value) return '—';
  return LABEL_MAP[value] || value;
}

export type AnalysisFilter = 'all' | 'negative' | 'debate' | 'normal';

export interface CommentAnalysisRow {
  key: string;
  groupType: 'lone' | 'thread';
  classifiedAs?: string | null;
  author: string;
  text: string;
  replyCount: number;
  replies: PostCommentItem[];
  sentiment?: string | null;
  category?: string | null;
  severity?: string | null;
  reason?: string | null;
  hasNegativity?: boolean;
  analysisStatus: PostCommentItem['analysis_status'];
}

function hasStoredAnalysis(comment: PostCommentItem): boolean {
  return (
    Boolean(comment.classified_as) ||
    Boolean(comment.reason) ||
    (Boolean(comment.sentiment) && comment.sentiment !== 'unknown') ||
    (Boolean(comment.category) && comment.category !== 'unknown')
  );
}

function hasStoredThreadAnalysis(thread: CommentThreadItem): boolean {
  return (
    Boolean(thread.classified_as) ||
    Boolean(thread.reason) ||
    (Boolean(thread.sentiment) && thread.sentiment !== 'unknown') ||
    (Boolean(thread.category) && thread.category !== 'unknown')
  );
}

function isAnalyzedLone(comment: PostCommentItem): boolean {
  return hasStoredAnalysis(comment);
}

function isAnalyzedThread(thread: CommentThreadItem): boolean {
  return hasStoredThreadAnalysis(thread);
}

export function hasAnalysisData(data: ScraperRunComments): boolean {
  return data.lone.some(isAnalyzedLone) || data.threads.some(isAnalyzedThread);
}

export function buildAnalysisRows(data: ScraperRunComments): CommentAnalysisRow[] {
  const rows: CommentAnalysisRow[] = [];

  for (const comment of data.lone) {
    if (!isAnalyzedLone(comment)) continue;
    rows.push({
      key: `lone-${comment.id}`,
      groupType: 'lone',
      classifiedAs: comment.classified_as,
      author: comment.author || 'Ẩn danh',
      text: comment.text,
      replyCount: 0,
      replies: [],
      sentiment: comment.sentiment,
      category: comment.category,
      severity: comment.severity,
      reason: comment.reason,
      analysisStatus: comment.analysis_status,
    });
  }

  for (const thread of data.threads) {
    if (!isAnalyzedThread(thread)) continue;
    const [root, ...replies] = thread.comments;
    rows.push({
      key: `thread-${thread.id}`,
      groupType: 'thread',
      classifiedAs: thread.classified_as,
      author: root?.author || 'Ẩn danh',
      text: root?.text || '—',
      replyCount: replies.length,
      replies,
      sentiment: thread.sentiment,
      category: thread.category,
      severity: thread.severity,
      reason: thread.reason,
      hasNegativity: thread.has_negativity,
      analysisStatus: thread.analysis_status,
    });
  }

  return rows.sort((a, b) => {
    const order = (value?: string | null) => {
      if (value === 'negative') return 0;
      if (value === 'debate') return 1;
      if (value === 'normal') return 2;
      return 3;
    };
    return order(a.classifiedAs) - order(b.classifiedAs);
  });
}

export function filterAnalysisRows(
  rows: CommentAnalysisRow[],
  filter: AnalysisFilter
): CommentAnalysisRow[] {
  if (filter === 'all') return rows;
  return rows.filter((row) => row.classifiedAs === filter);
}

export function countAnalysisByType(rows: CommentAnalysisRow[]) {
  return {
    negative: rows.filter((r) => r.classifiedAs === 'negative').length,
    debate: rows.filter((r) => r.classifiedAs === 'debate').length,
    normal: rows.filter((r) => r.classifiedAs === 'normal').length,
    total: rows.length,
  };
}

export function toneClassName(classified?: string | null): string {
  if (classified === 'negative') return 'toneNegative';
  if (classified === 'debate') return 'toneDebate';
  if (classified === 'normal') return 'toneNormal';
  return 'toneUnknown';
}
