'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api/client';
import { channelsApi, type ChannelItem } from '@/lib/api/channels';
import { isPlatformSelectable, SOCIAL_PLATFORM_OPTIONS } from '@/lib/utils/socialPlatforms';
import { MakeToast } from '@/lib/utils/toast';
import { PlatformBadge } from './PlatformBadge';
import styles from './ChannelCatalogModal.module.scss';

interface ChannelCatalogModalProps {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

interface ChannelFormState {
  name: string;
  url: string;
  type_channel: string;
}

const EMPTY_FORM: ChannelFormState = {
  name: '',
  url: '',
  type_channel: 'youtube',
};

export function ChannelCatalogModal({ open, onClose, onChanged }: ChannelCatalogModalProps) {
  const [items, setItems] = useState<ChannelItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ChannelFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [urlLocked, setUrlLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await channelsApi.list({ per_page: 100 });
      setItems(res.data?.result || []);
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
    setEditingId(null);
    setUrlLocked(false);
    void load();
  }, [open, load]);

  if (!open) return null;

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setUrlLocked(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    const url = form.url.trim();
    if (!name || !url) {
      MakeToast({ variant: 'warning', content: 'Vui lòng nhập tên và URL kênh' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        type_channel: isPlatformSelectable(form.type_channel) ? form.type_channel : 'youtube',
        ...(urlLocked ? {} : { url }),
      };
      if (editingId != null) {
        await channelsApi.update(editingId, payload);
        MakeToast({ variant: 'success', content: 'Đã cập nhật kênh' });
      } else {
        await channelsApi.create({ ...payload, url });
        MakeToast({ variant: 'success', content: 'Đã thêm kênh' });
      }
      resetForm();
      await load();
      onChanged?.();
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: ChannelItem) => {
    setEditingId(item.id);
    setUrlLocked(item.can_edit_url === false || Boolean(item.has_scraper_runs));
    setForm({
      name: item.name || '',
      url: item.url || '',
      type_channel: item.type_channel || 'youtube',
    });
  };

  const handleDelete = async (item: ChannelItem) => {
    const ok = window.confirm(`Xóa kênh "${item.name}"?`);
    if (!ok) return;
    setDeletingId(item.id);
    try {
      await channelsApi.remove(item.id);
      MakeToast({ variant: 'success', content: 'Đã xóa kênh' });
      if (editingId === item.id) resetForm();
      await load();
      onChanged?.();
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="channel-catalog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 id="channel-catalog-title">Quản lý kênh</h2>
            <p className={styles.desc}>Danh sách kênh dùng để gắn vào đối tượng và chạy scraper</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <form className={styles.form} onSubmit={submit}>
          <label>
            <span>Tên kênh</span>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="VD: Theanh28"
              required
            />
          </label>
          <label>
            <span>URL</span>
            <input
              value={form.url}
              onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
              placeholder="https://www.youtube.com/@..."
              required
              readOnly={urlLocked}
              disabled={urlLocked}
              title={
                urlLocked ? 'Không thể sửa URL vì kênh đã có bài scrape' : undefined
              }
            />
            {urlLocked && (
              <em className={styles.fieldHint}>
                Không thể sửa URL vì kênh đã có bài scrape
              </em>
            )}
          </label>
          <label>
            <span>Nền tảng</span>
            <select
              value={form.type_channel}
              onChange={(e) => setForm((prev) => ({ ...prev, type_channel: e.target.value }))}
            >
              {SOCIAL_PLATFORM_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id} disabled={!isPlatformSelectable(opt.id)}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.formActions}>
            {editingId != null && (
              <button type="button" className={styles.cancelBtn} onClick={resetForm} disabled={saving}>
                Hủy sửa
              </button>
            )}
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              <Plus size={14} aria-hidden />
              {saving ? 'Đang lưu…' : editingId != null ? 'Lưu kênh' : 'Thêm kênh'}
            </button>
          </div>
        </form>

        <div className={styles.list}>
          {loading ? (
            <div className={styles.empty}>
              <Loader2 size={18} className={styles.spin} /> Đang tải…
            </div>
          ) : items.length === 0 ? (
            <div className={styles.empty}>Chưa có kênh nào.</div>
          ) : (
            items.map((item) => (
              <article key={item.id} className={styles.row}>
                <div>
                  <strong>{item.name}</strong>
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    {item.url}
                  </a>
                  <PlatformBadge platform={item.type_channel} />
                </div>
                <div className={styles.rowActions}>
                  <button type="button" onClick={() => startEdit(item)} aria-label="Sửa">
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(item)}
                    disabled={deletingId === item.id}
                    aria-label="Xóa"
                  >
                    {deletingId === item.id ? (
                      <Loader2 size={14} className={styles.spin} />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
