'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  CalendarRange,
  GitCompareArrows,
  Loader2,
  Pencil,
  Plus,
  ScanLine,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api/client';
import { channelsApi, type ChannelItem } from '@/lib/api/channels';
import { useScraperAsyncWatcher } from '@/hooks/useScraperAsyncWatcher';
import { Pagination } from '@/components/common/Pagination/Pagination';
import { isPlatformSelectable, normalizePlatform, SOCIAL_PLATFORM_OPTIONS, urlPlaceholderForPlatform } from '@/lib/utils/socialPlatforms';
import { cn } from '@/lib/utils';
import { MakeToast } from '@/lib/utils/toast';
import { canWrite } from '@/lib/config/auth';
import { useAuthStore } from '@/store/auth';
import { HotTopicHeader } from './HotTopicHeader';
import { PlatformBadge } from './PlatformBadge';
import { ChannelSnapshotModal } from './ChannelSnapshotModal';
import { CompareChannelByDayModal } from './CompareChannelByDayModal';
import { CompareModal } from './CompareModal';
import dash from './HotTopicDashboard.module.scss';
import styles from './ChannelManagement.module.scss';

const PAGE_SIZE = 20;
/** Trần nhập chung trên FE (BE không validate max cứng cho FB/TikTok). */
const SCRAPE_LIMIT_MAX = 1_000_000_000;
/** Khớp YouTubeService.getPlaylistVideoIds — 1 lần playlistItems, tối đa 50. */
const YOUTUBE_MAX_POSTS_PER_SCRAPE = 50;
/** Khớp YouTubeService.getCommentThreads / getCommentReplies — maxResults API ≤ 100, không paginate. */
const YOUTUBE_MAX_TOP_COMMENTS = 100;
const YOUTUBE_MAX_REPLIES = 100;
const DEFAULT_MAX_POSTS = 10;
const DEFAULT_MAX_TOP_COMMENTS = 30;
const DEFAULT_MAX_REPLIES = 10;

interface ChannelFormState {
  name: string;
  url: string;
  type_channel: string;
  max_posts: number;
  max_top_comments: number;
  max_replies: number;
}

const EMPTY_FORM: ChannelFormState = {
  name: '',
  url: '',
  type_channel: 'youtube',
  max_posts: DEFAULT_MAX_POSTS,
  max_top_comments: DEFAULT_MAX_TOP_COMMENTS,
  max_replies: DEFAULT_MAX_REPLIES,
};

function clampScrapeLimit(value: unknown, fallback: number, max = SCRAPE_LIMIT_MAX): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(Math.floor(n), max);
}

function isYoutubePlatform(platform: string): boolean {
  return normalizePlatform(platform) === 'youtube';
}

/** Trần Max bài / lần cào theo nền tảng. */
function maxPostsCapForPlatform(platform: string): number {
  return isYoutubePlatform(platform) ? YOUTUBE_MAX_POSTS_PER_SCRAPE : SCRAPE_LIMIT_MAX;
}

/** Trần Max comment gốc / bài. */
function maxTopCommentsCapForPlatform(platform: string): number {
  return isYoutubePlatform(platform) ? YOUTUBE_MAX_TOP_COMMENTS : SCRAPE_LIMIT_MAX;
}

/** Trần Max reply / comment. */
function maxRepliesCapForPlatform(platform: string): number {
  return isYoutubePlatform(platform) ? YOUTUBE_MAX_REPLIES : SCRAPE_LIMIT_MAX;
}

function clampLimitsForPlatform(
  platform: string,
  limits: { max_posts: unknown; max_top_comments: unknown; max_replies: unknown }
) {
  return {
    max_posts: clampScrapeLimit(
      limits.max_posts,
      DEFAULT_MAX_POSTS,
      maxPostsCapForPlatform(platform)
    ),
    max_top_comments: clampScrapeLimit(
      limits.max_top_comments,
      DEFAULT_MAX_TOP_COMMENTS,
      maxTopCommentsCapForPlatform(platform)
    ),
    max_replies: clampScrapeLimit(
      limits.max_replies,
      DEFAULT_MAX_REPLIES,
      maxRepliesCapForPlatform(platform)
    ),
  };
}

function scrapeLimitsHint(platform: string): string {
  const p = normalizePlatform(platform);
  if (p === 'youtube') {
    return `YouTube (trần API mỗi lần cào, không paginate): tối đa ${YOUTUBE_MAX_POSTS_PER_SCRAPE} bài · ${YOUTUBE_MAX_TOP_COMMENTS} comment gốc/bài · ${YOUTUBE_MAX_REPLIES} reply/comment.`;
  }
  if (p === 'facebook' || p === 'tiktok') {
    return `${p === 'facebook' ? 'Facebook' : 'TikTok'}: không có trần cứng như YouTube — dùng đúng số bạn nhập.`;
  }
  return `Giới hạn cào theo kênh (tối đa ${SCRAPE_LIMIT_MAX.toLocaleString('vi-VN')}).`;
}
type FormMode = 'create' | 'edit';

export function ChannelManagement() {
  const canMutate = canWrite(useAuthStore((s) => s.user?.role));
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
  const [statsChannel, setStatsChannel] = useState<ChannelItem | null>(null);
  const [compareChannelIds, setCompareChannelIds] = useState<number[] | null>(null);
  const [compareByDayChannel, setCompareByDayChannel] = useState<ChannelItem | null>(null);

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

  const reloadAfterScrape = useCallback(() => {
    void loadList({ page, q: query, type_channel: platformFilter });
  }, [loadList, page, platformFilter, query]);

  const {
    scrapeLocked,
    resumed,
    highlightChannelIds,
    isChannelScraping,
    enqueueChannelScrape,
  } = useScraperAsyncWatcher({
    onSettledReload: reloadAfterScrape,
  });

  const scrapingNames = useMemo(() => {
    if (highlightChannelIds.length === 0) return [];
    const idSet = new Set(highlightChannelIds);
    return items.filter((ch) => idSet.has(ch.id)).map((ch) => ch.name);
  }, [highlightChannelIds, items]);

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
    const type_channel = item.type_channel || 'youtube';
    setForm({
      name: item.name || '',
      url: item.url || '',
      type_channel,
      ...clampLimitsForPlatform(type_channel, {
        max_posts: item.max_posts,
        max_top_comments: item.max_top_comments,
        max_replies: item.max_replies,
      }),
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

    const { max_posts, max_top_comments, max_replies } = clampLimitsForPlatform(
      form.type_channel,
      {
        max_posts: form.max_posts,
        max_top_comments: form.max_top_comments,
        max_replies: form.max_replies,
      }
    );

    setSaving(true);
    try {
      const identityLocked = formMode === 'edit';
      const limits = { max_posts, max_top_comments, max_replies };
      const payload = {
        name,
        ...limits,
        ...(identityLocked
          ? {}
          : {
              url,
              type_channel: isPlatformSelectable(form.type_channel)
                ? form.type_channel
                : 'youtube',
            }),
      };
      if (formMode === 'create') {
        await channelsApi.create({
          ...payload,
          url,
          type_channel: isPlatformSelectable(form.type_channel) ? form.type_channel : 'youtube',
        });
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

  const handleScrapeChannel = async (item: ChannelItem) => {
    const platform = normalizePlatform(item.type_channel);
    if (platform !== 'youtube' && platform !== 'tiktok' && platform !== 'facebook') {
      MakeToast({
        variant: 'warning',
        content: 'Chỉ hỗ trợ quét YouTube, TikTok và Facebook',
      });
      return;
    }

    await enqueueChannelScrape({
      label: item.name,
      channelId: item.id,
      platform,
    });
  };

  const handleDelete = async (item: ChannelItem) => {
    if (item.can_delete === false || item.has_scraper_runs) {
      MakeToast({
        variant: 'warning',
        content: 'Không thể xóa kênh đang có bài scrape (scraper_runs)',
      });
      return;
    }

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
    return undefined;
  }, [totalRecords]);

  return (
    <div className={dash.dashboard}>
      <HotTopicHeader />

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
                <option key={opt.id} value={opt.id} disabled={!isPlatformSelectable(opt.id)}>
                  {opt.label}
                </option>
              ))}
            </select>
            {canMutate && (
              <button type="button" className={styles.addBtn} onClick={openCreate}>
                <Plus size={16} aria-hidden />
                Thêm kênh
              </button>
            )}
          </div>
        </div>
      </div>

      <main className={styles.main}>
        {scrapeLocked && (
          <div className={styles.scrapeBanner} role="status" aria-live="polite">
            <Loader2 size={16} className={dash.spin} aria-hidden />
            <span>
              {resumed ? 'Đang tiếp tục theo dõi job quét' : 'Đang quét nền'}
              {scrapingNames.length > 0
                ? `: ${scrapingNames.join(', ')}`
                : highlightChannelIds.length > 0
                  ? ` (channel id: ${highlightChannelIds.join(', ')})`
                  : '…'}
            </span>
          </div>
        )}
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
            <span>Followers</span>
            <span>Số bài viết</span>
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
                  <div className={styles.statCell}>
                    {(item.followers ?? 0).toLocaleString('vi-VN')}
                  </div>
                  <div className={styles.statCell}>
                    {(item.post_count ?? 0).toLocaleString('vi-VN')}
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => setStatsChannel(item)}
                      aria-label={`Thống kê ${item.name}`}
                      title="Xem thống kê kênh"
                    >
                      <BarChart3 size={15} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => setCompareChannelIds([item.id])}
                      aria-label={`So sánh ${item.name}`}
                      title="So sánh kênh"
                    >
                      <GitCompareArrows size={15} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => setCompareByDayChannel(item)}
                      aria-label={`So sánh theo kỳ ${item.name}`}
                      title="So sánh theo kỳ"
                    >
                      <CalendarRange size={15} aria-hidden />
                    </button>
                    {(canMutate &&
                      (normalizePlatform(item.type_channel) === 'youtube' ||
                        normalizePlatform(item.type_channel) === 'tiktok' ||
                        normalizePlatform(item.type_channel) === 'facebook')) && (
                      <button
                        type="button"
                        className={cn(styles.iconBtn, styles.scrapeIconBtn)}
                        onClick={() => void handleScrapeChannel(item)}
                        disabled={scrapeLocked}
                        aria-label={`Quét data ${item.name}`}
                        title={
                          scrapeLocked
                            ? resumed
                              ? 'Đang tiếp tục theo dõi job quét (sau F5)'
                              : 'Đang có job quét chạy nền'
                            : normalizePlatform(item.type_channel) === 'tiktok'
                              ? 'Quét data TikTok'
                              : normalizePlatform(item.type_channel) === 'facebook'
                                ? 'Quét data Facebook'
                                : 'Quét data YouTube'
                        }
                      >
                        {isChannelScraping(item.id) ||
                        (scrapeLocked && highlightChannelIds.length === 0) ? (
                          <Loader2 size={15} className={dash.spin} aria-hidden />
                        ) : (
                          <ScanLine size={15} aria-hidden />
                        )}
                      </button>
                    )}
                    {canMutate && (
                      <>
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
                          disabled={item.can_delete === false || deletingId === item.id}
                          aria-label={`Xóa ${item.name}`}
                          title={
                            item.can_delete === false
                              ? 'Không thể xóa vì kênh đã có bài scrape (scraper_runs)'
                              : 'Xóa'
                          }
                        >
                          {deletingId === item.id ? (
                            <Loader2 size={15} className={dash.spin} aria-hidden />
                          ) : (
                            <Trash2 size={15} aria-hidden />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>

          <div className={styles.pagination}>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalRecords={totalRecords}
              unitLabel="kênh"
              info={paginationLabel}
              disabled={loading}
              onChange={(nextPage) =>
                loadList({ page: nextPage, q: query, type_channel: platformFilter })
              }
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
            aria-labelledby="channel-form-title"
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
                  placeholder={urlPlaceholderForPlatform(form.type_channel)}
                  required
                  readOnly={formMode === 'edit'}
                  disabled={formMode === 'edit'}
                  title={
                    formMode === 'edit'
                      ? 'Không thể sửa URL sau khi kênh đã được lưu'
                      : undefined
                  }
                />
                {formMode === 'edit' && (
                  <em className={styles.fieldHint}>
                    Không thể sửa URL sau khi kênh đã được lưu
                  </em>
                )}
              </label>
              <label className={styles.field}>
                <span>Nền tảng</span>
                <select
                  value={form.type_channel}
                  onChange={(e) => {
                    const type_channel = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      type_channel,
                      ...clampLimitsForPlatform(type_channel, prev),
                    }));
                  }}
                  disabled={formMode === 'edit'}
                  title={
                    formMode === 'edit'
                      ? 'Không thể sửa nền tảng sau khi kênh đã được lưu'
                      : undefined
                  }
                >
                  {SOCIAL_PLATFORM_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id} disabled={!isPlatformSelectable(opt.id)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {formMode === 'edit' && (
                  <em className={styles.fieldHint}>
                    Không thể sửa nền tảng sau khi kênh đã được lưu
                  </em>
                )}
              </label>
              <div className={styles.limitsRow}>
                <label className={styles.field}>
                  <span>
                    Max bài / lần cào
                    {isYoutubePlatform(form.type_channel) ? (
                      <span className={styles.limitCap}>
                        ≤{YOUTUBE_MAX_POSTS_PER_SCRAPE}
                      </span>
                    ) : null}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={maxPostsCapForPlatform(form.type_channel)}
                    value={form.max_posts}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        max_posts: clampScrapeLimit(
                          e.target.value,
                          DEFAULT_MAX_POSTS,
                          maxPostsCapForPlatform(prev.type_channel)
                        ),
                      }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>
                    Max comment gốc / bài
                    {isYoutubePlatform(form.type_channel) ? (
                      <span className={styles.limitCap}>
                        ≤{YOUTUBE_MAX_TOP_COMMENTS}
                      </span>
                    ) : null}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={maxTopCommentsCapForPlatform(form.type_channel)}
                    value={form.max_top_comments}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        max_top_comments: clampScrapeLimit(
                          e.target.value,
                          DEFAULT_MAX_TOP_COMMENTS,
                          maxTopCommentsCapForPlatform(prev.type_channel)
                        ),
                      }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>
                    Max reply / comment
                    {isYoutubePlatform(form.type_channel) ? (
                      <span className={styles.limitCap}>
                        ≤{YOUTUBE_MAX_REPLIES}
                      </span>
                    ) : null}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={maxRepliesCapForPlatform(form.type_channel)}
                    value={form.max_replies}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        max_replies: clampScrapeLimit(
                          e.target.value,
                          DEFAULT_MAX_REPLIES,
                          maxRepliesCapForPlatform(prev.type_channel)
                        ),
                      }))
                    }
                  />
                </label>
              </div>
              <em className={styles.fieldHint}>{scrapeLimitsHint(form.type_channel)}</em>
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

      {statsChannel && (
        <ChannelSnapshotModal
          channel={statsChannel}
          onClose={() => setStatsChannel(null)}
        />
      )}

      {compareChannelIds && (
        <CompareModal
          mode="channels"
          initialChannelIds={compareChannelIds}
          onClose={() => setCompareChannelIds(null)}
        />
      )}

      {compareByDayChannel && (
        <CompareChannelByDayModal
          channel={compareByDayChannel}
          onClose={() => setCompareByDayChannel(null)}
        />
      )}
    </div>
  );
}
