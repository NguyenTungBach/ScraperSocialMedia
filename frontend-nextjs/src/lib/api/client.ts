import { isAuthRequired } from '@/lib/config/auth';
import { getLanguage, translate } from '@/lib/i18n';
import { destroyToken, destroyUserInfoCookie } from '@/lib/utils/token';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3400/api';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  params?: Record<string, string | number | boolean | undefined | null>;
  /** Abort request after this many milliseconds. */
  timeout?: number;
}

export interface ApiResponse<T = unknown> {
  code: number;
  message?: string;
  message_content?: string | string[] | null;
  message_internal?: string | Record<string, unknown> | null;
  data_error?: Record<string, unknown> | null;
  data?: T;
}

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'parse' | 'abort';

export class ApiRequestError extends Error {
  readonly kind: ApiErrorKind;
  readonly url?: string;
  readonly method?: string;
  readonly status?: number;
  readonly originalMessage?: string;

  constructor(
    message: string,
    options: {
      kind: ApiErrorKind;
      url?: string;
      method?: string;
      status?: number;
      originalMessage?: string;
    }
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.kind = options.kind;
    this.url = options.url;
    this.method = options.method;
    this.status = options.status;
    this.originalMessage = options.originalMessage;
  }
}

function extractHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function isBrowserNetworkFailure(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    normalized === 'failed to fetch' ||
    normalized === 'network error' ||
    normalized === 'network request failed' ||
    normalized === 'load failed'
  );
}

/** Turn fetch/network failures into user-readable messages (not raw "Failed to fetch"). */
export function formatNetworkError(
  error: unknown,
  context: { url: string; method: string; timeoutMs?: number }
): ApiRequestError {
  if (error instanceof ApiRequestError) {
    return error;
  }

  const originalMessage = error instanceof Error ? error.message : String(error);

  if (error instanceof DOMException && error.name === 'AbortError') {
    const message =
      context.timeoutMs != null
        ? translate('MESSAGE_APP.REQUEST_TIMEOUT', {
            seconds: Math.round(context.timeoutMs / 1000),
          })
        : translate('MESSAGE_APP.EXCEPTION');
    return new ApiRequestError(message, {
      kind: 'timeout',
      url: context.url,
      method: context.method,
      originalMessage,
    });
  }

  if (isBrowserNetworkFailure(originalMessage)) {
    return new ApiRequestError(
      translate('MESSAGE_APP.NETWORK_ERROR', { host: extractHost(context.url) }),
      {
        kind: 'network',
        url: context.url,
        method: context.method,
        originalMessage,
      }
    );
  }

  return new ApiRequestError(originalMessage || translate('MESSAGE_APP.EXCEPTION'), {
    kind: 'network',
    url: context.url,
    method: context.method,
    originalMessage,
  });
}

/** Use in catch blocks — prefers API / network error message over generic fallback. */
export function getApiErrorMessage(
  error: unknown,
  fallbackKey = 'MESSAGE_APP.EXCEPTION'
): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim() && !isBrowserNetworkFailure(error.message)) {
    return error.message;
  }
  return translate(fallbackKey);
}

/** Mirrors Vue axios interceptor: `message || message_content || message_internal`. */
export function extractApiErrorMessage(
  data: Record<string, unknown>,
  fallback: string
): string {
  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message;
  }

  const content = data.message_content;
  if (typeof content === 'string' && content.trim()) {
    return content;
  }
  if (Array.isArray(content) && content.length > 0) {
    return content.map(String).join('\n');
  }

  const internal = data.message_internal;
  if (typeof internal === 'string' && internal.trim()) {
    return internal.split('\n')[0]?.trim() || internal;
  }

  const dataError = data.data_error;
  if (dataError && typeof dataError === 'object' && !Array.isArray(dataError)) {
    const dbMessage = (dataError as Record<string, unknown>).db_message;
    if (typeof dbMessage === 'string' && dbMessage.trim()) {
      return dbMessage;
    }
    const name = (dataError as Record<string, unknown>).name;
    if (typeof name === 'string' && name.trim()) {
      return name;
    }
  }

  return fallback;
}

let isRedirectingToLogin = false;

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        isRedirectingToLogin = false;
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
    }
  }

  private buildUrl(endpoint: string, params?: RequestOptions['params']): string {
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    let url = `${this.baseURL}${normalizedEndpoint}`;

    if (params) {
      const search = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          search.append(key, String(value));
        }
      });
      const qs = search.toString();
      if (qs) {
        url += `?${qs}`;
      }
    }

    return url;
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { skipAuth, params, timeout, ...fetchOptions } = options;
    const url = this.buildUrl(endpoint, params);
    const method = (fetchOptions.method ?? 'GET').toUpperCase();

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Language': getLanguage(),
      ...(fetchOptions.headers as Record<string, string>),
    };

    if (!(fetchOptions.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (!skipAuth && this.token) {
      headers.Authorization = this.token;
    }

    let response: Response;
    try {
      response =
        timeout != null
          ? await this.fetchWithTimeout(url, { ...fetchOptions, headers }, timeout)
          : await fetch(url, { ...fetchOptions, headers });
    } catch (error) {
      const apiError = formatNetworkError(error, { url, method, timeoutMs: timeout });
      if (process.env.NODE_ENV !== 'production') {
        console.error('[API network error]', { method, url, kind: apiError.kind, error });
      }
      throw apiError;
    }

    const contentType = response.headers.get('content-type');
    let data: Record<string, unknown>;

    try {
      data = contentType?.includes('application/json')
        ? await response.json()
        : { code: response.status, message: await response.text() };
    } catch (parseError) {
      const apiError = new ApiRequestError(translate('MESSAGE_APP.API_RESPONSE_INVALID'), {
        kind: 'parse',
        url,
        method,
        status: response.status,
        originalMessage: parseError instanceof Error ? parseError.message : String(parseError),
      });
      if (process.env.NODE_ENV !== 'production') {
        console.error('[API parse error]', { method, url, status: response.status, parseError });
      }
      throw apiError;
    }

    if (!response.ok) {
      if (response.status === 401) {
        // Public/auth endpoints (e.g. login) should surface API message,
        // not hard-redirect to /login.
        if (skipAuth) {
          throw new ApiRequestError(
            typeof data.message === 'string' ? data.message : translate('MESSAGE_APP.TOKEN_EXPIRE'),
            { kind: 'http', url, method, status: 401 }
          );
        }

        if (isAuthRequired() && !isRedirectingToLogin) {
          isRedirectingToLogin = true;
          this.setToken(null);
          destroyToken();
          destroyUserInfoCookie();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        throw new ApiRequestError(
          typeof data.message === 'string' ? data.message : translate('MESSAGE_APP.TOKEN_EXPIRE'),
          { kind: 'http', url, method, status: 401 }
        );
      }

      const message = extractApiErrorMessage(
        data,
        response.statusText || translate('MESSAGE_APP.EXCEPTION')
      );
      if (process.env.NODE_ENV !== 'production') {
        console.error('[API HTTP error]', { method, url, status: response.status, data });
      }
      throw new ApiRequestError(message, {
        kind: 'http',
        url,
        method,
        status: response.status,
        originalMessage: typeof data.message === 'string' ? data.message : undefined,
      });
    }

    return data as ApiResponse<T>;
  }

  post<T>(endpoint: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  get<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  delete<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  put<T>(endpoint: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }
}

export const apiClient = new ApiClient(API_URL);
