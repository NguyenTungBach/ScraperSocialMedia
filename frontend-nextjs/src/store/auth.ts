import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '@/lib/api/client';
import type { UserProfile } from '@/lib/api/auth';
import { destroyToken, destroyUserInfoCookie } from '@/lib/utils/token';
import { useAppStore } from '@/store/app';

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  login: (token: string, user: UserProfile) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      login: (token, user) => {
        apiClient.setToken(token);
        set({ token, user, isAuthenticated: true });
      },

      logout: () => {
        apiClient.setToken(null);
        destroyToken();
        destroyUserInfoCookie();
        useAppStore.getState().reset();
        localStorage.removeItem('auth-storage');
        localStorage.removeItem('token');
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
