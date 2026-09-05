'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Play, Plus, Search, Trash2, X, Info } from 'lucide-react';
import { Pagination } from '@/components/common/Pagination/Pagination';
import { getApiErrorMessage } from '@/lib/api/client';
import {
  schedulesApi,
  type ScheduleItem,
} from '@/lib/api/schedules';
import { isAdmin } from '@/lib/config/auth';
import { DEFAULT_AFTER_LOGIN } from '@/lib/config/navigation';
import { cn } from '@/lib/utils';
import {
  CRON_FORMAT_HINT,
  describeCronExpression,
  explainCronExpression,
  isCronExpressionInvalid,
} from '@/lib/utils/cronDescribe';
import { MakeToast } from '@/lib/utils/toast';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import { HotTopicHeader } from './HotTopicHeader';
import dash from './HotTopicDashboard.module.scss';
import styles from './ScheduleManagement.module.scss';

const PAGE_SIZE = 50;
/** Poll while any row is `running` so success/failed appear without manual refresh. */
const RUNNING_POLL_MS = 3000;

interface ScheduleFormState {
  name: string;
  cron_expression: string;
  command: string;
  enabled: boolean;
}

const EMPTY_FORM: ScheduleFormState = {
  name: '',
  cron_expression: '0 5 * * *',
  command: '',
  enabled: true,
};

type FormMode = 'create' | 'edit';

function statusLabel(status: string) {
  switch (String(status).toLowerCase()) {
    case 'running':
      return 'Đang chạy';
    case 'success':
      return 'Thành công';
    case 'failed':
      return 'Lỗi';
    default:
      return 'Chờ';
  }
}

export function ScheduleManagement() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const admin = isAdmin(currentUser?.role);

  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ScheduleFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [runningId, setRunningId] = useState<number | null>(null);

  useEffect(() => {
    if (!admin) {
      router.replace(DEFAULT_AFTER_LOGIN);
    }
  }, [admin, router]);

  const loadList = useCallback(
    async (options?: { page?: number; q?: string; silent?: boolean }) => {
      const nextPage = options?.page ?? page;
      const nextQ = options?.q ?? query;
      const silent = Boolean(options?.silent);
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await schedulesApi.list({
          page: nextPage,
          per_page: PAGE_SIZE,
          q: nextQ || undefined,
        });
        const data = res.data;
        if (!data) throw new Error('Empty schedules response');
        setItems(data.result || []);
        setPage(data.pagination?.current_page ?? nextPage);
        setTotalPages(Math.max(1, data.pagination?.total_pages ?? 1));
        setTotalRecords(data.pagination?.total_records ?? 0);
      } catch (err) {
        if (!silent) {
          setError(getApiErrorMessage(err));
          setItems([]);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [page, query]
  );

  useEffect(() => {
    if (!admin) return;
    void loadList({ page: 1, q: query });
  }, [admin, loadList, query]);

  useEffect(() => {
    if (!admin) return;
    const timer = window.setTimeout(() => {
      setPage(1);
      setQuery(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [admin, searchInput]);

  const hasRunning = useMemo(
    () => items.some((item) => String(item.last_status || '').toLowerCase() === 'running'),
    [items]
  );

  useEffect(() => {
    if (!admin || !hasRunning) return;
    const timer = window.setInterval(() => {
      void loadList({ page, q: query, silent: true });
    }, RUNNING_POLL_MS);
    return () => window.clearInterval(timer);
  }, [admin, hasRunning, loadList, page, query]);

  const openCreate = () => {
    setFormMode('create');
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      command: 'npm run app:',
    });
    setFormOpen(true);
  };

  const openEdit = (item: ScheduleItem) => {
    setFormMode('edit');
    setEditingId(item.id);
    setForm({
      name: item.name,
      cron_expression: item.cron_expression,
      command: item.command,
      enabled: Boolean(item.enabled),
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      MakeToast({ variant: 'warning', content: 'Vui lòng nhập tên lệnh' });
      return;
    }
    if (!form.cron_expression.trim()) {
      MakeToast({ variant: 'warning', content: 'Vui lòng nhập cron (vd: 0 17 * * *)' });
      return;
    }
    if (isCronExpressionInvalid(form.cron_expression)) {
      const err =
        explainCronExpression(form.cron_expression).error ||
        'Cron sai định dạng (cần 5 field: phút giờ ngày tháng thứ)';
      MakeToast({ variant: 'warning', content: err });
      return;
    }
    if (!form.command.trim()) {
      MakeToast({ variant: 'warning', content: 'Vui lòng chọn câu lệnh chạy' });
      return;
    }

    setSaving(true);
    try {
      if (formMode === 'create') {
        await schedulesApi.create({
          name: form.name.trim(),
          cron_expression: form.cron_expression.trim(),
          command: form.command.trim(),
          enabled: form.enabled,
        });
        MakeToast({ variant: 'success', content: 'Đã thêm lịch' });
      } else if (editingId != null) {
        await schedulesApi.update(editingId, {
          name: form.name.trim(),
          cron_expression: form.cron_expression.trim(),
          command: form.command.trim(),
          enabled: form.enabled,
        });
        MakeToast({ variant: 'success', content: 'Đã cập nhật lịch' });
      }
      setFormOpen(false);
      await loadList({ page: formMode === 'create' ? 1 : page, q: query });
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: ScheduleItem) => {
    if (String(item.last_status).toLowerCase() === 'running') {
      MakeToast({ variant: 'warning', content: 'Không thể xóa lịch đang chạy' });
      return;
    }
    const ok = window.confirm(`Xóa lịch "${item.name}"?`);
    if (!ok) return;
    setDeletingId(item.id);
    try {
      await schedulesApi.remove(item.id);
      MakeToast({ variant: 'success', content: 'Đã xóa lịch' });
      const nextPage = items.length <= 1 && page > 1 ? page - 1 : page;
      await loadList({ page: nextPage, q: query });
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleEnabled = async (item: ScheduleItem) => {
    try {
      await schedulesApi.update(item.id, { enabled: !item.enabled });
      MakeToast({
        variant: 'success',
        content: !item.enabled ? 'Đã bật lịch' : 'Đã tắt lịch',
      });
      await loadList({ page, q: query });
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    }
  };

  const handleRunNow = async (item: ScheduleItem) => {
    setRunningId(item.id);
    try {
      await schedulesApi.runNow(item.id);
      MakeToast({ variant: 'success', content: `Đã khởi chạy: ${item.name}` });
      await loadList({ page, q: query });
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    } finally {
      setRunningId(null);
    }
  };

  const paginationLabel = useMemo(() => {
    if (totalRecords === 0) return '0 lịch';
    return undefined;
  }, [totalRecords]);

  const cronExplain = useMemo(
    () => explainCronExpression(form.cron_expression),
    [form.cron_expression]
  );

  if (!admin) {
    return (
      <div className={dash.dashboard}>
        <HotTopicHeader />
        <div className={dash.emptyState}>Không có quyền truy cập…</div>
      </div>
    );
  }

  return (
    <div className={dash.dashboard}>
      <HotTopicHeader />

      <div className={styles.toolbar}>
        <div className={styles.toolbarInner}>
          <div>
            <h1 className={styles.pageTitle}>Quản lý lịch chạy</h1>
            <p className={styles.pageDesc}>
              Cron theo giờ Việt (APP_TIMEZONE). Đến giờ PM2 scheduler spawn lệnh bất đồng bộ.
            </p>
          </div>

          <div className={styles.toolbarActions}>
            <label className={styles.searchBox}>
              <Search size={16} aria-hidden />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm theo tên / lệnh / cron…"
                aria-label="Tìm kiếm lịch"
              />
            </label>
            <button type="button" className={styles.addBtn} onClick={openCreate}>
              <Plus size={16} aria-hidden />
              Thêm lịch
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
            <span>Thời gian</span>
            <span>Tên lệnh</span>
            <span>Câu lệnh chạy</span>
            <span>Trạng thái</span>
            <span>Bật</span>
            <span className={styles.actionsHead}>Thao tác</span>
          </div>

          <div className={styles.tableList}>
            {loading && items.length === 0 ? (
              <div className={dash.emptyState}>
                <Loader2 size={20} className={dash.spin} aria-hidden /> Đang tải lịch…
              </div>
            ) : items.length === 0 ? (
              <div className={dash.emptyState}>Chưa có lịch nào.</div>
            ) : (
              items.map((item) => {
                const status = String(item.last_status || 'idle').toLowerCase();
                const isRunning = status === 'running';
                return (
                  <article key={item.id} className={styles.tableRow}>
                    <div>
                      <div className={styles.cellMono}>{item.cron_expression}</div>
                      <div className={styles.cellMuted}>
                        {describeCronExpression(item.cron_expression)}
                      </div>
                    </div>
                    <div>
                      <div className={styles.cellStrong}>{item.name}</div>
                      {item.last_run_at && (
                        <div className={styles.cellMuted}>
                          Lần chạy:{' '}
                          {new Date(item.last_run_at).toLocaleString('vi-VN')}
                        </div>
                      )}
                    </div>
                    <div className={styles.cellMono}>{item.command}</div>
                    <div>
                      <span
                        className={cn(
                          styles.badge,
                          status === 'running' && styles.badgeRunning,
                          status === 'success' && styles.badgeSuccess,
                          status === 'failed' && styles.badgeFailed,
                          status === 'idle' && styles.badgeIdle
                        )}
                        title={item.last_error || undefined}
                      >
                        {statusLabel(status)}
                      </span>
                      {item.last_error && (
                        <div className={styles.cellError} title={item.last_error}>
                          {item.last_error}
                        </div>
                      )}
                    </div>
                    <div>
                      <button
                        type="button"
                        className={cn(
                          styles.toggleBtn,
                          item.enabled ? styles.toggleOn : styles.toggleOff
                        )}
                        onClick={() => void handleToggleEnabled(item)}
                        aria-pressed={item.enabled}
                      >
                        {item.enabled ? 'Bật' : 'Tắt'}
                      </button>
                    </div>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => void handleRunNow(item)}
                        disabled={isRunning || runningId === item.id}
                        aria-label={`Chạy ngay ${item.name}`}
                        title="Chạy ngay"
                      >
                        {runningId === item.id || isRunning ? (
                          <Loader2 size={15} className={dash.spin} aria-hidden />
                        ) : (
                          <Play size={15} aria-hidden />
                        )}
                      </button>
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
                        onClick={() => void handleDelete(item)}
                        disabled={isRunning || deletingId === item.id}
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
                );
              })
            )}
          </div>

          <div className={styles.pagination}>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalRecords={totalRecords}
              unitLabel="lịch"
              info={paginationLabel}
              disabled={loading}
              onChange={(nextPage) => loadList({ page: nextPage, q: query })}
            />
          </div>
        </section>
      </main>

      {formOpen && (
        <div className={styles.modalOverlay} role="presentation">
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-form-title"
          >
            <div className={styles.modalHeader}>
              <h2 id="schedule-form-title">
                {formMode === 'create' ? 'Thêm lịch' : 'Sửa lịch'}
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
            <form className={styles.modalBody} onSubmit={(e) => void submitForm(e)}>
              <label className={styles.field}>
                <span>Thời gian (cron)</span>
                <input
                  type="text"
                  value={form.cron_expression}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, cron_expression: e.target.value }))
                  }
                  placeholder="0 17 * * *"
                  required
                  autoFocus={formMode === 'create'}
                  className={cn(
                    styles.monoInput,
                    form.cron_expression.trim() && !cronExplain.valid && styles.cronInputError
                  )}
                  aria-invalid={Boolean(
                    form.cron_expression.trim() && !cronExplain.valid
                  )}
                />
                <em className={styles.fieldHint}>{CRON_FORMAT_HINT}</em>
                {form.cron_expression.trim() ? (
                  cronExplain.valid ? (
                    <div className={styles.cronExplain} role="status">
                      <Info size={16} className={styles.cronExplainIcon} aria-hidden />
                      <ul className={styles.cronExplainGroups}>
                        {cronExplain.groups.map((group) => (
                          <li key={group.label} className={styles.cronExplainGroup}>
                            <span className={styles.cronExplainLabel}>{group.label}:</span>
                            <ul className={styles.cronExplainItems}>
                              {group.items.map((item) => (
                                <li key={`${group.label}-${item.text}`}>{item.text}</li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className={cn(styles.cronExplain, styles.cronExplainError)} role="alert">
                      <Info size={16} className={styles.cronExplainIcon} aria-hidden />
                      <p className={styles.cronExplainErrorText}>
                        {cronExplain.error ||
                          'Sai định dạng — cần đúng 5 field: phút giờ ngày tháng thứ.'}
                      </p>
                    </div>
                  )
                ) : null}
              </label>
              <label className={styles.field}>
                <span>Tên lệnh</span>
                <input
                  type="text"
                  value={form.name}
                  maxLength={191}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value.slice(0, 191) }))
                  }
                  placeholder="VD: Báo vượt ngưỡng"
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Câu lệnh chạy</span>
                <input
                  type="text"
                  value={form.command}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, command: e.target.value }))
                  }
                  placeholder="npm run app:alert-gmail"
                  required
                  className={styles.monoInput}
                />
                <em className={styles.fieldHint}>
                  Định dạng: npm run app:tên-script (khớp scripts trong package.json backend)
                </em>
              </label>
              <label className={styles.checkField}>
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, enabled: e.target.checked }))
                  }
                />
                <span>Bật lịch</span>
              </label>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={closeForm}>
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
