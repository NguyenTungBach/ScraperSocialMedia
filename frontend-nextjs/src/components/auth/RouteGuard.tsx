'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { canAccessPathname, DEFAULT_AFTER_LOGIN } from '@/lib/config/navigation';
import { useAuthStore } from '@/store/auth';

/** Client route guard — redirect when role cannot access pathname. */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const role = useAuthStore((state) => state.user?.role);

  useEffect(() => {
    if (!role || canAccessPathname(pathname, role)) {
      return;
    }
    router.replace(DEFAULT_AFTER_LOGIN);
  }, [pathname, role, router]);

  if (role && !canAccessPathname(pathname, role)) {
    return null;
  }

  return <>{children}</>;
}
