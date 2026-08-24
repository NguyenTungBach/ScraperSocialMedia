'use client';

import { useEffect } from 'react';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { Loading } from '@/components/common/Loading/Loading';
import { apiClient } from '@/lib/api/client';
import { useAppStore } from '@/store/app';
import { useAuthStore } from '@/store/auth';
import styles from './app-layout.module.scss';

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  const storeHydrated = useAppStore((state) => state.hydrated);

  useEffect(() => {
    const token = useAuthStore.getState().token;
    if (token) {
      apiClient.setToken(token);
    }
    if (!useAppStore.getState().hydrated) {
      useAppStore.getState().hydrate();
    }
  }, []);

  if (!storeHydrated) {
    return <Loading fullScreen />;
  }

  return (
    <div className={styles['app-layout']}>
      <div className={styles['app-layout__app-main']}>
        <RouteGuard>{children}</RouteGuard>
      </div>
    </div>
  );
}
