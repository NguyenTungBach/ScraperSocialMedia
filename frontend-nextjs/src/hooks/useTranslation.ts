'use client';

import { useMemo } from 'react';
import { t, type AppLocale, type TranslationKey } from '@/lib/i18n';
import { useAppStore } from '@/store/app';

export function useTranslation() {
  const language = useAppStore((state) => state.language);

  return useMemo(
    () => ({
      t: (key: TranslationKey, params?: Record<string, string | number>) =>
        t(key, params, language),
      language,
    }),
    [language]
  );
}

export function useLanguage(): AppLocale {
  return useAppStore((state) => state.language);
}
