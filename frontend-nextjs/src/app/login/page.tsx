'use client';

/**
 * Login page — scaffold from awa-frontend-nextjs.
 * API: POST `/auth/login` with `user_code` + `password` (backend-express).
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
    <div className={styles['login-page']}>
      <div className={styles['login-container']}>
        <div className={styles['form-login']}>
          <div className={styles['show-title']}>
            <h1 className={styles['title-login']}>{t('LOGIN.TITLE_LOGIN')}</h1>
          </div>

          <form onSubmit={handleSubmit} className={styles['form-input-account']}>
            <div className={styles['input-user-id']}>
              <div className={styles['input-field-col']}>
                <div className={`${styles['input-group']} ${errors.userCode ? styles['is-invalid'] : ''}`}>
                  <span className={styles['input-group-text']}>
                    <User size={22} strokeWidth={2.25} fill="currentColor" className={styles['input-icon']} aria-hidden />
                  </span>
                  <input
                    id="user_code"
                    className={styles['form-control']}
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
                {errors.userCode && <p className={styles['error-text']}>{errors.userCode}</p>}
              </div>
            </div>

            <div className={styles['input-password']}>
              <div className={styles['input-field-col']}>
                <div className={`${styles['input-group']} ${errors.password ? styles['is-invalid'] : ''}`}>
                  <span className={styles['input-group-text']}>
                    <Key size={22} strokeWidth={2.25} fill="currentColor" className={styles['input-icon']} aria-hidden />
                  </span>
                  <input
                    id="password"
                    className={styles['form-control']}
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
                {errors.password && <p className={styles['error-text']}>{errors.password}</p>}
              </div>
            </div>

            <div className={styles['form-submit']}>
              <button type="submit" disabled={loading} className={styles['btn-submit']}>
                {loading ? (
                  <>
                    <Loader2 size={18} className={styles.spin} />
                    {t('LOGIN.BUTTON_LOGIN_LOADING')}
                  </>
                ) : (
                  t('LOGIN.BUTTON_LOGIN')
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
