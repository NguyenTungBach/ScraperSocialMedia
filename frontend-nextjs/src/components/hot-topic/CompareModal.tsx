'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { GitCompareArrows, Loader2, Mail, RefreshCw, X } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api/client';
import { channelsApi, type ChannelItem } from '@/lib/api/channels';
import {
  snapshotsApi,
  type ChannelDailySnapshotRow,
  type PostCatalogItem,
  type PostDailySnapshotRow,
} from '@/lib/api/snapshots';
import { reportsApi } from '@/lib/api/reports';
import type { SubjectRelatedPost } from '@/lib/api/subjects';
import { getCurrentMonthDateRange } from '@/lib/utils/dateRange';
import { MakeToast } from '@/lib/utils/toast';
import { Pagination } from '@/components/common/Pagination/Pagination';
import { PlatformBadge } from './PlatformBadge';
import { ComparePostCharts, POST_METRICS } from './ComparePostCharts';
import { CompareChannelCharts } from './CompareChannelCharts';
import dash from './HotTopicDashboard.module.scss';
import styles from './CompareModal.module.scss';

const CHANNELS_PAGE_SIZE = 100;
const POSTS_PAGE_SIZE = 20;
function fmt(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v.toLocaleString('vi-VN') : '0';
}

function defaultRange() {
  const month = getCurrentMonthDateRange();
  const to = new Date().toISOString().slice(0, 10);
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 7);
  const from = fromDate.toISOString().slice(0, 10);
  return {
    date_from: from < month.date_from ? month.date_from : from,
    date_to: to,
  };
}

function truncate(text: string, max = 48) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export type CompareMode = 'channels' | 'posts';

export interface ComparePostCandidate {
  id: number;
  title?: string | null;
  text?: string | null;
  post_url?: string | null;
  platform?: string;
  channel_id?: number | null;
  channel_name?: string | null;
  /** Bài seed từ đối tượng đang mở */
  from_subject?: boolean;
}

interface CompareModalProps {
  mode: CompareMode;
  onClose: () => void;
  /** Seed kênh khi mode=channels */
  initialChannelIds?: number[];
  /** Seed bài khi mode=posts */
  initialPostIds?: number[];
  /** Danh sách bài để tick thêm (thường từ SubjectDetail) */
  postCandidates?: ComparePostCandidate[];
}

function postLabel(p: ComparePostCandidate) {
  return truncate(p.title?.trim() || p.text?.trim() || p.post_url || `Bài #${p.id}`);
}

function fromSubjectPost(p: SubjectRelatedPost): ComparePostCandidate {
  return {
    id: p.id,
    title: p.title,
    text: p.text,
    post_url: p.post_url,
    platform: p.platform,
    channel_id: p.channel_id,
    from_subject: true,
  };
}

function fromCatalogItem(p: PostCatalogItem): ComparePostCandidate {
  return {
    id: p.id,
    title: p.title,
    text: p.text,
    post_url: p.post_url,
    platform: p.platform,
    channel_id: p.channel_id,
    channel_name: p.channel?.name || null,
  };
}

export function subjectPostsToCandidates(posts: SubjectRelatedPost[]): ComparePostCandidate[] {
  return posts.map(fromSubjectPost);
}

export function CompareModal({
  mode,
  onClose,
  initialChannelIds = [],
  initialPostIds = [],
  postCandidates = [],
}: CompareModalProps) {
  const initial = defaultRange();
  const [dateFrom, setDateFrom] = useState(initial.date_from);
  const [dateTo, setDateTo] = useState(initial.date_to);

  const [allChannels, setAllChannels] = useState<ChannelItem[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>(() => [
    ...new Set(initialChannelIds),
  ]);
  const [selectedPostIds, setSelectedPostIds] = useState<number[]>(() => [
    ...new Set(initialPostIds),
  ]);

  /** Bài đã chọn / đã thấy từ catalog ngoài seed subject */
  const [extraCandidates, setExtraCandidates] = useState<ComparePostCandidate[]>([]);
  const [catalogPosts, setCatalogPosts] = useState<ComparePostCandidate[]>([]);
  const [catalogChannelId, setCatalogChannelId] = useState<string>(() => {
    const seed = postCandidates.find((p) => p.channel_id != null && Number(p.channel_id) > 0);
    return seed?.channel_id != null ? String(seed.channel_id) : '';
  });
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogQueryDebounced, setCatalogQueryDebounced] = useState('');
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogTotalPages, setCatalogTotalPages] = useState(0);

  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingPostCatalog, setLoadingPostCatalog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [channelRows, setChannelRows] = useState<ChannelDailySnapshotRow[]>([]);
  const [postRows, setPostRows] = useState<PostDailySnapshotRow[]>([]);
  const [hasCompared, setHasCompared] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setCatalogQueryDebounced(catalogQuery.trim()), 300);
    return () => window.clearTimeout(t);
  }, [catalogQuery]);

  useEffect(() => {
    setCatalogPage(1);
  }, [catalogChannelId, catalogQueryDebounced]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCatalog(true);
      try {
        const collected: ChannelItem[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const res = await channelsApi.list({ page, per_page: CHANNELS_PAGE_SIZE });
          if (cancelled) return;
          collected.push(...(res.data?.result || []));
          totalPages = Math.max(1, res.data?.pagination?.total_pages || 1);
          page += 1;
        } while (page <= totalPages && page <= 20);
        if (!cancelled) setAllChannels(collected);
      } catch (err) {
        if (!cancelled) {
          MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
        }
      } finally {
        if (!cancelled) setLoadingCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== 'posts') return;
    if (!catalogChannelId) {
      setCatalogPosts([]);
      setCatalogTotal(0);
      setCatalogTotalPages(0);
      setLoadingPostCatalog(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingPostCatalog(true);
      try {
        const res = await snapshotsApi.catalogPosts({
          channel_id: catalogChannelId,
          q: catalogQueryDebounced || undefined,
          page: catalogPage,
          per_page: POSTS_PAGE_SIZE,
        });
        if (cancelled) return;
        setCatalogPosts((res.data?.result || []).map(fromCatalogItem));
        setCatalogTotal(res.data?.pagination?.total_records || 0);
        setCatalogTotalPages(res.data?.pagination?.total_pages || 0);
      } catch (err) {
        if (!cancelled) {
          MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
        }
      } finally {
        if (!cancelled) setLoadingPostCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, catalogChannelId, catalogQueryDebounced, catalogPage]);

  const channelLabelById = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of allChannels) {
      map.set(c.id, `${c.name} (${c.type_channel})`);
    }
    for (const row of channelRows) {
      if (row.channel?.id && !map.has(row.channel.id)) {
        map.set(
          row.channel.id,
          `${row.channel.name || `#${row.channel.id}`} (${row.channel.type_channel || '?'})`
        );
      }
    }
    return map;
  }, [allChannels, channelRows]);

  const candidateById = useMemo(() => {
    const map = new Map<number, ComparePostCandidate>();
    for (const p of postCandidates) map.set(p.id, p);
    for (const p of extraCandidates) {
      if (!map.has(p.id)) map.set(p.id, p);
    }
    for (const p of catalogPosts) {
      const prev = map.get(p.id);
      map.set(p.id, prev ? { ...p, ...prev, from_subject: prev.from_subject } : p);
    }
    for (const row of postRows) {
      const run = row.scraperRun;
      if (!run?.id || map.has(run.id)) continue;
      map.set(run.id, {
        id: run.id,
        title: run.title,
        post_url: run.post_url,
        platform: run.platform,
      });
    }
    for (const id of selectedPostIds) {
      if (!map.has(id)) map.set(id, { id, title: `Bài #${id}` });
    }
    return map;
  }, [postCandidates, extraCandidates, catalogPosts, postRows, selectedPostIds]);

  const selectedPostItems = useMemo(
    () => selectedPostIds.map((id) => candidateById.get(id)!).filter(Boolean),
    [selectedPostIds, candidateById]
  );

  const postLabelById = useMemo(() => {
    const map = new Map<number, string>();
    for (const [id, p] of candidateById) {
      map.set(id, postLabel(p));
    }
    return map;
  }, [candidateById]);

  const toggleChannel = (id: number) => {
    setSelectedChannelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setHasCompared(false);
  };

  const togglePost = (p: ComparePostCandidate) => {
    setSelectedPostIds((prev) => {
      if (prev.includes(p.id)) return prev.filter((x) => x !== p.id);
      return [...prev, p.id];
    });
    setExtraCandidates((prev) => {
      if (prev.some((x) => x.id === p.id) || postCandidates.some((x) => x.id === p.id)) {
        return prev;
      }
      return [...prev, p];
    });
    setHasCompared(false);
  };

  const channelPivot = useMemo(() => {
    const ids = selectedChannelIds;
    const dateSet = new Set<string>();
    for (const raw of channelRows) {
      dateSet.add(String(raw.snapshot_date).slice(0, 10));
    }
    return { ids, dates: [...dateSet].sort(), hasData: dateSet.size > 0 };
  }, [selectedChannelIds, channelRows]);

  const postLatestTable = useMemo(() => {
    const ids = selectedPostIds;
    const dateSet = new Set<string>();
    const byId = new Map<number, Map<string, PostDailySnapshotRow>>();
    for (const raw of postRows) {
      const id = Number(raw.scraper_run_id);
      if (!ids.includes(id)) continue;
      const date = String(raw.snapshot_date).slice(0, 10);
      dateSet.add(date);
      if (!byId.has(id)) byId.set(id, new Map());
      byId.get(id)!.set(date, raw);
    }
    const dates = [...dateSet].sort();
    const latest = dates[dates.length - 1] || '';
    const cells = new Map<number, PostDailySnapshotRow | null>();
    for (const id of ids) {
      const series = byId.get(id);
      if (!series || !dates.length) {
        cells.set(id, null);
        continue;
      }
      if (series.has(latest)) {
        cells.set(id, series.get(latest)!);
        continue;
      }
      let found: PostDailySnapshotRow | null = null;
      for (let i = dates.length - 1; i >= 0; i--) {
        const row = series.get(dates[i]);
        if (row) {
          found = row;
          break;
        }
      }
      cells.set(id, found);
    }
    return { ids, latest, cells, hasData: dates.length > 0 };
  }, [selectedPostIds, postRows]);

  const canRunCompare =
    mode === 'channels' ? selectedChannelIds.length >= 2 : selectedPostIds.length >= 2;

  const resetFilters = useCallback(() => {
    const range = defaultRange();
    setDateFrom(range.date_from);
    setDateTo(range.date_to);
    setSelectedChannelIds([]);
    setSelectedPostIds([]);
    setExtraCandidates([]);
    setCatalogQuery('');
    setCatalogQueryDebounced('');
    setCatalogPage(1);
    const seed = postCandidates.find((p) => p.channel_id != null && Number(p.channel_id) > 0);
    setCatalogChannelId(seed?.channel_id != null ? String(seed.channel_id) : '');
    setChannelRows([]);
    setPostRows([]);
    setHasCompared(false);
  }, [postCandidates]);

  const runCompare = useCallback(async () => {
    if (mode === 'channels' && selectedChannelIds.length < 2) {
      MakeToast({ variant: 'warning', content: 'Chọn ít nhất 2 kênh để so sánh' });
      return;
    }
    if (mode === 'posts' && selectedPostIds.length < 2) {
      MakeToast({ variant: 'warning', content: 'Chọn ít nhất 2 bài để so sánh' });
      return;
    }

    setLoading(true);
    try {
      if (mode === 'channels') {
        const res = await snapshotsApi.compareChannels({
          channel_ids: selectedChannelIds,
          date_from: dateFrom,
          date_to: dateTo,
        });
        setChannelRows(res.data?.result || []);
        setPostRows([]);
      } else {
        const res = await snapshotsApi.comparePosts({
          scraper_run_ids: selectedPostIds,
          date_from: dateFrom,
          date_to: dateTo,
        });
        setPostRows(res.data?.result || []);
        setChannelRows([]);
      }
      setHasCompared(true);
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [mode, selectedChannelIds, selectedPostIds, dateFrom, dateTo]);

  const sendEmail = async () => {
    if (!hasCompared) {
      MakeToast({ variant: 'warning', content: 'Hãy chạy so sánh trước khi gửi mail' });
      return;
    }
    setSending(true);
    try {
      const res = await reportsApi.sendCompareEmail(
        mode === 'channels'
          ? {
              mode: 'channels',
              channel_ids: selectedChannelIds,
              date_from: dateFrom,
              date_to: dateTo,
              metric: 'views_sum',
            }
          : {
              mode: 'posts',
              scraper_run_ids: selectedPostIds,
              date_from: dateFrom,
              date_to: dateTo,
              metric: 'views',
            }
      );
      MakeToast({
        variant: 'success',
        content: `Đã gửi báo cáo tới ${res.data?.to || 'MAIL_MAIN'}`,
      });
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    } finally {
      setSending(false);
    }
  };

  const title = mode === 'channels' ? 'So sánh kênh' : 'So sánh bài / video';
  const channelNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of allChannels) map.set(c.id, c.name);
    return map;
  }, [allChannels]);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>
              <GitCompareArrows size={18} aria-hidden /> {title}
            </h2>
            <p className={styles.sub}>
              {mode === 'posts'
                ? 'Chọn ≥ 2 bài + khoảng ngày → biểu đồ chỉ số → gửi mail báo cáo'
                : 'Chọn ≥ 2 kênh + khoảng ngày → biểu đồ tất cả chỉ số → gửi mail báo cáo'}
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </header>

        <div className={styles.filters}>
          <label>
            Từ ngày
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label>
            Đến ngày
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => void runCompare()}
            disabled={loading || !canRunCompare}
          >
            {loading ? <Loader2 size={16} className={dash.spin} /> : <GitCompareArrows size={16} />}
            {mode === 'posts' ? 'So sánh bài viết' : 'So sánh kênh'}
          </button>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={resetFilters}
            title="Xóa lựa chọn bài/kênh và trả ngày về mặc định"
          >
            <RefreshCw size={16} />
            Refresh bộ lọc
          </button>
          <button
            type="button"
            className={styles.mailBtn}
            onClick={() => void sendEmail()}
            disabled={sending || !hasCompared}
            title="Chỉ gửi sau khi đã có kết quả so sánh"
          >
            {sending ? <Loader2 size={16} className={dash.spin} /> : <Mail size={16} />}
            Gửi báo cáo về mail
          </button>
        </div>

        <div className={styles.body}>
          <aside className={styles.picker}>
            <h3>{mode === 'channels' ? 'Chọn kênh' : 'Chọn bài'}</h3>
            {mode === 'channels' ? (
              loadingCatalog ? (
                <p className={styles.muted}>
                  <Loader2 size={14} className={dash.spin} /> Đang tải kênh…
                </p>
              ) : allChannels.length === 0 ? (
                <p className={styles.muted}>Chưa có kênh.</p>
              ) : (
                <ul className={styles.checkList}>
                  {allChannels.map((c) => (
                    <li key={c.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedChannelIds.includes(c.id)}
                          onChange={() => toggleChannel(c.id)}
                        />
                        <span className={styles.checkLabel}>
                          <PlatformBadge platform={c.type_channel} size="sm" />
                          {c.name}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <>
                <div className={styles.pickerFilters}>
                  <label>
                    Kênh
                    <select
                      value={catalogChannelId}
                      onChange={(e) => setCatalogChannelId(e.target.value)}
                      disabled={loadingCatalog}
                    >
                      <option value="">— Chọn kênh —</option>
                      {allChannels.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.name} ({c.type_channel})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Tìm bài trong kênh
                    <input
                      type="search"
                      placeholder="Tiêu đề, URL…"
                      value={catalogQuery}
                      onChange={(e) => setCatalogQuery(e.target.value)}
                      disabled={!catalogChannelId}
                    />
                  </label>
                </div>

                {selectedPostItems.length > 0 ? (
                  <div className={styles.selectedBlock}>
                    <p className={styles.pickerMeta}>
                      Đã chọn {selectedPostItems.length} bài (giữ khi đổi kênh/trang)
                    </p>
                    <ul className={styles.selectedList}>
                      {selectedPostItems.map((p) => {
                        const channelLabel =
                          p.channel_name ||
                          (p.channel_id != null
                            ? channelNameById.get(Number(p.channel_id))
                            : null);
                        return (
                          <li key={`sel-${p.id}`}>
                            <label>
                              <input
                                type="checkbox"
                                checked
                                onChange={() => togglePost(p)}
                              />
                              <span className={styles.checkLabel}>
                                {p.platform ? (
                                  <PlatformBadge platform={p.platform} size="sm" />
                                ) : null}
                                <span className={styles.checkText}>
                                  <span className={styles.checkTitle}>{postLabel(p)}</span>
                                  {channelLabel ? (
                                    <span className={styles.checkMeta}>{channelLabel}</span>
                                  ) : null}
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <p className={styles.pickerMeta}>Chưa chọn bài · cần ≥ 2 bài để so sánh</p>
                )}

                {!catalogChannelId ? (
                  <p className={styles.muted}>Chọn một kênh để xem và phân trang danh sách bài.</p>
                ) : loadingPostCatalog ? (
                  <p className={styles.muted}>
                    <Loader2 size={14} className={dash.spin} /> Đang tải bài…
                  </p>
                ) : catalogPosts.length === 0 ? (
                  <p className={styles.muted}>Kênh này không có bài khớp bộ lọc.</p>
                ) : (
                  <>
                    <p className={styles.pickerSectionTitle}>Bài trong kênh</p>
                    <ul className={styles.checkList}>
                      {catalogPosts.map((p) => (
                        <li key={p.id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={selectedPostIds.includes(p.id)}
                              onChange={() => togglePost(p)}
                            />
                            <span className={styles.checkLabel}>
                              {p.platform ? (
                                <PlatformBadge platform={p.platform} size="sm" />
                              ) : null}
                              <span className={styles.checkText}>
                                <span className={styles.checkTitle}>{postLabel(p)}</span>
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    {catalogTotalPages > 1 ? (
                      <div className={styles.pickerPagination}>
                        <Pagination
                          page={catalogPage}
                          totalPages={catalogTotalPages}
                          totalRecords={catalogTotal}
                          unitLabel="bài"
                          disabled={loadingPostCatalog}
                          onChange={setCatalogPage}
                          siblingCount={0}
                        />
                      </div>
                    ) : catalogTotal > 0 ? (
                      <p className={styles.pickerMeta}>
                        {catalogTotal.toLocaleString('vi-VN')} bài trong kênh này
                      </p>
                    ) : null}
                  </>
                )}
              </>
            )}
          </aside>

          <section className={styles.result}>
            {mode === 'channels' ? (
              <>
                <h3>Kết quả so sánh</h3>
                {!hasCompared ? (
                  <p className={styles.muted}>Chọn ít nhất 2 kênh và bấm «So sánh kênh».</p>
                ) : !channelPivot.hasData ? (
                  <p className={styles.muted}>
                    Không có snapshot trong khoảng ngày. Mở thống kê kênh rồi bấm Snapshot, hoặc đợi
                    cron.
                  </p>
                ) : (
                  <CompareChannelCharts
                    channelIds={selectedChannelIds}
                    rows={channelRows}
                    labelById={channelLabelById}
                  />
                )}
              </>
            ) : (
              <>
                <h3>Kết quả so sánh</h3>
                {!hasCompared ? (
                  <p className={styles.muted}>Chọn ít nhất 2 bài và bấm «So sánh bài viết».</p>
                ) : !postLatestTable.hasData ? (
                  <p className={styles.muted}>
                    Không có snapshot trong khoảng ngày. Mở thống kê bài rồi bấm Snapshot, hoặc đợi
                    cron.
                  </p>
                ) : (
                  <>
                    <ComparePostCharts
                      postIds={selectedPostIds}
                      rows={postRows}
                      labelById={postLabelById}
                      compareDateFrom={dateFrom}
                      compareDateTo={dateTo}
                    />

                    <details className={styles.detailsTable} open={false}>
                      <summary>
                        Bảng số liệu cuối kỳ
                        {postLatestTable.latest ? ` (${postLatestTable.latest})` : ''}
                      </summary>
                      <div className={styles.tableWrap}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Chỉ số</th>
                              {postLatestTable.ids.map((id) => (
                                <th key={id}>{postLabelById.get(id) || `#${id}`}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {POST_METRICS.map((m) => (
                              <tr key={m.key}>
                                <td>{m.label}</td>
                                {postLatestTable.ids.map((id) => {
                                  const row = postLatestTable.cells.get(id);
                                  const val = row ? Number(row[m.key]) || 0 : null;
                                  return <td key={id}>{val == null ? '—' : fmt(val)}</td>;
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
