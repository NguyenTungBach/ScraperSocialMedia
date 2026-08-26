'use client';

import { getPlatformMeta } from '@/lib/utils/socialPlatforms';
import { cn } from '@/lib/utils';
import styles from './PlatformBadge.module.scss';

interface PlatformBadgeProps {
  platform?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

export function PlatformBadge({ platform, size = 'sm', className }: PlatformBadgeProps) {
  const meta = getPlatformMeta(platform);

  return (
    <span
      className={cn(styles.badge, styles[size], className)}
      style={{
        color: meta.color,
        backgroundColor: meta.bg,
        borderColor: meta.border,
      }}
      title={meta.label}
    >
      <span className={styles.dot} style={{ backgroundColor: meta.color }} aria-hidden />
      {meta.label}
    </span>
  );
}
