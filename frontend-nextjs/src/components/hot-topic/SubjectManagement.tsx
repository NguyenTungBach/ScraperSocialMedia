'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Compass,
  Crown,
  Globe,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api/client';
import {
  subjectsApi,
  type SubjectListItem,
} from '@/lib/api/subjects';
import {
  colorForId,
  formatMetric,
  formatScore,
} from '@/lib/mock/hotTopics';
import { cn } from '@/lib/utils';
import { MakeToast } from '@/lib/utils/toast';
import { SubjectDetailModal } from './SubjectDetailModal';
import dash from './HotTopicDashboard.module.scss';
import styles from './SubjectManagement.module.scss';

const PAGE_SIZE = 20;

function SentimentFace({ value }: { value: number }) {
  const tone =
    value >= 0.3
      ? dash.sentimentPositive
      : value <= -0.1
        ? dash.sentimentNegative
        : dash.sentimentNeutral;
  const emoji = value >= 0.3 ? '😊' : value <= -0.1 ? '😞' : '😐';
  return (
    <span className={cn(dash.sentimentFace, tone)} aria-hidden>
      {emoji}
    </span>
  );
}

function TopicThumbnail({ color, title }: { color: string; title: string }) {
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <div className={dash.thumbnail} style={{ backgroundColor: color }} aria-hidden>
      {initials || '?'}
    </div>
  );
}

type FormMode = 'create' | 'edit';

interface SubjectFormState {
  name: string;
  normalized_name: string;
}

const EMPTY_FORM: SubjectFormState = { name: '', normalized_name: '' };

export function SubjectManagement() {
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [items, setItems] = useState<SubjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSubjectId, setDetailSubjectId] = useState<number | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SubjectFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadList = useCallback(async (options?: { page?: number; q?: string }) => {
    const nextPage = options?.page ?? 1;
    const nextQ = options?.q ?? query;
    setLoading(true);
    setError(null);
    try {
      const res = await subjectsApi.list({
        page: nextPage,
        per_page: PAGE_SIZE,
        q: nextQ || undefined,
      });
      const data = res.data;
      if (!data) throw new Error('Empty subjects response');
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
  }, [query]);

  useEffect(() => {
    void loadList({ page: 1, q: query });
  }, [loadList, query]);

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

  const openEdit = (item: SubjectListItem) => {
    setFormMode('edit');
    setEditingId(item.id);
    setForm({
      name: item.name || '',
      normalized_name: item.normalized_name || '',
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
    if (!name) {
      MakeToast({ variant: 'warning', content: 'Vui lòng nhập tên đối tượng' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        normalized_name: form.normalized_name.trim() || null,
      };
      if (formMode === 'create') {
        await subjectsApi.create({ ...payload, source: 'manual' });
        MakeToast({ variant: 'success', content: 'Đã thêm đối tượng' });
      } else if (editingId != null) {
        await subjectsApi.update(editingId, payload);
        MakeToast({ variant: 'success', content: 'Đã cập nhật đối tượng' });
      }
      setFormOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      await loadList({ page: formMode === 'create' ? 1 : page, q: query });
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: SubjectListItem) => {
    if (!item.can_delete || item.has_scraper_runs) {
      MakeToast({
        variant: 'warning',
        content: 'Không thể xóa đối tượng đang có bài liên kết (subjects_scraper_runs)',
      });
      return;
    }
    const ok = window.confirm(`Xóa cứng đối tượng "${item.name}"?`);
    if (!ok) return;

    setDeletingId(item.id);
    try {
      await subjectsApi.remove(item.id);
      MakeToast({ variant: 'success', content: 'Đã xóa đối tượng' });
      const nextPage = items.length <= 1 && page > 1 ? page - 1 : page;
      await loadList({ page: nextPage, q: query });
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    } finally {
      setDeletingId(null);
    }
  };

  const openDetail = (item: SubjectListItem) => {
    setDetailSubjectId(item.id);
    setDetailOpen(true);
  };

  const paginationLabel = useMemo(() => {
    if (totalRecords === 0) return '0 đối tượng';
    return `Trang ${page}/${totalPages} · ${totalRecords} đối tượng`;
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
            <Link href="/subjects" className={cn(dash.navLink, dash.navLinkActive)}>
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
            <h1 className={styles.pageTitle}>Quản lý đối tượng</h1>
            <p className={styles.pageDesc}>Thêm, sửa, xóa và xem bài viết liên quan</p>
          </div>

          <div className={styles.toolbarActions}>
            <label className={styles.searchBox}>
              <Search size={16} aria-hidden />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm theo tên hoặc biệt danh…"
                aria-label="Tìm kiếm đối tượng"
              />
            </label>
            <button type="button" className={styles.addBtn} onClick={openCreate}>
              <Plus size={16} aria-hidden />
              Thêm đối tượng
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
                onClick={() => loadList({ page, q: query })}
              >
                Thử lại
              </button>
            </div>
          </div>
        )}

        <section className={styles.tableSection}>
          <div className={styles.tableHeader}>
            <span>Tên</span>
            <span>Biệt danh</span>
            <span>Chỉ số phân tích</span>
            <span className={styles.actionsHead}>Thao tác</span>
          </div>

          <div className={styles.tableList}>
            {loading && items.length === 0 ? (
              <div className={dash.emptyState}>
                <Loader2 size={20} className={dash.spin} aria-hidden /> Đang tải đối tượng…
              </div>
            ) : items.length === 0 ? (
              <div className={dash.emptyState}>Không có đối tượng phù hợp.</div>
            ) : (
              items.map((item) => {
                const agg = item.aggregate;
                const title = item.name?.trim() || `Subject #${item.id}`;
                const nick = item.normalized_name?.trim() || '—';
                return (
                  <article key={item.id} className={styles.tableRow}>
                    <div className={dash.topicInfo}>
                      <TopicThumbnail color={colorForId(item.id)} title={title} />
                      <div className={dash.topicMeta}>
                        <div className={dash.topicTitleRow}>
                          <h3 className={dash.topicTitle}>{title}</h3>
                          {agg?.is_new && <span className={dash.newBadge}>Mới xuất hiện</span>}
                        </div>
                      </div>
                    </div>

                    <div className={styles.nickname}>{nick}</div>

                    <div className={dash.metrics}>
                      <div className={dash.metricItem}>
                        <span className={dash.metricLabel}>Tổng lượng thảo luận</span>
                        <span className={dash.metricValue}>
                          {formatMetric(agg?.discussion ?? 0)}
                          {agg?.trend_direction === 'up' && (
                            <TrendingUp size={14} className={dash.trendUp} aria-label="Uptrend" />
                          )}
                          {agg?.trend_direction === 'down' && (
                            <TrendingDown
                              size={14}
                              className={dash.trendDown}
                              aria-label="Downtrend"
                            />
                          )}
                        </span>
                      </div>
                      <div className={dash.metricItem}>
                        <span className={dash.metricLabel}>Tổng lượng tương tác</span>
                        <span className={dash.metricValue}>
                          {formatMetric(agg?.interaction ?? 0)}
                        </span>
                      </div>
                      <div className={dash.metricItem}>
                        <span className={dash.metricLabel}>Chỉ số cảm xúc</span>
                        <span className={dash.metricValue}>
                          {(agg?.sentiment ?? 0).toFixed(2).replace('.', ',')}
                          <SentimentFace value={agg?.sentiment ?? 0} />
                        </span>
                      </div>
                      <div className={dash.metricItem}>
                        <span className={dash.metricLabel}>Hot / Trend score</span>
                        <div className={dash.brandList}>
                          <span
                            className={dash.brandChip}
                            title={`Hot score: ${formatScore(agg?.hot_score ?? 0)}`}
                          >
                            H {formatScore(agg?.hot_score ?? 0)}
                          </span>
                          <span
                            className={dash.brandChip}
                            title={`Trend score: ${formatScore(agg?.trend_score ?? 0)}`}
                          >
                            T {formatScore(agg?.trend_score ?? 0)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={dash.rowActionBtn}
                        onClick={() => openDetail(item)}
                      >
                        Chi tiết
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => openEdit(item)}
                        aria-label={`Sửa ${title}`}
                        title="Sửa"
                      >
                        <Pencil size={15} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={cn(styles.iconBtn, styles.deleteBtn)}
                        onClick={() => handleDelete(item)}
                        disabled={!item.can_delete || deletingId === item.id}
                        aria-label={`Xóa ${title}`}
                        title={
                          item.can_delete
                            ? 'Xóa'
                            : 'Không thể xóa vì đang có subjects_scraper_runs'
                        }
                      >
                        {deletingId === item.id ? (
                          <Loader2 size={15} className={dash.spin} aria-hidden />
                        ) : (
                          <Trash2 size={15} aria-hidden />
                        )}
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <div className={styles.pagination}>
            <span>{paginationLabel}</span>
            <div className={styles.paginationBtns}>
              <button
                type="button"
                className={dash.loadMoreBtn}
                disabled={loading || page <= 1}
                onClick={() => loadList({ page: page - 1, q: query })}
              >
                Trang trước
              </button>
              <button
                type="button"
                className={dash.loadMoreBtn}
                disabled={loading || page >= totalPages}
                onClick={() => loadList({ page: page + 1, q: query })}
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
            aria-labelledby="subject-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 id="subject-form-title">
                {formMode === 'create' ? 'Thêm đối tượng' : 'Sửa đối tượng'}
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
                <span>Tên</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Họ tên / tên đối tượng"
                  required
                  autoFocus
                />
              </label>
              <label className={styles.field}>
                <span>Biệt danh</span>
                <input
                  type="text"
                  value={form.normalized_name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, normalized_name: e.target.value }))
                  }
                  placeholder="Biệt danh (không bắt buộc)"
                />
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

      <SubjectDetailModal
        open={detailOpen}
        subjectId={detailSubjectId}
        onClose={() => {
          setDetailOpen(false);
          setDetailSubjectId(null);
        }}
      />
    </div>
  );
}
