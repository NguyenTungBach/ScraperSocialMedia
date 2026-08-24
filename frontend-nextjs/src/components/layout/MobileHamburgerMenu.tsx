'use client';

import Link from 'next/link';
import { ArrowRightFromLine, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { authApi } from '@/lib/api/auth';
import { setLoading } from '@/lib/utils/handleLoading';
import { MakeToast } from '@/lib/utils/toast';
import { useAuthStore } from '@/store/auth';
import { useHamburgerStore } from '@/store/hamburger';
import styles from './MobileHamburgerMenu.module.scss';

export function MobileHamburgerMenu() {
  const router = useRouter();
  const { t } = useTranslation();
  const logout = useAuthStore((state) => state.logout);
  const setOpen = useHamburgerStore((state) => state.setOpen);

  const closeMenu = () => setOpen(false);

  const handleLogout = async () => {
    closeMenu();
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
    <div className={styles.menuList}>
      <ul>
        <li>
          <Link href="/home" className={styles.menuItem} onClick={closeMenu}>
            <Home size={24} aria-hidden />
            <span>{t('ROUTER.HOME')}</span>
          </Link>
        </li>
        <li>
          <button type="button" className={styles.menuItem} onClick={handleLogout}>
            <ArrowRightFromLine size={24} aria-hidden />
            <span>{t('LAYOUT.LOGOUT')}</span>
          </button>
        </li>
      </ul>
    </div>
  );
}
