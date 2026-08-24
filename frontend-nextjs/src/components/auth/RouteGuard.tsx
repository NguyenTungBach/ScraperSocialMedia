'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isAuthRequired } from '@/lib/config/auth';
import { canAccessPathname, DEFAULT_AFTER_LOGIN } from '@/lib/config/navigation';
import { useAuthStore } from '@/store/auth';

/** Client guard — no-op when auth is temporarily disabled. */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const role = useAuthStore((state) => state.user?.role);

  useEffect(() => {
    if (!isAuthRequired()) {
      return;
    }
    if (!role || canAccessPathname(pathname, role)) {
      return;
    }
    router.replace(DEFAULT_AFTER_LOGIN);
  }, [pathname, role, router]);

  if (isAuthRequired() && role && !canAccessPathname(pathname, role)) {
    return null;
  }

  return <>{children}</>;
}
