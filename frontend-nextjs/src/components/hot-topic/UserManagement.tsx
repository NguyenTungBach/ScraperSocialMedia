'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { Pagination } from '@/components/common/Pagination/Pagination';
import { getApiErrorMessage } from '@/lib/api/client';
import {
  usersApi,
  type ManagedUser,
  type UserRole,
} from '@/lib/api/users';
import { isAdmin } from '@/lib/config/auth';
import { DEFAULT_AFTER_LOGIN } from '@/lib/config/navigation';
import { validPassword, validateUserID } from '@/lib/utils/validate';
import { cn } from '@/lib/utils';
import { MakeToast } from '@/lib/utils/toast';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import { HotTopicHeader } from './HotTopicHeader';
import dash from './HotTopicDashboard.module.scss';
import styles from './UserManagement.module.scss';

const PAGE_SIZE = 20;
/** Default ON — FE không quản lý trạng thái (để sau). */
const DEFAULT_USER_STATUS = 1;

interface UserFormState {
  user_code: string;
  user_name: string;
  password: string;
  role: UserRole;
}

const EMPTY_FORM: UserFormState = {
  user_code: '',
  user_name: '',
  password: '',
  role: 'member',
};

type FormMode = 'create' | 'edit';

function roleLabel(role: string) {
  return String(role).toLowerCase() === 'admin' ? 'Admin' : 'Member';
}

export function UserManagement() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const admin = isAdmin(currentUser?.role);

  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [items, setItems] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (!admin) {
      router.replace(DEFAULT_AFTER_LOGIN);
    }
  }, [admin, router]);

  const loadList = useCallback(
    async (options?: { page?: number; q?: string; role?: UserRole | '' }) => {
      const nextPage = options?.page ?? page;
      const nextQ = options?.q ?? query;
      const nextRole = options?.role ?? roleFilter;
      setLoading(true);
      setError(null);
      try {
        const res = await usersApi.list({
          page: nextPage,
          per_page: PAGE_SIZE,
          q: nextQ || undefined,
          role: nextRole || undefined,
        });
        const data = res.data;
        if (!data) throw new Error('Empty users response');
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
    [page, query, roleFilter]
  );

  useEffect(() => {
    if (!admin) return;
    void loadList({ page: 1, q: query, role: roleFilter });
  }, [admin, loadList, query, roleFilter]);

  useEffect(() => {
    if (!admin) return;
    const timer = window.setTimeout(() => {
      setPage(1);
      setQuery(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [admin, searchInput]);

  const isEditingSelf =
    formMode === 'edit' &&
    editingId != null &&
    Number(currentUser?.id) === Number(editingId);

  const openCreate = () => {
    setFormMode('create');
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (item: ManagedUser) => {
    setFormMode('edit');
    setEditingId(item.id);
    setForm({
      user_code: item.user_code,
      user_name: item.user_name,
      password: '',
      role: (String(item.role).toLowerCase() === 'admin' ? 'admin' : 'member') as UserRole,
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateUserID(form.user_code)) {
      MakeToast({ variant: 'warning', content: 'User ID phải là 1–15 chữ số' });
      return;
    }
    if (!form.user_name.trim()) {
      MakeToast({ variant: 'warning', content: 'Vui lòng nhập tên hiển thị' });
      return;
    }
    if (formMode === 'create' || form.password) {
      if (!validPassword(form.password)) {
        MakeToast({
          variant: 'warning',
          content: 'Mật khẩu phải từ 8–16 ký tự và không chứa khoảng trắng',
        });
        return;
      }
    }

    setSaving(true);
    try {
      if (formMode === 'create') {
        await usersApi.create({
          user_code: form.user_code,
          user_name: form.user_name.trim(),
          password: form.password,
          role: form.role,
          status: DEFAULT_USER_STATUS,
        });
        MakeToast({ variant: 'success', content: 'Đã tạo tài khoản' });
      } else if (editingId != null) {
        const payload: {
          user_code: string;
          user_name: string;
          role?: UserRole;
          password?: string;
        } = {
          user_code: form.user_code,
          user_name: form.user_name.trim(),
        };
        if (!isEditingSelf) {
          payload.role = form.role;
        }
        if (form.password) payload.password = form.password;
        await usersApi.update(editingId, payload);
        MakeToast({ variant: 'success', content: 'Đã cập nhật tài khoản' });
      }
      setFormOpen(false);
      await loadList({ page: formMode === 'create' ? 1 : page, q: query });
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: ManagedUser) => {
    if (Number(currentUser?.id) === Number(item.id)) {
      MakeToast({ variant: 'warning', content: 'Không thể xóa tài khoản đang đăng nhập' });
      return;
    }
    const ok = window.confirm(`Xóa tài khoản "${item.user_name}" (${item.user_code})?`);
    if (!ok) return;
    setDeletingId(item.id);
    try {
      await usersApi.remove(item.id);
      MakeToast({ variant: 'success', content: 'Đã xóa tài khoản' });
      const nextPage = items.length <= 1 && page > 1 ? page - 1 : page;
      await loadList({ page: nextPage, q: query });
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    } finally {
      setDeletingId(null);
    }
  };

  const paginationLabel = useMemo(() => {
    if (totalRecords === 0) return '0 tài khoản';
    return undefined;
  }, [totalRecords]);

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
            <h1 className={styles.pageTitle}>Quản lý tài khoản</h1>
            <p className={styles.pageDesc}>
              Thêm / sửa / xóa user đăng nhập (admin toàn quyền, member chỉ xem)
            </p>
          </div>

          <div className={styles.toolbarActions}>
            <label className={styles.searchBox}>
              <Search size={16} aria-hidden />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm theo mã hoặc tên…"
                aria-label="Tìm kiếm tài khoản"
              />
            </label>
            <select
              className={styles.filterSelect}
              value={roleFilter}
              onChange={(e) => {
                setPage(1);
                setRoleFilter(e.target.value as UserRole | '');
              }}
              aria-label="Lọc theo quyền"
            >
              <option value="">Tất cả quyền</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>
            <button type="button" className={styles.addBtn} onClick={openCreate}>
              <Plus size={16} aria-hidden />
              Thêm tài khoản
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
            <span>User ID</span>
            <span>Tên hiển thị</span>
            <span>Quyền</span>
            <span>Cập nhật</span>
            <span className={styles.actionsHead}>Thao tác</span>
          </div>

          <div className={styles.tableList}>
            {loading && items.length === 0 ? (
              <div className={dash.emptyState}>
                <Loader2 size={20} className={dash.spin} aria-hidden /> Đang tải tài khoản…
              </div>
            ) : items.length === 0 ? (
              <div className={dash.emptyState}>Không có tài khoản phù hợp.</div>
            ) : (
              items.map((item) => {
                const isSelf = Number(currentUser?.id) === Number(item.id);
                const isAdminRole = String(item.role).toLowerCase() === 'admin';
                return (
                  <article key={item.id} className={styles.tableRow}>
                    <div className={styles.cellStrong}>{item.user_code}</div>
                    <div className={styles.cellStrong}>{item.user_name}</div>
                    <div>
                      <span
                        className={cn(
                          styles.badge,
                          isAdminRole ? styles.badgeAdmin : styles.badgeMember
                        )}
                      >
                        {roleLabel(String(item.role))}
                      </span>
                    </div>
                    <div className={styles.cellMuted}>
                      {item.updated_at
                        ? new Date(item.updated_at).toLocaleString('vi-VN')
                        : '—'}
                    </div>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => openEdit(item)}
                        aria-label={`Sửa ${item.user_name}`}
                        title="Sửa"
                      >
                        <Pencil size={15} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={cn(styles.iconBtn, styles.deleteBtn)}
                        onClick={() => void handleDelete(item)}
                        disabled={isSelf || deletingId === item.id}
                        aria-label={`Xóa ${item.user_name}`}
                        title={isSelf ? 'Không thể xóa tài khoản đang đăng nhập' : 'Xóa'}
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
              unitLabel="tài khoản"
              info={paginationLabel}
              disabled={loading}
              onChange={(nextPage) => loadList({ page: nextPage, q: query })}
            />
          </div>
        </section>
      </main>

      {formOpen && (
        <div className={styles.modalOverlay} role="presentation" onClick={closeForm}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 id="user-form-title">
                {formMode === 'create' ? 'Thêm tài khoản' : 'Sửa tài khoản'}
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
                <span>User ID</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.user_code}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      user_code: e.target.value.replace(/\D/g, '').slice(0, 15),
                    }))
                  }
                  placeholder="VD: 1122"
                  required
                  autoFocus={formMode === 'create'}
                />
              </label>
              <label className={styles.field}>
                <span>Tên hiển thị</span>
                <input
                  type="text"
                  value={form.user_name}
                  maxLength={20}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, user_name: e.target.value.slice(0, 20) }))
                  }
                  placeholder="VD: Super Admin"
                  required
                />
              </label>
              <label className={styles.field}>
                <span>
                  {formMode === 'create' ? 'Mật khẩu' : 'Mật khẩu mới (để trống nếu giữ nguyên)'}
                </span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="8–16 ký tự, không khoảng trắng"
                  required={formMode === 'create'}
                  autoComplete="new-password"
                />
                {formMode === 'edit' && (
                  <em className={styles.fieldHint}>Chỉ nhập nếu muốn đổi mật khẩu</em>
                )}
              </label>
              <label className={styles.field}>
                <span>Quyền</span>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, role: e.target.value as UserRole }))
                  }
                  disabled={isEditingSelf}
                  title={
                    isEditingSelf ? 'Không được tự sửa quyền tài khoản đang đăng nhập' : undefined
                  }
                >
                  <option value="admin">Admin — toàn quyền</option>
                  <option value="member">Member — chỉ xem</option>
                </select>
                {isEditingSelf && (
                  <em className={styles.fieldHint}>Không được tự sửa quyền của chính mình</em>
                )}
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
