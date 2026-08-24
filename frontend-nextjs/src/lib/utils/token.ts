import Cookies from 'js-cookie';

const TOKEN_KEY = 'token';
const USER_INFO_KEY = 'user_info';

/** Must be `/` so Next.js middleware can read the cookie on all routes. */
const COOKIE_OPTIONS: Cookies.CookieAttributes = {
  expires: 7,
  path: '/',
  sameSite: 'Lax',
};

export const getToken = (): string | null => Cookies.get(TOKEN_KEY) || null;

export const saveToken = (token: string): void => {
  Cookies.set(TOKEN_KEY, token, COOKIE_OPTIONS);
};

export const destroyToken = (): void => {
  Cookies.remove(TOKEN_KEY, { path: '/' });
};

export const saveUserInfoCookie = (user: unknown): void => {
  Cookies.set(USER_INFO_KEY, JSON.stringify(user), COOKIE_OPTIONS);
};

export const getUserInfoCookie = (): Record<string, unknown> | null => {
  const raw = Cookies.get(USER_INFO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const destroyUserInfoCookie = (): void => {
  Cookies.remove(USER_INFO_KEY, { path: '/' });
};
