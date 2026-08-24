'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/store/app';

/** Hydrate language + picker cookies; keep `<html lang>` in sync with locale. */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useAppStore((state) => state.language);

  useEffect(() => {
    useAppStore.getState().hydrate();
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return children;
}
