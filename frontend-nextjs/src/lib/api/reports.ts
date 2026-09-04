import { apiClient, type ApiResponse } from './client';

export type CompareReportMode = 'channels' | 'posts';

export interface CompareEmailPayload {
  mode: CompareReportMode;
  channel_ids?: Array<number | string> | string;
  scraper_run_ids?: Array<number | string> | string;
  date_from?: string;
  date_to?: string;
  metric?: string;
  to?: string;
  bcc?: string[] | string;
}

export interface CompareTrendRow {
  id: number;
  label: string;
  metric: string;
  first: number;
  last: number;
  delta_pct: number | null;
  trend: 'uptrend' | 'downtrend' | 'flat';
  up_pct?: number;
  down_pct?: number;
}

export interface CompareEmailResult {
  sent: boolean;
  to: string;
  bcc_count: number;
  mode: CompareReportMode;
  channel_ids?: number[];
  scraper_run_ids?: number[];
  date_from?: string | null;
  date_to?: string | null;
  metric: string;
  trends: CompareTrendRow[];
}

export const reportsApi = {
  sendCompareEmail: (payload: CompareEmailPayload) =>
    apiClient.post<CompareEmailResult>('/reports/compare-email', payload, {timeout: 120_000,
    }) as Promise<ApiResponse<CompareEmailResult>>,
};
