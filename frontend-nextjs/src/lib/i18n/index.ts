import Cookies from 'js-cookie';
import { COOKIE_KEYS } from '@/lib/const/cookies';
import { en } from '@/lib/i18n/locales/en';
import { ja } from '@/lib/i18n/locales/ja';
import { vi } from '@/lib/i18n/locales/vi';

export type AppLocale = 'vi' | 'en' | 'ja';

export const SUPPORTED_LOCALES: AppLocale[] = ['vi', 'en', 'ja'];

export const DEFAULT_LOCALE: AppLocale =
  (process.env.NEXT_PUBLIC_DEFAULT_LANG as AppLocale) || 'vi';

const locales = { vi, en, ja } as const;

/** False until app store reads the language cookie — avoids SSR/client hydration mismatch. */
let localeReady = false;

export function setLocaleReady(ready = true): void {
  localeReady = ready;
}

export type TranslationKey = string;

function resolvePath(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function isAppLocale(value: string | undefined): value is AppLocale {
  return value === 'vi' || value === 'en' || value === 'ja';
}

/** Read locale from cookie — mirrors Vue `getLanguage()`. */
export function getLanguage(): AppLocale {
  if (typeof window === 'undefined' || !localeReady) {
    return DEFAULT_LOCALE;
  }
  const stored = Cookies.get(COOKIE_KEYS.LANGUAGE);
  if (isAppLocale(stored)) {
    return stored;
  }
  Cookies.set(COOKIE_KEYS.LANGUAGE, DEFAULT_LOCALE);
  return DEFAULT_LOCALE;
}

export function setLanguage(locale: AppLocale): void {
  if (typeof window !== 'undefined') {
    Cookies.set(COOKIE_KEYS.LANGUAGE, locale);
  }
}

export function translate(
  key: TranslationKey,
  params?: Record<string, string | number>,
  locale?: AppLocale
): string {
  const lang = locale ?? getLanguage();
  const messages = locales[lang] as Record<string, unknown>;
  let text = resolvePath(messages, key) ?? key;

  if (params) {
    Object.entries(params).forEach(([paramKey, value]) => {
      text = text.replaceAll(`{${paramKey}}`, String(value));
    });
  }

  return text;
}

/** Shorthand — same as Vue `$t()`. */
export function t(
  key: TranslationKey,
  params?: Record<string, string | number>,
  locale?: AppLocale
): string {
  return translate(key, params, locale);
}
