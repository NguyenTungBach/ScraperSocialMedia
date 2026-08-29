import { getPlatformMeta, normalizePlatform } from './socialPlatforms';

const LIKES_ANGRY_FORMULA = 'sentiment = (likes - angry_count) / (likes + angry_count)';

export type MetricInputs = {
  platform?: string | null;
  likes?: number;
  comments?: number;
  shares?: number;
  angry_count?: number;
  views?: number;
  posts_count?: number;
  interaction?: number;
  hot_score?: number;
  trend_score?: number;
  discussion?: number;
  sentiment?: number;
};

export type AggregateMetricOptions = MetricInputs & {
  channelTypes?: Array<string | null | undefined>;
};

function n(value?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function fmt(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function viewWeight(views?: number): number {
  return Math.floor(n(views) / 100);
}

export function resolveSubjectPlatformKey(
  channelTypes?: Array<string | null | undefined>
): string {
  const types = (channelTypes || []).map((t) => normalizePlatform(t)).filter(Boolean);
  if (types.length === 0) return 'facebook';
  if (types.every((t) => t === 'youtube')) return 'youtube';
  if (types.every((t) => t === 'tiktok')) return 'tiktok';
  if (types.every((t) => t === 'facebook')) return 'facebook';
  return 'mixed';
}

function platformLabel(platform: string): string {
  if (platform === 'mixed') return 'mixed';
  const label = getPlatformMeta(platform).label;
  return label === '?' ? 'Facebook / khác' : label;
}

function interactionFormula(platform: string): string {
  if (platform === 'youtube') return 'IT = likes + comments';
  return 'IT = likes + comments + shares';
}

function hotFormula(platform: string): string {
  if (platform === 'youtube') {
    return 'H = likes×1 + comments×3 + floor(views/100)×3';
  }
  if (platform === 'tiktok') {
    return 'H = likes×1 + comments×3 + shares×3 + floor(views/100)×2';
  }
  return 'H = likes×1 + comments×2 + shares×3 + angry×4';
}

function trendFormula(platform: string): string {
  if (platform === 'youtube') {
    return 'T = likes×1 + comments×2 + floor(views/100)×3';
  }
  if (platform === 'tiktok') {
    return 'T = likes×1 + comments×2 + shares×3 + floor(views/100)×2';
  }
  return 'T = likes×1 + comments×2 + shares×3';
}

function computeInteraction(platform: string, o: MetricInputs): number {
  const likes = n(o.likes);
  const comments = n(o.comments);
  const shares = n(o.shares);
  if (platform === 'youtube') return likes + comments;
  return likes + comments + shares;
}

function computeHot(platform: string, o: MetricInputs): number {
  const likes = n(o.likes);
  const comments = n(o.comments);
  const shares = n(o.shares);
  const angry = n(o.angry_count);
  const vw = viewWeight(o.views);
  if (platform === 'youtube') return likes * 1 + comments * 3 + vw * 3;
  if (platform === 'tiktok') return likes * 1 + comments * 3 + shares * 3 + vw * 2;
  return likes * 1 + comments * 2 + shares * 3 + angry * 4;
}

function computeTrend(platform: string, o: MetricInputs): number {
  const likes = n(o.likes);
  const comments = n(o.comments);
  const shares = n(o.shares);
  const vw = viewWeight(o.views);
  if (platform === 'youtube') return likes * 1 + comments * 2 + vw * 3;
  if (platform === 'tiktok') return likes * 1 + comments * 2 + shares * 3 + vw * 2;
  return likes * 1 + comments * 2 + shares * 3;
}

function interactionExpand(platform: string, o: MetricInputs): string {
  const likes = n(o.likes);
  const comments = n(o.comments);
  const shares = n(o.shares);
  const result = typeof o.interaction === 'number' ? o.interaction : computeInteraction(platform, o);
  if (platform === 'youtube') {
    return `= ${likes} + ${comments} = ${result}`;
  }
  return `= ${likes} + ${comments} + ${shares} = ${result}`;
}

function hotExpand(platform: string, o: MetricInputs): string {
  const likes = n(o.likes);
  const comments = n(o.comments);
  const shares = n(o.shares);
  const angry = n(o.angry_count);
  const vw = viewWeight(o.views);
  const result = typeof o.hot_score === 'number' ? fmt(o.hot_score) : fmt(computeHot(platform, o));
  if (platform === 'youtube') {
    return `= ${likes}×1 + ${comments}×3 + floor(${n(o.views)}/100)×3 = ${likes} + ${comments * 3} + ${vw * 3} = ${result}`;
  }
  if (platform === 'tiktok') {
    return `= ${likes}×1 + ${comments}×3 + ${shares}×3 + floor(${n(o.views)}/100)×2 = ${likes} + ${comments * 3} + ${shares * 3} + ${vw * 2} = ${result}`;
  }
  return `= ${likes}×1 + ${comments}×2 + ${shares}×3 + ${angry}×4 = ${likes} + ${comments * 2} + ${shares * 3} + ${angry * 4} = ${result}`;
}

function trendExpand(platform: string, o: MetricInputs): string {
  const likes = n(o.likes);
  const comments = n(o.comments);
  const shares = n(o.shares);
  const vw = viewWeight(o.views);
  const result =
    typeof o.trend_score === 'number' ? fmt(o.trend_score) : fmt(computeTrend(platform, o));
  if (platform === 'youtube') {
    return `= ${likes}×1 + ${comments}×2 + floor(${n(o.views)}/100)×3 = ${likes} + ${comments * 2} + ${vw * 3} = ${result}`;
  }
  if (platform === 'tiktok') {
    return `= ${likes}×1 + ${comments}×2 + ${shares}×3 + floor(${n(o.views)}/100)×2 = ${likes} + ${comments * 2} + ${shares * 3} + ${vw * 2} = ${result}`;
  }
  return `= ${likes}×1 + ${comments}×2 + ${shares}×3 = ${likes} + ${comments * 2} + ${shares * 3} = ${result}`;
}

function hasCounts(o: MetricInputs): boolean {
  return (
    typeof o.likes === 'number' ||
    typeof o.comments === 'number' ||
    typeof o.shares === 'number' ||
    typeof o.angry_count === 'number' ||
    typeof o.views === 'number'
  );
}

/** Interaction (IT) — parity deriveEngagementMetrics. */
export function getInteractionFormulaTooltip(options: MetricInputs): string {
  const platform = normalizePlatform(options.platform);
  const lines = [
    `Interaction / IT (${platformLabel(platform)})`,
    interactionFormula(platform),
  ];
  if (hasCounts(options)) lines.push(interactionExpand(platform, options));
  return lines.join('\n');
}

/** Hot score (H) — parity calculateScores. */
export function getHotScoreFormulaTooltip(options: MetricInputs): string {
  const platform = normalizePlatform(options.platform);
  const lines = [`Hot score / H (${platformLabel(platform)})`, hotFormula(platform)];
  if (hasCounts(options)) lines.push(hotExpand(platform, options));
  return lines.join('\n');
}

/** Trend score (T) — parity calculateScores. */
export function getTrendScoreFormulaTooltip(options: MetricInputs): string {
  const platform = normalizePlatform(options.platform);
  const lines = [`Trend score / T (${platformLabel(platform)})`, trendFormula(platform)];
  if (hasCounts(options)) lines.push(trendExpand(platform, options));
  return lines.join('\n');
}

/**
 * Sentiment (S) — parity deriveEngagementMetrics.
 * YT/TT tạm = 0; FB/mixed/khác = (likes - angry) / (likes + angry).
 */
export function getSentimentFormulaTooltip(options: MetricInputs): string {
  const platform = normalizePlatform(options.platform);
  const label = platformLabel(platform);

  if (platform === 'youtube' || platform === 'tiktok') {
    return [
      `Sentiment / S (${label})`,
      'sentiment = 0',
      '(tạm gán 0 — chưa có angry_count)',
    ].join('\n');
  }

  const lines = [`Sentiment / S (${label})`, LIKES_ANGRY_FORMULA];

  if (typeof options.likes === 'number' && typeof options.angry_count === 'number') {
    const likes = n(options.likes);
    const angry = n(options.angry_count);
    const denom = likes + angry;
    const result =
      typeof options.sentiment === 'number'
        ? options.sentiment.toFixed(2)
        : denom === 0
          ? '0.00'
          : ((likes - angry) / denom).toFixed(2);
    lines.push(`= (${likes} - ${angry}) / (${likes} + ${angry}) = ${result}`);
    if (denom === 0) lines.push('(likes + angry_count = 0 → gán 0)');
  }

  return lines.join('\n');
}

/** Discussion — comments + posts_count. */
export function getDiscussionFormulaTooltip(options: MetricInputs = {}): string {
  const lines = ['Thảo luận', 'discussion = comments + posts_count'];
  if (typeof options.comments === 'number' || typeof options.posts_count === 'number') {
    const comments = n(options.comments);
    const posts = n(options.posts_count);
    const result =
      typeof options.discussion === 'number' ? options.discussion : comments + posts;
    lines.push(`= ${comments} + ${posts} = ${result}`);
  }
  return lines.join('\n');
}

function mixedScoreLines(kind: 'hot' | 'trend' | 'interaction'): string[] {
  if (kind === 'interaction') {
    return [
      'Interaction / IT (mixed)',
      'Facebook / TikTok / mixed: IT = likes + comments + shares',
      'YouTube: IT = likes + comments',
    ];
  }
  if (kind === 'hot') {
    return [
      'Hot score / H (mixed)',
      'Cộng điểm theo từng platform rồi tổng:',
      `Facebook: ${hotFormula('facebook')}`,
      `YouTube: ${hotFormula('youtube')}`,
      `TikTok: ${hotFormula('tiktok')}`,
    ];
  }
  return [
    'Trend score / T (mixed)',
    'Cộng điểm theo từng platform rồi tổng:',
    `Facebook: ${trendFormula('facebook')}`,
    `YouTube: ${trendFormula('youtube')}`,
    `TikTok: ${trendFormula('tiktok')}`,
  ];
}

export function getAggregateInteractionFormulaTooltip(
  options: AggregateMetricOptions = {}
): string {
  const platform = resolveSubjectPlatformKey(options.channelTypes);
  if (platform === 'mixed') {
    const lines = mixedScoreLines('interaction');
    if (hasCounts(options)) {
      lines.push(interactionExpand('facebook', options));
    }
    return lines.join('\n');
  }
  return getInteractionFormulaTooltip({ ...options, platform });
}

export function getAggregateHotScoreFormulaTooltip(
  options: AggregateMetricOptions = {}
): string {
  const platform = resolveSubjectPlatformKey(options.channelTypes);
  if (platform === 'mixed') {
    const lines = mixedScoreLines('hot');
    if (typeof options.hot_score === 'number') {
      lines.push(`Tổng H = ${fmt(options.hot_score)}`);
    }
    return lines.join('\n');
  }
  return getHotScoreFormulaTooltip({ ...options, platform });
}

export function getAggregateTrendScoreFormulaTooltip(
  options: AggregateMetricOptions = {}
): string {
  const platform = resolveSubjectPlatformKey(options.channelTypes);
  if (platform === 'mixed') {
    const lines = mixedScoreLines('trend');
    if (typeof options.trend_score === 'number') {
      lines.push(`Tổng T = ${fmt(options.trend_score)}`);
    }
    return lines.join('\n');
  }
  return getTrendScoreFormulaTooltip({ ...options, platform });
}

export function getAggregateSentimentFormulaTooltip(
  options: AggregateMetricOptions = {}
): string {
  const platform = resolveSubjectPlatformKey(options.channelTypes);

  if (platform === 'youtube' || platform === 'tiktok') {
    return getSentimentFormulaTooltip({
      platform,
      sentiment: options.sentiment,
    });
  }

  if (platform === 'mixed') {
    const lines = [
      'Sentiment / S (mixed)',
      `Facebook / mixed: ${LIKES_ANGRY_FORMULA}`,
      'YouTube / TikTok: sentiment = 0 (chưa có angry_count)',
    ];
    if (typeof options.likes === 'number' && typeof options.angry_count === 'number') {
      const likes = n(options.likes);
      const angry = n(options.angry_count);
      const denom = likes + angry;
      const result =
        typeof options.sentiment === 'number'
          ? options.sentiment.toFixed(2)
          : denom === 0
            ? '0.00'
            : ((likes - angry) / denom).toFixed(2);
      lines.push(`Tổng hợp: (${likes} - ${angry}) / (${likes} + ${angry}) = ${result}`);
    }
    return lines.join('\n');
  }

  return getSentimentFormulaTooltip({
    platform,
    likes: options.likes,
    angry_count: options.angry_count,
    sentiment: options.sentiment,
  });
}
