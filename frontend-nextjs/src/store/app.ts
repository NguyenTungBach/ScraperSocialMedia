import Cookies from 'js-cookie';
import { create } from 'zustand';
import { COOKIE_KEYS } from '@/lib/const/cookies';
import {
  DEFAULT_LOCALE,
  setLanguage as persistLanguage,
  setLocaleReady,
  type AppLocale,
} from '@/lib/i18n';

export type AppTheme = 'dark' | 'light';

const DEFAULT_THEME: AppTheme = 'dark';

interface AppState {
  language: AppLocale;
  theme: AppTheme;
  hydrated: boolean;
  hydrate: () => void;
  setLanguage: (language: AppLocale) => void;
  setTheme: (theme: AppTheme) => void;
  reset: () => void;
}

function readLanguageFromCookie(): AppLocale {
  const stored = Cookies.get(COOKIE_KEYS.LANGUAGE);
  if (stored === 'vi' || stored === 'en' || stored === 'ja') {
    return stored;
  }
  return DEFAULT_LOCALE;
}

function readThemeFromCookie(): AppTheme {
  const stored = Cookies.get(COOKIE_KEYS.THEME);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return DEFAULT_THEME;
}

function persistTheme(theme: AppTheme): void {
  Cookies.set(COOKIE_KEYS.THEME, theme);
}

export const useAppStore = create<AppState>((set) => ({
  language: DEFAULT_LOCALE,
  theme: DEFAULT_THEME,
  hydrated: false,

  hydrate: () => {
    const language = readLanguageFromCookie();
    const theme = readThemeFromCookie();
    persistLanguage(language);
    persistTheme(theme);
    setLocaleReady(true);
    set({ language, theme, hydrated: true });
  },

  setLanguage: (language) => {
    persistLanguage(language);
    setLocaleReady(true);
    set({ language });
  },

  setTheme: (theme) => {
    persistTheme(theme);
    set({ theme });
  },

  reset: () => {
    setLocaleReady(false);
    set({
      language: DEFAULT_LOCALE,
      theme: DEFAULT_THEME,
      hydrated: false,
    });
  },
}));
