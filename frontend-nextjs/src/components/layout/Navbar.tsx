'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { ChevronDown, LogOut, Menu, UserCircle } from 'lucide-react';
import { authApi } from '@/lib/api/auth';
import {
  buildNavHref,
  getPermissionNavModules,
  type NavModule,
  type NavRoute,
} from '@/lib/config/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthStore } from '@/store/auth';
import { useHamburgerStore } from '@/store/hamburger';
import { useLoadingStore } from '@/store/loading';
import { setLoading } from '@/lib/utils/handleLoading';
import { MakeToast } from '@/lib/utils/toast';
import styles from './Navbar.module.scss';

function NavChildLinks({
  modulePath,
  paths,
  t,
}: {
  modulePath: string;
  paths: NavRoute[];
  t: (key: string) => string;
}) {
  return (
    <ul className={styles['item-path']}>
      {paths.map((path) => {
        if (path.hidden) {
          return null;
        }

        const href = buildNavHref(modulePath, path.path);
        const visibleChildren = path.children?.filter((c) => c.hidden !== true) ?? [];

        return (
          <li key={path.name}>
            <Link href={href}>{t(path.titleKey)}</Link>
            {visibleChildren.length > 0 && (
              <ul className={styles['item-child']}>
                {visibleChildren.map((child) => (
                  <li key={child.name}>
                    <Link href={buildNavHref(href, child.path)}>{t(child.titleKey)}</Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function NavModules({
  modules,
  t,
}: {
  modules: NavModule[];
  t: (key: string) => string;
}) {
  return (
    <ul className={styles['item-modules']}>
      {modules.map((mod) => {
        const visibleChildren = mod.children?.filter((c) => c.hidden !== true) ?? [];
        const hasNested = visibleChildren.some((c) => c.path);

        return (
          <li key={mod.name}>
            {hasNested ? (
              <>
                <span>{t(mod.titleKey)}</span>
                <NavChildLinks modulePath={mod.path} paths={visibleChildren} t={t} />
              </>
            ) : (
              <Link href={mod.path}>{t(mod.titleKey)}</Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Navbar() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const loggingOut = useLoadingStore((state) => state.overlay.show);
  const toggleHamburger = useHamburgerStore((state) => state.toggle);
  const navModules = useMemo(
    () => getPermissionNavModules(user?.role),
    [user?.role]
  );

  const username = user?.user_name || user?.user_code || '';

  const handleLogout = async () => {
    setLoading(true);
    try {
      await authApi.logout();
    } catch {
      // Clear local session even when API fails / endpoint missing
    } finally {
      setLoading(false);
      logout();
      MakeToast({ variant: 'info', content: t('MESSAGE_APP.LOGOUT_SUCCESS') });
      router.replace('/login');
    }
  };

  return (
    <div className={styles['zone-navbar']}>
      <div className={styles['zone-navigation']}>
        <button
          type="button"
          className={styles['show-hamburger']}
          onClick={toggleHamburger}
          aria-label="Menu"
        >
          <Menu size={22} aria-hidden />
        </button>
        <div className={styles['show-logo']}>
          <Image src="/logo.png" alt="Hoyocodes" width={90} height={40} priority />
        </div>
        <div className={styles['show-menu']}>
          <NavModules modules={navModules} t={t} />
        </div>
      </div>

      <div className={styles['show-menu-right']}>
        <div className={styles['show-profile']}>
          <div className={styles['icon-profile']}>
            <UserCircle size={30} aria-hidden />
          </div>
          <div className={styles.username}>
            <span>{username}</span>
          </div>
          <div className={styles['icon-dropdown']}>
            <ChevronDown size={18} aria-hidden />
          </div>
          <ul className={styles['menu-profile']}>
            <li>
              <button type="button" onClick={handleLogout} disabled={loggingOut}>
                <span>{t('LAYOUT.LOGOUT')}</span>
                <LogOut size={16} aria-hidden />
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
