export interface SocialPlatformMeta {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  bg: string;
  border: string;
}

const PLATFORMS: Record<string, SocialPlatformMeta> = {
  facebook: {
    id: 'facebook',
    label: 'Facebook',
    shortLabel: 'FB',
    color: '#1877F2',
    bg: '#E7F3FF',
    border: '#93C5FD',
  },
  tiktok: {
    id: 'tiktok',
    label: 'TikTok',
    shortLabel: 'TT',
    color: '#010101',
    bg: '#F3F4F6',
    border: '#D1D5DB',
  },
  youtube: {
    id: 'youtube',
    label: 'YouTube',
    shortLabel: 'YT',
    color: '#FF0000',
    bg: '#FEE2E2',
    border: '#FCA5A5',
  },
  instagram: {
    id: 'instagram',
    label: 'Instagram',
    shortLabel: 'IG',
    color: '#E4405F',
    bg: '#FCE7F3',
    border: '#F9A8D4',
  },
  twitter: {
    id: 'twitter',
    label: 'X (Twitter)',
    shortLabel: 'X',
    color: '#0F1419',
    bg: '#F3F4F6',
    border: '#D1D5DB',
  },
  x: {
    id: 'x',
    label: 'X (Twitter)',
    shortLabel: 'X',
    color: '#0F1419',
    bg: '#F3F4F6',
    border: '#D1D5DB',
  },
  linkedin: {
    id: 'linkedin',
    label: 'LinkedIn',
    shortLabel: 'IN',
    color: '#0A66C2',
    bg: '#DBEAFE',
    border: '#93C5FD',
  },
};

const FALLBACK: SocialPlatformMeta = {
  id: 'other',
  label: 'Khác',
  shortLabel: '?',
  color: '#475569',
  bg: '#F1F5F9',
  border: '#CBD5E1',
};

export const SOCIAL_PLATFORM_OPTIONS = [
  PLATFORMS.facebook,
  PLATFORMS.tiktok,
  PLATFORMS.youtube,
  PLATFORMS.instagram,
  PLATFORMS.twitter,
  PLATFORMS.linkedin,
];

export const SELECTABLE_PLATFORM_ID = 'youtube';

export function normalizePlatform(value?: string | null): string {
  return (value || 'facebook').trim().toLowerCase();
}

export function isPlatformSelectable(value?: string | null): boolean {
  return normalizePlatform(value) === SELECTABLE_PLATFORM_ID;
}

export function getPlatformMeta(value?: string | null): SocialPlatformMeta {
  const key = normalizePlatform(value);
  return PLATFORMS[key] || {
    ...FALLBACK,
    id: key || FALLBACK.id,
    label: key ? key.charAt(0).toUpperCase() + key.slice(1) : FALLBACK.label,
    shortLabel: key ? key.slice(0, 2).toUpperCase() : FALLBACK.shortLabel,
  };
}

export function resolvePostPlatform(
  post: { platform?: string | null; channel_id?: number | null },
  channelMap?: Map<number, { type_channel?: string }>
): string {
  const channel =
    post.channel_id != null && channelMap ? channelMap.get(post.channel_id) : undefined;
  return normalizePlatform(post.platform || channel?.type_channel);
}

export function sortPlatformKeys(keys: string[]): string[] {
  const order = new Map(SOCIAL_PLATFORM_OPTIONS.map((item, index) => [item.id, index]));
  return [...keys].sort((a, b) => {
    const ai = order.get(a) ?? 999;
    const bi = order.get(b) ?? 999;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });
}

export function buildPlatformTabs(
  postsByPlatform: Record<string, number> = {}
): { id: string; label: string; count: number }[] {
  const total = postsByPlatform.all ?? 0;
  const tabs = [{ id: '', label: 'Tất cả', count: total }];
  const keys = sortPlatformKeys(
    Object.keys(postsByPlatform).filter((key) => key !== 'all' && (postsByPlatform[key] ?? 0) > 0)
  );
  for (const key of keys) {
    tabs.push({
      id: key,
      label: getPlatformMeta(key).label,
      count: postsByPlatform[key] ?? 0,
    });
  }
  return tabs;
}
