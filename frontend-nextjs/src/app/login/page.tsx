'use client';

/**
 * Login — NetScope Trend (khớp giao diện màn quản lý).
 * API: POST `/auth/login` with `user_code` + `password`.
 */

import { useState } from 'react';
import { Key, Loader2, User } from 'lucide-react';
import { authApi } from '@/lib/api/auth';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthStore } from '@/store/auth';
import { saveToken, saveUserInfoCookie } from '@/lib/utils/token';
import { validateUserID, validPassword } from '@/lib/utils/validate';
import { DEFAULT_AFTER_LOGIN } from '@/lib/config/navigation';
import { setLoading } from '@/lib/utils/handleLoading';
import { MakeToast } from '@/lib/utils/toast';
import { useLoadingStore } from '@/store/loading';
import styles from './login.module.scss';

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuthStore();
  const [userCode, setUserCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ userCode?: string; password?: string }>({});
  const loading = useLoadingStore((state) => state.overlay.show);

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!userCode) {
      next.userCode = t('MESSAGE_APP.VALIDATE_REQUIRED');
    } else if (!validateUserID(userCode)) {
      next.userCode = t('MESSAGE_APP.LOGIN_VALIDATE_USER_ID');
    }
    if (!password) {
      next.password = t('MESSAGE_APP.VALIDATE_REQUIRED');
    } else if (!validPassword(password)) {
      next.password = t('MESSAGE_APP.LOGIN_VALIDATE_PASSWORD');
    }
    setErrors(next);

    const firstError = next.userCode || next.password;
    if (firstError) {
      MakeToast({
        variant: 'warning',
        content: firstError,
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await authApi.login({
        user_code: userCode,
        password,
      });

      if (response.code === 200 && response.data) {
        const { access_token, profile } = response.data;
        saveToken(access_token);
        saveUserInfoCookie(profile);
        login(access_token, profile);
        MakeToast({ variant: 'success', content: t('MESSAGE_APP.LOGIN_SUCCESS') });
        window.location.replace(DEFAULT_AFTER_LOGIN);
        return;
      }

      MakeToast({
        variant: 'warning',
        content: response.message || t('MESSAGE_APP.LOGIN_FAIL'),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('MESSAGE_APP.LOGIN_FAIL');
      MakeToast({ variant: 'danger', content: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.atmosphere} aria-hidden />

      <main className={styles.panel}>
        <div className={styles.brand}>
          <span className={styles.logoSocial}>NetScope</span>
          <span className={styles.logoTrend}>Trend</span>
        </div>
        <p className={styles.tagline}>base on Younet Media</p>
        <h1 className={styles.title}>{t('LOGIN.TITLE_LOGIN')}</h1>
        <p className={styles.subtitle}>Đăng nhập để tiếp tục theo dõi xu hướng mạng xã hội</p>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <label className={styles.field}>
            <span className={styles.label}>{t('LOGIN.PLACEHOLDER_USER_ID')}</span>
            <div className={`${styles.inputWrap} ${errors.userCode ? styles.invalid : ''}`}>
              <User size={18} strokeWidth={2.25} className={styles.icon} aria-hidden />
              <input
                id="user_code"
                className={styles.input}
                inputMode="numeric"
                autoComplete="username"
                placeholder={t('LOGIN.PLACEHOLDER_USER_ID')}
                value={userCode}
                disabled={loading}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 15);
                  setUserCode(v);
                  if (errors.userCode) setErrors((prev) => ({ ...prev, userCode: undefined }));
                }}
                aria-invalid={!!errors.userCode}
              />
            </div>
            {errors.userCode && <p className={styles.error}>{errors.userCode}</p>}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('LOGIN.PLACEHOLDER_USER_PASSWORD')}</span>
            <div className={`${styles.inputWrap} ${errors.password ? styles.invalid : ''}`}>
              <Key size={18} strokeWidth={2.25} className={styles.icon} aria-hidden />
              <input
                id="password"
                className={styles.input}
                type="password"
                autoComplete="current-password"
                placeholder={t('LOGIN.PLACEHOLDER_USER_PASSWORD')}
                value={password}
                disabled={loading}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                aria-invalid={!!errors.password}
              />
            </div>
            {errors.password && <p className={styles.error}>{errors.password}</p>}
          </label>

          <button type="submit" disabled={loading} className={styles.submit}>
            {loading ? (
              <>
                <Loader2 size={18} className={styles.spin} />
                {t('LOGIN.BUTTON_LOGIN_LOADING')}
              </>
            ) : (
              t('LOGIN.BUTTON_LOGIN')
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
