'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Compass,
  Crown,
  Globe,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api/client';
import { channelsApi, type ChannelItem } from '@/lib/api/channels';
import { SOCIAL_PLATFORM_OPTIONS } from '@/lib/utils/socialPlatforms';
import { cn } from '@/lib/utils';
import { MakeToast } from '@/lib/utils/toast';
import { PlatformBadge } from './PlatformBadge';
import dash from './HotTopicDashboard.module.scss';
import styles from './ChannelManagement.module.scss';

const PAGE_SIZE = 20;

interface ChannelFormState {
  name: string;
  url: string;
  type_channel: string;
}

const EMPTY_FORM: ChannelFormState = {
  name: '',
  url: '',
  type_channel: 'facebook',
};

type FormMode = 'create' | 'edit';

export function ChannelManagement() {
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [items, setItems] = useState<ChannelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ChannelFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadList = useCallback(
    async (options?: { page?: number; q?: string; type_channel?: string }) => {
      const nextPage = options?.page ?? page;
      const nextQ = options?.q ?? query;
      const nextPlatform = options?.type_channel ?? platformFilter;
      setLoading(true);
      setError(null);
      try {
        const res = await channelsApi.list({
          page: nextPage,
          per_page: PAGE_SIZE,
          q: nextQ || undefined,
          type_channel: nextPlatform || undefined,
        });
        const data = res.data;
        if (!data) throw new Error('Empty channels response');
        setItems(data.result || []);
        setPage(data.pagination?.current_page ?? nextPage);
        setTotalPages(Math.max(1, data.pagination?.total_pages ?? 1));
        setTotalRecords(data.pagination?.total_records ?? 0);
      } catch (err) {
        setError(getApiErrorMessage(err));
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [page, platformFilter, query]
  );

  useEffect(() => {
    void loadList({ page: 1, q: query, type_channel: platformFilter });
  }, [loadList, query, platformFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setQuery(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const openCreate = () => {
    setFormMode('create');
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (item: ChannelItem) => {
    setFormMode('edit');
    setEditingId(item.id);
    setForm({
      name: item.name || '',
      url: item.url || '',
      type_channel: item.type_channel || 'facebook',
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const submitForm = async (event: React.FormEvent) => {
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
        url,
        type_channel: form.type_channel.trim() || 'facebook',
      };
      if (formMode === 'create') {
        await channelsApi.create(payload);
        MakeToast({ variant: 'success', content: 'Đã thêm kênh' });
      } else if (editingId != null) {
        await channelsApi.update(editingId, payload);
        MakeToast({ variant: 'success', content: 'Đã cập nhật kênh' });
      }
      closeForm();
      await loadList({
        page: formMode === 'create' ? 1 : page,
        q: query,
        type_channel: platformFilter,
      });
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: ChannelItem) => {
    const ok = window.confirm(`Xóa kênh "${item.name}"?`);
    if (!ok) return;

    setDeletingId(item.id);
    try {
      await channelsApi.remove(item.id);
      MakeToast({ variant: 'success', content: 'Đã xóa kênh' });
      const nextPage = items.length <= 1 && page > 1 ? page - 1 : page;
      await loadList({ page: nextPage, q: query, type_channel: platformFilter });
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    } finally {
      setDeletingId(null);
    }
  };

  const paginationLabel = useMemo(() => {
    if (totalRecords === 0) return '0 kênh';
    return `Trang ${page}/${totalPages} · ${totalRecords} kênh`;
  }, [page, totalPages, totalRecords]);

  return (
    <div className={dash.dashboard}>
      <header className={dash.header}>
        <div className={dash.headerInner}>
          <Link href="/home" className={dash.logo}>
            <span className={dash.logoSocial}>social</span>
            <span className={dash.logoTrend}>trend</span>
            <span className={dash.logoBy}>by Younet Media</span>
          </Link>

          <nav className={dash.mainNav} aria-label="Main navigation">
            <Link href="/home" className={dash.navLink}>
              <BarChart3 size={16} aria-hidden />
              Xếp hạng
            </Link>
            <Link href="/subjects" className={dash.navLink}>
              <Users size={16} aria-hidden />
              Đối tượng
            </Link>
            <a href="#" className={dash.navLink}>
              <Compass size={16} aria-hidden />
              Khám phá
            </a>
            <a href="#" className={dash.navLink}>
              <Crown size={16} aria-hidden />
              Bảng giá
            </a>
          </nav>

          <div className={dash.headerActions}>
            <button type="button" className={dash.loginBtn}>
              Đăng nhập
            </button>
            <button type="button" className={dash.langBtn} aria-label="Ngôn ngữ">
              <Globe size={18} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.toolbarInner}>
          <div>
            <h1 className={styles.pageTitle}>Quản lý kênh theo dõi</h1>
            <p className={styles.pageDesc}>
              Thêm/sửa/xóa kênh mạng xã hội dùng để gắn vào đối tượng và chạy scraper
            </p>
          </div>

          <div className={styles.toolbarActions}>
            <Link href="/subjects" className={styles.backBtn}>
              <ArrowLeft size={16} aria-hidden />
              Đối tượng
            </Link>
            <label className={styles.searchBox}>
              <Search size={16} aria-hidden />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm theo tên hoặc URL…"
                aria-label="Tìm kiếm kênh"
              />
            </label>
            <select
              className={styles.filterSelect}
              value={platformFilter}
              onChange={(e) => {
                setPage(1);
                setPlatformFilter(e.target.value);
              }}
              aria-label="Lọc theo nền tảng"
            >
              <option value="">Tất cả nền tảng</option>
              {SOCIAL_PLATFORM_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button type="button" className={styles.addBtn} onClick={openCreate}>
              <Plus size={16} aria-hidden />
              Thêm kênh
            </button>
          </div>
        </div>
      </div>

      <main className={styles.main}>
        {error && (
          <div className={dash.emptyState} role="alert">
            {error}
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                className={dash.loadMoreBtn}
                onClick={() => loadList({ page, q: query, type_channel: platformFilter })}
              >
                Thử lại
              </button>
            </div>
          </div>
        )}

        <section className={styles.tableSection}>
          <div className={styles.tableHeader}>
            <span>Tên kênh</span>
            <span>URL</span>
            <span>Nền tảng</span>
            <span className={styles.actionsHead}>Thao tác</span>
          </div>

          <div className={styles.tableList}>
            {loading && items.length === 0 ? (
              <div className={dash.emptyState}>
                <Loader2 size={20} className={dash.spin} aria-hidden /> Đang tải kênh…
              </div>
            ) : items.length === 0 ? (
              <div className={dash.emptyState}>Không có kênh phù hợp.</div>
            ) : (
              items.map((item) => (
                <article key={item.id} className={styles.tableRow}>
                  <div className={styles.channelName}>{item.name}</div>
                  <div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.channelUrl}
                    >
                      {item.url}
                    </a>
                  </div>
                  <div>
                    <PlatformBadge platform={item.type_channel} size="md" />
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => openEdit(item)}
                      aria-label={`Sửa ${item.name}`}
                      title="Sửa"
                    >
                      <Pencil size={15} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={cn(styles.iconBtn, styles.deleteBtn)}
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                      aria-label={`Xóa ${item.name}`}
                      title="Xóa"
                    >
                      {deletingId === item.id ? (
                        <Loader2 size={15} className={dash.spin} aria-hidden />
                      ) : (
                        <Trash2 size={15} aria-hidden />
                      )}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className={styles.pagination}>
            <span>{paginationLabel}</span>
            <div className={styles.paginationBtns}>
              <button
                type="button"
                className={dash.loadMoreBtn}
                disabled={loading || page <= 1}
                onClick={() => loadList({ page: page - 1, q: query, type_channel: platformFilter })}
              >
                Trang trước
              </button>
              <button
                type="button"
                className={dash.loadMoreBtn}
                disabled={loading || page >= totalPages}
                onClick={() => loadList({ page: page + 1, q: query, type_channel: platformFilter })}
              >
                Trang sau
              </button>
            </div>
          </div>
        </section>
      </main>

      {formOpen && (
        <div className={styles.modalOverlay} role="presentation" onClick={closeForm}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="channel-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 id="channel-form-title">
                {formMode === 'create' ? 'Thêm kênh' : 'Sửa kênh'}
              </h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={closeForm}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>
            <form className={styles.modalBody} onSubmit={submitForm}>
              <label className={styles.field}>
                <span>Tên kênh</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="VD: Tin tức VTV24"
                  required
                  autoFocus
                />
              </label>
              <label className={styles.field}>
                <span>URL</span>
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                  placeholder="https://www.facebook.com/..."
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Nền tảng</span>
                <select
                  value={form.type_channel}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, type_channel: e.target.value }))
                  }
                >
                  {SOCIAL_PLATFORM_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={closeForm} disabled={saving}>
                  Hủy
                </button>
                <button type="submit" className={styles.saveBtn} disabled={saving}>
                  {saving ? 'Đang lưu…' : formMode === 'create' ? 'Thêm' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
