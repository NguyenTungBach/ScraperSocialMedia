import { apiClient, type ApiResponse } from './client';

export interface AlertThresholds {
  hot: number;
  trend: number;
}

export interface AlertSubjectSummary {
  subject_id: number;
  name?: string | null;
  hot_score: number;
  trend_score: number;
  posts_count: number;
}

export interface AlertCheckResult {
  sent: boolean;
  reason?: string;
  to?: string;
  bcc_count?: number;
  count: number;
  thresholds: AlertThresholds;
  subjects?: AlertSubjectSummary[];
}

export interface AlertCheckPayload {
  subject_id?: number;
  to?: string;
  /** Mảng email hoặc chuỗi phân cách bằng dấu phẩy (gộp với MAIL_ALERT_BCC trên server). */
  bcc?: string[] | string;
}

export const alertsApi = {
  checkGmail: (payload: AlertCheckPayload = {}) =>
    apiClient.post<AlertCheckResult>('/alerts/gmail', payload, {
      skipAuth: true,
      timeout: 1_800_000, // 30 phút — phân tích Gemini có thể lâu với video chưa analyze
    }) as Promise<ApiResponse<AlertCheckResult>>,
};
