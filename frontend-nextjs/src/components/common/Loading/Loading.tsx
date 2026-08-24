'use client';

import { Clock } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { DEFAULT_LOCALE, translate } from '@/lib/i18n';
import { useAppStore } from '@/store/app';
import { cn } from '@/lib/utils';
import styles from './Loading.module.scss';

interface LoadingProps {
  fullScreen?: boolean;
  /** Mirrors Vue overlay `variant` (`light` | `white`). */
  variant?: 'light' | 'white';
  className?: string;
  /** Vue `APP.PLEASE_WAIT` vs ListShift `APP.LOADING`. */
  message?: string;
  /** i18n key used when `message` is not provided. */
  messageKey?: 'APP.PLEASE_WAIT' | 'APP.LOADING';
}

export function Loading({
  fullScreen = false,
  variant = 'light',
  className,
  message,
  messageKey = 'APP.PLEASE_WAIT',
}: LoadingProps) {
  const { t } = useTranslation();
  const appHydrated = useAppStore((state) => state.hydrated);
  const displayMessage =
    message ??
    (appHydrated ? t(messageKey) : translate(messageKey, undefined, DEFAULT_LOCALE));

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-zinc-700',
        variant === 'white' ? 'bg-white/95' : 'bg-white/80',
        fullScreen ? 'fixed inset-0 z-[9999]' : 'absolute inset-0 z-10',
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={displayMessage}
    >
      <Clock className={styles.clock} strokeWidth={1.75} aria-hidden />
      <p className={styles.text} suppressHydrationWarning>
        {displayMessage}
      </p>
    </div>
  );
}
