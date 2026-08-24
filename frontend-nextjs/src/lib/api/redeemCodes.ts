import { apiClient } from './client';

export type RedeemCodeType = 'genshin' | 'honkai' | 'zenless';
export type RedeemCodeStatus = 'active' | 'inactive';

export interface RedeemCode {
  id: number;
  type: RedeemCodeType;
  code: string;
  rewards: string[];
  status: RedeemCodeStatus;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface RedeemCodePagination {
  display: number;
  total_records: number;
  per_page: number;
  current_page: number;
  total_pages: number;
}

export interface RedeemCodeListData {
  result: RedeemCode[];
  pagination: RedeemCodePagination;
}

export interface RedeemCodeListParams {
  page?: number;
  per_page?: number;
  limit?: number;
  type?: RedeemCodeType;
  status?: RedeemCodeStatus;
}

export const REDEEM_URLS: Record<RedeemCodeType, string> = {
  genshin: 'https://genshin.hoyoverse.com/en/gift?code=',
  honkai: 'https://honkaiimpact3.hoyoverse.com/bh3/en/news/11167?code=',
  zenless: 'https://zenless.hoyoverse.com/redemption?code=',
};

export const redeemCodesApi = {
  list: (params: RedeemCodeListParams = {}) =>
    apiClient.post<RedeemCodeListData>('/redeem-codes/list', params, { skipAuth: true }),
};
