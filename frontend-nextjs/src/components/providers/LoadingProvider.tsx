'use client';

import { Loading } from '@/components/common/Loading/Loading';
import { useLoadingStore } from '@/store/loading';

/**
 * App-wide overlay — mirrors Vue `App.vue` `b-overlay` bound to `loading.overlay`.
 */
export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const show = useLoadingStore((state) => state.overlay.show);

  return (
    <>
      {children}
      {show && <Loading fullScreen />}
    </>
  );
}
