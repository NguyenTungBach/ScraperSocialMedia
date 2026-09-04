'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, CalendarClock, Loader2, LogOut, Settings, UserCog, Users } from 'lucide-react';
import { authApi } from '@/lib/api/auth';
import { isAdmin } from '@/lib/config/auth';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { setLoading } from '@/lib/utils/handleLoading';
import { MakeToast } from '@/lib/utils/toast';
import { useAuthStore } from '@/store/auth';
import { useLoadingStore } from '@/store/loading';
import styles from './HotTopicDashboard.module.scss';

export function HotTopicHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const loggingOut = useLoadingStore((state) => state.overlay.show);
  const showUsers = isAdmin(user?.role);
  const showSettings = showUsers;
  const showSchedules = showUsers;

  const isHome = pathname === '/home' || pathname === '/';
  const isSubjectsArea =
    pathname === '/subjects' || pathname.startsWith('/subjects/') || pathname === '/channels';
  const isUsersArea = pathname === '/users' || pathname.startsWith('/users/');
  const isSchedulesArea = pathname === '/schedules' || pathname.startsWith('/schedules/');
  const isSettingsArea = pathname === '/settings' || pathname.startsWith('/settings/');

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
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/home" className={styles.logo}>
          <span className={styles.logoSocial}>NetScope</span>
          <span className={styles.logoTrend}>Trend</span>
          <span className={styles.logoBy}>base on Younet Media</span>
        </Link>

        <nav className={styles.mainNav} aria-label="Main navigation">
          <div className={styles.navLinks}>
            <Link href="/home" className={cn(styles.navLink, isHome && styles.navLinkActive)}>
              <BarChart3 size={16} aria-hidden />
              Xếp hạng
            </Link>
            <Link
              href="/subjects"
              className={cn(styles.navLink, isSubjectsArea && styles.navLinkActive)}
            >
              <Users size={16} aria-hidden />
              Đối tượng
            </Link>
            {showUsers && (
              <Link
                href="/users"
                className={cn(styles.navLink, isUsersArea && styles.navLinkActive)}
              >
                <UserCog size={16} aria-hidden />
                Tài khoản
              </Link>
            )}
            {showSchedules && (
              <Link
                href="/schedules"
                className={cn(styles.navLink, isSchedulesArea && styles.navLinkActive)}
              >
                <CalendarClock size={16} aria-hidden />
                Lịch chạy
              </Link>
            )}
            {showSettings && (
              <Link
                href="/settings"
                className={cn(styles.navLink, isSettingsArea && styles.navLinkActive)}
              >
                <Settings size={16} aria-hidden />
                Cài đặt
              </Link>
            )}
          </div>
        </nav>

        <div className={styles.headerActions}>
          {user && (
            <span className={styles.userLabel} title={String(user.user_code ?? '')}>
              {user.user_name || user.user_code}
            </span>
          )}
          <button
            type="button"
            className={styles.loginBtn}
            onClick={() => void handleLogout()}
            disabled={loggingOut}
          >
            {loggingOut ? (
              <Loader2 size={16} className={styles.spin} aria-hidden />
            ) : (
              <LogOut size={16} aria-hidden />
            )}
            {t('LAYOUT.LOGOUT')}
          </button>
        </div>
      </div>
    </header>
  );
}
