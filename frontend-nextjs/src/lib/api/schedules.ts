import { apiClient, type ApiResponse } from './client';
import type { SocialPostsPagination } from './socialPosts';

export type ScheduleStatus = 'idle' | 'running' | 'success' | 'failed' | string;

export interface ScheduleItem {
  id: number;
  name: string;
  cron_expression: string;
  command: string;
  enabled: boolean;
  last_run_at?: string | null;
  last_finished_at?: string | null;
  last_status: ScheduleStatus;
  last_error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ScheduleListParams {
  page?: number;
  per_page?: number;
  q?: string;
  enabled?: boolean | '' | 'true' | 'false';
}

export interface ScheduleListData {
  result: ScheduleItem[];
  pagination: SocialPostsPagination;
  allowed_commands?: string[];
}

export interface ScheduleCreatePayload {
  name: string;
  cron_expression: string;
  command: string;
  enabled?: boolean;
}

export interface ScheduleUpdatePayload {
  name?: string;
  cron_expression?: string;
  command?: string;
  enabled?: boolean;
}

export const schedulesApi = {
  list: (params: ScheduleListParams = {}) =>
    apiClient.get<ScheduleListData>('/schedules', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 50,
        q: params.q || undefined,
        enabled:
          params.enabled === '' || params.enabled == null
            ? undefined
            : String(params.enabled),
      },
    }) as Promise<ApiResponse<ScheduleListData>>,

  create: (payload: ScheduleCreatePayload) =>
    apiClient.post<ScheduleItem>('/schedules', payload) as Promise<ApiResponse<ScheduleItem>>,

  update: (id: number | string, payload: ScheduleUpdatePayload) =>
    apiClient.put<ScheduleItem>(`/schedules/${id}`, payload) as Promise<
      ApiResponse<ScheduleItem>
    >,

  remove: (id: number | string) =>
    apiClient.delete<{ id: number; deleted: boolean }>(`/schedules/${id}`) as Promise<
      ApiResponse<{ id: number; deleted: boolean }>
    >,

  runNow: (id: number | string) =>
    apiClient.post<ScheduleItem>(`/schedules/${id}/run`, {}) as Promise<ApiResponse<ScheduleItem>>,
};
