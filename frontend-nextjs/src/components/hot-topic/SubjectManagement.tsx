'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  Pencil,
  Plus,
  Radio,
  ScanLine,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api/client';
import { channelsApi, type ChannelItem } from '@/lib/api/channels';
import { scraperApi } from '@/lib/api/scraper';
import { Pagination } from '@/components/common/Pagination/Pagination';
import {
  subjectsApi,
  type SubjectListItem,
  type SubjectListSortBy,
} from '@/lib/api/subjects';
import {
  colorForId,
  formatMetric,
  formatScore,
} from '@/lib/mock/hotTopics';
import { normalizePlatform } from '@/lib/utils/socialPlatforms';
import { cn } from '@/lib/utils';
import { MakeToast } from '@/lib/utils/toast';
import { SubjectDetailModal } from './SubjectDetailModal';
import { HotTopicHeader } from './HotTopicHeader';
import { PlatformBadge } from './PlatformBadge';
import dash from './HotTopicDashboard.module.scss';
import styles from './SubjectManagement.module.scss';

const PAGE_SIZE = 20;

type SortDir = 'asc' | 'desc';

const METRIC_SORT_OPTIONS: { value: SubjectListSortBy; label: string }[] = [
  { value: 'discussion', label: 'Tổng lượng thảo luận' },
  { value: 'interaction', label: 'Tổng lượng tương tác' },
  { value: 'follow', label: 'Follow' },
  { value: 'sentiment', label: 'Chỉ số cảm xúc' },
  { value: 'hot_score', label: 'Hot score' },
  { value: 'trend_score', label: 'Trend score' },
];

const METRIC_SORT_KEYS = new Set(METRIC_SORT_OPTIONS.map((o) => o.value));

function defaultSortDir(sortBy: SubjectListSortBy): SortDir {
  return sortBy === 'name' || sortBy === 'nickname' ? 'asc' : 'desc';
}

function SortGlyph({
  active,
  dir,
}: {
  active: boolean;
  dir: SortDir;
}) {
  if (!active) return <ArrowUpDown size={12} aria-hidden />;
  return dir === 'asc' ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />;
}

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

function ChannelChips({ channels = [] }: { channels?: ChannelItem[] }) {
  if (channels.length === 0) {
    return <span className={styles.mutedDash}>—</span>;
  }
  return (
    <div className={styles.channelChips}>
      {channels.map((ch) => (
        <span key={ch.id} className={styles.chipAssign} title={ch.url}>
          <PlatformBadge platform={ch.type_channel} />
          <span className={styles.chipName}>{ch.name}</span>
        </span>
      ))}
    </div>
  );
}

function ChannelRadioList({
  label,
  items,
  selectedId,
  onSelect,
}: {
  label: string;
  items: ChannelItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className={styles.channelPicker}>
      <div className={styles.channelPickerLabel}>{label}</div>
      {items.length === 0 ? (
        <p className={styles.channelPickerEmpty}>
          Chưa có kênh trong danh mục. Mở “Quản lý kênh” để thêm.
        </p>
      ) : (
        <div className={styles.channelPickerList} role="radiogroup" aria-label={label}>
          {items.map((item) => {
            const checked = selectedId === item.id;
            return (
              <label key={item.id} className={styles.channelOption}>
                <input
                  type="radio"
                  name="subject-channel"
                  checked={checked}
                  onChange={() => onSelect(item.id)}
                />
                <span>
                  <PlatformBadge platform={item.type_channel} />
                  <strong title={item.name}>{item.name}</strong>
                  <em title={item.url}>{item.url}</em>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

type FormMode = 'create' | 'edit';

interface SubjectFormState {
  name: string;
  normalized_name: string;
  channel_ids: number[];
}

const EMPTY_FORM: SubjectFormState = {
  name: '',
  normalized_name: '',
  channel_ids: [],
};

export function SubjectManagement() {
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [items, setItems] = useState<SubjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SubjectListSortBy>('id');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSubjectId, setDetailSubjectId] = useState<number | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SubjectFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [scrapingId, setScrapingId] = useState<number | null>(null);

  const [channelOptions, setChannelOptions] = useState<ChannelItem[]>([]);

  const loadChannelOptions = useCallback(async () => {
    try {
      const res = await channelsApi.list({ per_page: 100 });
      setChannelOptions(res.data?.result || []);
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    }
  }, []);

  const loadList = useCallback(
    async (options?: {
      page?: number;
      q?: string;
      sort_by?: SubjectListSortBy;
      sort_dir?: SortDir;
    }) => {
      const nextPage = options?.page ?? 1;
      const nextQ = options?.q ?? query;
      const nextSortBy = options?.sort_by ?? sortBy;
      const nextSortDir = options?.sort_dir ?? sortDir;
      setLoading(true);
      setError(null);
      try {
        const res = await subjectsApi.list({
          page: nextPage,
          per_page: PAGE_SIZE,
          q: nextQ || undefined,
          sort_by: nextSortBy,
          sort_dir: nextSortDir,
        });
        const data = res.data;
        if (!data) throw new Error('Empty subjects response');
        setItems(data.result || []);
        setPage(data.pagination?.current_page ?? nextPage);
        setTotalPages(Math.max(1, data.pagination?.total_pages ?? 1));
        setTotalRecords(data.pagination?.total_records ?? 0);
        setSortBy(nextSortBy);
        setSortDir(nextSortDir);
      } catch (err) {
        setError(getApiErrorMessage(err));
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [query, sortBy, sortDir]
  );

  useEffect(() => {
    void loadList({ page: 1, q: query, sort_by: sortBy, sort_dir: sortDir });
    // Chỉ reload khi query đổi; sort đổi qua handler riêng
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleColumnSort = (nextSortBy: 'name' | 'nickname') => {
    const nextDir =
      sortBy === nextSortBy ? (sortDir === 'asc' ? 'desc' : 'asc') : defaultSortDir(nextSortBy);
    void loadList({ page: 1, q: query, sort_by: nextSortBy, sort_dir: nextDir });
  };

  const handleMetricSortChange = (nextSortBy: SubjectListSortBy) => {
    if (!METRIC_SORT_KEYS.has(nextSortBy)) return;
    const nextDir =
      sortBy === nextSortBy ? sortDir : defaultSortDir(nextSortBy);
    void loadList({ page: 1, q: query, sort_by: nextSortBy, sort_dir: nextDir });
  };

  const toggleMetricSortDir = () => {
    if (!METRIC_SORT_KEYS.has(sortBy)) {
      void loadList({
        page: 1,
        q: query,
        sort_by: 'discussion',
        sort_dir: defaultSortDir('discussion'),
      });
      return;
    }
    const nextDir = sortDir === 'asc' ? 'desc' : 'asc';
    void loadList({ page: 1, q: query, sort_by: sortBy, sort_dir: nextDir });
  };

  useEffect(() => {
    void loadChannelOptions();
  }, [loadChannelOptions]);

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
    void loadChannelOptions();
  };

  const openEdit = (item: SubjectListItem) => {
    setFormMode('edit');
    setEditingId(item.id);
    const firstChannelId = item.channels?.[0]?.id;
    setForm({
      name: item.name || '',
      normalized_name: item.normalized_name || '',
      channel_ids: firstChannelId != null ? [firstChannelId] : [],
    });
    setFormOpen(true);
    void loadChannelOptions();
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const selectChannel = (id: number) => {
    setForm((prev) => ({
      ...prev,
      channel_ids: [id],
    }));
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
        channel_ids: form.channel_ids,
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

  const youtubeChannelIds = (item: SubjectListItem) =>
    (item.channels || [])
      .filter((ch) => normalizePlatform(ch.type_channel) === 'youtube')
      .map((ch) => ch.id);

  const tiktokChannelIds = (item: SubjectListItem) =>
    (item.channels || [])
      .filter((ch) => normalizePlatform(ch.type_channel) === 'tiktok')
      .map((ch) => ch.id);

  const facebookChannelIds = (item: SubjectListItem) =>
    (item.channels || [])
      .filter((ch) => normalizePlatform(ch.type_channel) === 'facebook')
      .map((ch) => ch.id);

  const handleScrapeChannels = async (item: SubjectListItem) => {
    const ytIds = youtubeChannelIds(item);
    const ttIds = tiktokChannelIds(item);
    const fbIds = facebookChannelIds(item);
    if (ytIds.length === 0 && ttIds.length === 0 && fbIds.length === 0) {
      MakeToast({
        variant: 'warning',
        content: 'Đối tượng chưa gắn kênh YouTube/TikTok/Facebook để quét',
      });
      return;
    }

    setScrapingId(item.id);
    try {
      let count = 0;
      let inserted = 0;
      let updated = 0;
      if (ytIds.length > 0) {
        const res = await scraperApi.runYoutube({ channel_id: ytIds });
        count += res.data?.items_count ?? 0;
        inserted += res.data?.upsert_stats?.inserted ?? 0;
        updated += res.data?.upsert_stats?.updated ?? 0;
      }
      if (ttIds.length > 0) {
        const res = await scraperApi.runTikTok({ channel_id: ttIds });
        count += res.data?.items_count ?? 0;
        inserted += res.data?.upsert_stats?.inserted ?? 0;
        updated += res.data?.upsert_stats?.updated ?? 0;
      }
      if (fbIds.length > 0) {
        const res = await scraperApi.runFacebook({ channel_id: fbIds });
        count += res.data?.items_count ?? 0;
        inserted += res.data?.upsert_stats?.inserted ?? 0;
        updated += res.data?.upsert_stats?.updated ?? 0;
      }
      MakeToast({
        variant: 'success',
        content: `Đã quét ${count} bài từ "${item.name}" (${inserted} mới, ${updated} cập nhật)`,
      });
      await loadList({ page, q: query });
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    } finally {
      setScrapingId(null);
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
    return undefined;
  }, [totalRecords]);

  return (
    <div className={dash.dashboard}>
      <HotTopicHeader onScrapeSuccess={() => loadList({ page, q: query })} />

      <div className={styles.toolbar}>
        <div className={styles.toolbarInner}>
          <div>
            <h1 className={styles.pageTitle}>Quản lý đối tượng</h1>
            <p className={styles.pageDesc}>
              Thêm/sửa/xóa đối tượng và gắn kênh theo dõi
            </p>
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
            <div className={styles.sortToolbar}>
              <label className={styles.sortToolbarField}>
                <span>Sắp xếp</span>
                <select
                  value={sortBy === 'id' ? 'id' : sortBy}
                  disabled={loading}
                  onChange={(e) => {
                    const value = e.target.value as SubjectListSortBy;
                    if (value === 'id') {
                      void loadList({
                        page: 1,
                        q: query,
                        sort_by: 'id',
                        sort_dir: 'desc',
                      });
                      return;
                    }
                    const nextDir =
                      sortBy === value ? sortDir : defaultSortDir(value);
                    void loadList({
                      page: 1,
                      q: query,
                      sort_by: value,
                      sort_dir: nextDir,
                    });
                  }}
                  aria-label="Sắp xếp danh sách đối tượng"
                >
                  <option value="id">Mặc định</option>
                  <option value="name">Tên</option>
                  <option value="nickname">Biệt danh</option>
                  {METRIC_SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={cn(styles.sortDirBtn, sortBy !== 'id' && styles.sortHeadActive)}
                onClick={() => {
                  if (sortBy === 'id') return;
                  const nextDir = sortDir === 'asc' ? 'desc' : 'asc';
                  void loadList({
                    page: 1,
                    q: query,
                    sort_by: sortBy,
                    sort_dir: nextDir,
                  });
                }}
                disabled={loading || sortBy === 'id'}
                aria-label={`Đổi chiều sắp xếp, đang ${sortDir}`}
                title={`Chiều: ${sortDir}`}
              >
                <SortGlyph active={sortBy !== 'id'} dir={sortDir} />
              </button>
            </div>
            <Link href="/channels" className={styles.secondaryBtn}>
              <Radio size={16} aria-hidden />
              Quản lý kênh
            </Link>
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
            <button
              type="button"
              className={cn(styles.sortHeadBtn, sortBy === 'name' && styles.sortHeadActive)}
              onClick={() => handleColumnSort('name')}
              aria-label={`Sắp xếp theo tên${sortBy === 'name' ? `, đang ${sortDir}` : ''}`}
            >
              <span>Tên</span>
              <SortGlyph active={sortBy === 'name'} dir={sortDir} />
            </button>
            <button
              type="button"
              className={cn(styles.sortHeadBtn, sortBy === 'nickname' && styles.sortHeadActive)}
              onClick={() => handleColumnSort('nickname')}
              aria-label={`Sắp xếp theo biệt danh${sortBy === 'nickname' ? `, đang ${sortDir}` : ''}`}
            >
              <span>Biệt danh</span>
              <SortGlyph active={sortBy === 'nickname'} dir={sortDir} />
            </button>
            <span>Kênh theo dõi</span>
            <div className={styles.metricSortHead}>
              <span className={styles.metricSortLabel}>Chỉ số phân tích</span>
              <div className={styles.metricSortControls}>
                <label className={styles.metricSortSelect}>
                  <span className={styles.srOnly}>Sắp xếp theo chỉ số</span>
                  <select
                    value={METRIC_SORT_KEYS.has(sortBy) ? sortBy : ''}
                    disabled={loading}
                    onChange={(e) => {
                      const value = e.target.value as SubjectListSortBy;
                      if (!value) return;
                      handleMetricSortChange(value);
                    }}
                    aria-label="Chọn chỉ số để sắp xếp"
                  >
                    <option value="" disabled>
                      Chọn chỉ số…
                    </option>
                    {METRIC_SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className={cn(
                    styles.sortDirBtn,
                    METRIC_SORT_KEYS.has(sortBy) && styles.sortHeadActive
                  )}
                  onClick={toggleMetricSortDir}
                  disabled={loading}
                  aria-label={
                    METRIC_SORT_KEYS.has(sortBy)
                      ? `Đổi chiều sắp xếp chỉ số, đang ${sortDir}`
                      : 'Sắp xếp theo tổng lượng thảo luận'
                  }
                  title={METRIC_SORT_KEYS.has(sortBy) ? `Chiều: ${sortDir}` : 'Sắp xếp theo chỉ số'}
                >
                  <SortGlyph active={METRIC_SORT_KEYS.has(sortBy)} dir={sortDir} />
                </button>
              </div>
            </div>
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

                    <ChannelChips channels={item.channels} />

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
                        <span className={dash.metricLabel}>Follow</span>
                        <span className={dash.metricValue}>
                          {formatMetric(agg?.follow ?? 0)}
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
                      {(youtubeChannelIds(item).length > 0 ||
                        tiktokChannelIds(item).length > 0 ||
                        facebookChannelIds(item).length > 0) && (
                        <button
                          type="button"
                          className={cn(styles.iconBtn, styles.scrapeIconBtn)}
                          onClick={() => void handleScrapeChannels(item)}
                          disabled={scrapingId === item.id}
                          aria-label={`Quét data ${title}`}
                          title="Quét YouTube/TikTok/Facebook"
                        >
                          {scrapingId === item.id ? (
                            <Loader2 size={15} className={dash.spin} aria-hidden />
                          ) : (
                            <ScanLine size={15} aria-hidden />
                          )}
                        </button>
                      )}
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
            <Pagination
              page={page}
              totalPages={totalPages}
              totalRecords={totalRecords}
              unitLabel="đối tượng"
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
            className={cn(styles.modal, styles.modalWide)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="subject-form-title"
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

              <ChannelRadioList
                label="Kênh theo dõi"
                items={channelOptions}
                selectedId={form.channel_ids[0] ?? null}
                onSelect={selectChannel}
              />

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
