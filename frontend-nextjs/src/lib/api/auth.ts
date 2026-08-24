import { apiClient } from './client';

export interface LoginParams {
  user_code: string;
  password: string;
}

export interface UserProfile {
  id: number;
  user_code: string;
  user_name?: string;
  role: string | number;
  status?: number;
  [key: string]: unknown;
}

export interface LoginResponse {
  access_token: string;
  profile: UserProfile;
}

export const authApi = {
  login: (params: LoginParams) =>
    apiClient.post<LoginResponse>('/auth/login', params, { skipAuth: true }),

  /** Local clear only — backend-express chưa có `/auth/logout`. */
  logout: async () => ({ code: 200 as const }),

  getProfile: () => apiClient.get<UserProfile>('/profile'),
};
