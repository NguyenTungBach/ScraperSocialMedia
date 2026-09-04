'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Save, Settings } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api/client';
import { settingsApi, type AppSettingsData } from '@/lib/api/settings';
import { isAdmin } from '@/lib/config/auth';
import { DEFAULT_AFTER_LOGIN } from '@/lib/config/navigation';
import { MakeToast } from '@/lib/utils/toast';
import { useAuthStore } from '@/store/auth';
import { HotTopicHeader } from './HotTopicHeader';
import dash from './HotTopicDashboard.module.scss';
import styles from './SettingsManagement.module.scss';

const KEY_FIELDS: { name: string; label: string; hint?: string }[] = [
  { name: 'APIFY_API_TOKEN', label: 'Apify API Token', hint: 'Facebook & TikTok' },
  { name: 'YOUTUBE_API_KEY', label: 'YouTube API Key' },
  { name: 'GEMINI_API_KEY', label: 'Gemini API Key' },
  { name: 'GEMINI_MODEL', label: 'Gemini Model' },
  {
    name: 'GEMINI_FALLBACK_MODELS',
    label: 'Gemini Fallback Models',
    hint: 'Phân tách bằng dấu phẩy',
  },
  { name: 'GEMINI_MAX_RETRIES', label: 'Gemini Max Retries' },
  { name: 'GEMINI_RETRY_DELAY_MS', label: 'Gemini Retry Delay (ms)' },
];

const ALERT_FIELDS: { name: string; label: string }[] = [
  { name: 'ALERT_TREND_THRESHOLD', label: 'Ngưỡng xu hướng (trend)' },
  { name: 'ALERT_HOT_THRESHOLD', label: 'Ngưỡng nóng (hot)' },
];

const MAIL_FIELDS: { name: string; label: string; hint?: string }[] = [
  { name: 'MAIL_MAILER', label: 'Mailer (smtp | ses)' },
  { name: 'MAIL_HOST', label: 'SMTP Host' },
  { name: 'MAIL_PORT', label: 'SMTP Port' },
  { name: 'MAIL_USERNAME', label: 'SMTP Username' },
  { name: 'MAIL_PASSWORD', label: 'SMTP Password' },
  { name: 'MAIL_ENCRYPTION', label: 'Encryption (tls | ssl)' },
  { name: 'MAIL_FROM_ADDRESS', label: 'From Address' },
  { name: 'MAIL_FROM_NAME', label: 'From Name' },
  { name: 'MAIL_MAIN', label: 'Alert Recipient (MAIL_MAIN)' },
  {
    name: 'MAIL_ALERT_BCC',
    label: 'Alert BCC',
    hint: 'Phân tách bằng dấu phẩy hoặc chấm phẩy',
  },
];

function isSecretKey(name: string, data: AppSettingsData | null) {
  if (!data?.meta) return false;
  return (
    data.meta.key_secrets.includes(name) || data.meta.setting_secrets.includes(name)
  );
}

function SecretField({
  name,
  label,
  hint,
  value,
  visible,
  onToggleVisible,
  onChange,
}: {
  name: string;
  label: string;
  hint?: string;
  value: string;
  visible: boolean;
  onToggleVisible: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.field}>
      <span>
        {label}
        <code className={styles.envName}>{name}</code>
      </span>
      <div className={styles.secretInputWrap}>
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          className={styles.revealBtn}
          onClick={onToggleVisible}
          aria-label={visible ? 'Ẩn giá trị' : 'Hiện giá trị'}
          title={visible ? 'Ẩn' : 'Hiện'}
        >
          {visible ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        </button>
      </div>
      {hint ? <em className={styles.fieldHint}>{hint}</em> : null}
    </div>
  );
}

export function SettingsManagement() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const admin = isAdmin(currentUser?.role);

  const [server, setServer] = useState<AppSettingsData | null>(null);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [dirtySecrets, setDirtySecrets] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!admin) {
      router.replace(DEFAULT_AFTER_LOGIN);
    }
  }, [admin, router]);

  const applyData = useCallback((data: AppSettingsData) => {
    setServer(data);
    setKeys({ ...data.keys });
    setSettings({ ...data.settings });
    setDirtySecrets(new Set());
    setRevealed(new Set());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await settingsApi.get();
      if (res.data) applyData(res.data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [applyData]);

  useEffect(() => {
    if (admin) void load();
  }, [admin, load]);

  const secretSet = useMemo(() => {
    const s = new Set<string>();
    server?.meta.key_secrets.forEach((k) => s.add(k));
    server?.meta.setting_secrets.forEach((k) => s.add(k));
    return s;
  }, [server]);

  const toggleReveal = (name: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const onKeyChange = (name: string, value: string) => {
    setKeys((prev) => ({ ...prev, [name]: value }));
    if (secretSet.has(name)) {
      setDirtySecrets((prev) => new Set(prev).add(name));
    }
  };

  const onSettingChange = (name: string, value: string) => {
    setSettings((prev) => ({ ...prev, [name]: value }));
    if (secretSet.has(name)) {
      setDirtySecrets((prev) => new Set(prev).add(name));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const keysPayload: Record<string, string> = {};
      for (const [name, value] of Object.entries(keys)) {
        if (secretSet.has(name) && !dirtySecrets.has(name)) continue;
        keysPayload[name] = value;
      }
      const settingsPayload: Record<string, string> = {};
      for (const [name, value] of Object.entries(settings)) {
        if (secretSet.has(name) && !dirtySecrets.has(name)) continue;
        settingsPayload[name] = value;
      }

      const res = await settingsApi.update({
        keys: keysPayload,
        settings: settingsPayload,
      });
      if (res.data) applyData(res.data);
      MakeToast({ variant: 'success', content: 'Đã lưu cài đặt' });
    } catch (err) {
      MakeToast({ variant: 'error', content: getApiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  if (!admin) {
    return null;
  }

  return (
    <div className={dash.dashboard}>
      <HotTopicHeader />

      <div className={styles.toolbar}>
        <div className={styles.toolbarInner}>
          <div>
            <h1 className={styles.pageTitle}>
              <Settings size={20} aria-hidden />
              Cài đặt
            </h1>
            <p className={styles.pageDesc}>
              API keys (key_scraps) và cấu hình hệ thống (general_settings)
            </p>
          </div>
          <div className={styles.toolbarActions}>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={() => void handleSave()}
              disabled={saving || loading}
            >
              {saving ? <Loader2 size={16} className={styles.spin} /> : <Save size={16} />}
              Lưu
            </button>
          </div>
        </div>
      </div>

      <main className={styles.main}>
        {loading ? (
          <div className={styles.loadingBox}>
            <Loader2 size={24} className={styles.spin} />
            Đang tải…
          </div>
        ) : error ? (
          <div className={styles.errorBox}>{error}</div>
        ) : (
          <div className={styles.formStack}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>API Keys</h2>
              <p className={styles.sectionDesc}>Apify, YouTube, Gemini — bảng key_scraps</p>
              <div className={styles.fields}>
                {KEY_FIELDS.map((f) =>
                  isSecretKey(f.name, server) ? (
                    <SecretField
                      key={f.name}
                      name={f.name}
                      label={f.label}
                      hint={f.hint}
                      value={keys[f.name] ?? ''}
                      visible={revealed.has(f.name)}
                      onToggleVisible={() => toggleReveal(f.name)}
                      onChange={(v) => onKeyChange(f.name, v)}
                    />
                  ) : (
                    <label key={f.name} className={styles.field}>
                      <span>
                        {f.label}
                        <code className={styles.envName}>{f.name}</code>
                      </span>
                      <input
                        type="text"
                        value={keys[f.name] ?? ''}
                        onChange={(e) => onKeyChange(f.name, e.target.value)}
                        autoComplete="off"
                      />
                      {f.hint ? <em className={styles.fieldHint}>{f.hint}</em> : null}
                    </label>
                  )
                )}
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Alert</h2>
              <p className={styles.sectionDesc}>Ngưỡng hot / xu hướng — general_settings</p>
              <div className={styles.fieldsRow}>
                {ALERT_FIELDS.map((f) => (
                  <label key={f.name} className={styles.field}>
                    <span>
                      {f.label}
                      <code className={styles.envName}>{f.name}</code>
                    </span>
                    <input
                      type="number"
                      value={settings[f.name] ?? ''}
                      onChange={(e) => onSettingChange(f.name, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Mail</h2>
              <p className={styles.sectionDesc}>Cấu hình SMTP — general_settings</p>
              <div className={styles.fields}>
                {MAIL_FIELDS.map((f) =>
                  isSecretKey(f.name, server) ? (
                    <SecretField
                      key={f.name}
                      name={f.name}
                      label={f.label}
                      value={settings[f.name] ?? ''}
                      visible={revealed.has(f.name)}
                      onToggleVisible={() => toggleReveal(f.name)}
                      onChange={(v) => onSettingChange(f.name, v)}
                    />
                  ) : (
                    <label key={f.name} className={styles.field}>
                      <span>
                        {f.label}
                        <code className={styles.envName}>{f.name}</code>
                      </span>
                      <input
                        type="text"
                        value={settings[f.name] ?? ''}
                        onChange={(e) => onSettingChange(f.name, e.target.value)}
                        autoComplete="off"
                      />
                      {f.hint ? <em className={styles.fieldHint}>{f.hint}</em> : null}
                    </label>
                  )
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
