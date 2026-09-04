import { apiClient, type ApiResponse } from './client';
import type { SocialPostsPagination } from './socialPosts';

export type UserRole = 'admin' | 'member';

export interface ManagedUser {
  id: number;
  user_code: string;
  user_name: string;
  role: UserRole | string;
  status: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface UserListParams {
  page?: number;
  per_page?: number;
  q?: string;
  role?: UserRole | '';
}

export interface UserListData {
  result: ManagedUser[];
  pagination: SocialPostsPagination;
}

export interface UserCreatePayload {
  user_code: string;
  user_name: string;
  password: string;
  role: UserRole;
  status?: number;
}

export interface UserUpdatePayload {
  user_code?: string;
  user_name?: string;
  password?: string;
  role?: UserRole;
}

export const usersApi = {
  list: (params: UserListParams = {}) =>
    apiClient.get<UserListData>('/users', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 20,
        q: params.q || undefined,
        role: params.role || undefined,
      },
    }) as Promise<ApiResponse<UserListData>>,

  create: (payload: UserCreatePayload) =>
    apiClient.post<ManagedUser>('/users', payload) as Promise<ApiResponse<ManagedUser>>,

  update: (id: number | string, payload: UserUpdatePayload) =>
    apiClient.put<ManagedUser>(`/users/${id}`, payload) as Promise<ApiResponse<ManagedUser>>,

  remove: (id: number | string) =>
    apiClient.delete<{ id: number; deleted: boolean }>(
      `/users/${id}`
    ) as Promise<ApiResponse<{ id: number; deleted: boolean }>>,
};
