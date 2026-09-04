import { apiClient, type ApiResponse } from './client';

export interface SettingsMeta {
  key_providers: Record<string, string>;
  setting_groups: Record<string, string>;
  key_secrets: string[];
  setting_secrets: string[];
}

export interface AppSettingsData {
  keys: Record<string, string>;
  settings: Record<string, string>;
  meta: SettingsMeta;
}

export interface AppSettingsUpdatePayload {
  keys?: Record<string, string>;
  settings?: Record<string, string>;
}

export const settingsApi = {
  get: () =>
    apiClient.get<AppSettingsData>('/settings') as Promise<ApiResponse<AppSettingsData>>,

  update: (payload: AppSettingsUpdatePayload) =>
    apiClient.put<AppSettingsData>('/settings', payload) as Promise<
      ApiResponse<AppSettingsData>
    >,
};
