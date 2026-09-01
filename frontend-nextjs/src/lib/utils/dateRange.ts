/** Helpers khoảng thời gian (YYYY-MM-DD, local) cho dashboard / subject detail. */

export function formatDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Tháng lịch hiện tại: từ ngày 1 → ngày cuối tháng. */
export function getCurrentMonthDateRange(ref: Date = new Date()): {
  date_from: string;
  date_to: string;
} {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return {
    date_from: formatDateInput(start),
    date_to: formatDateInput(end),
  };
}

/** Dịch chuyển ±N tháng lịch so với `dateFrom` (mặc định tháng hiện tại). */
export function shiftMonthDateRange(
  dateFrom: string | undefined,
  deltaMonths: number
): { date_from: string; date_to: string } {
  const anchor = dateFrom ? new Date(`${dateFrom}T00:00:00`) : new Date();
  const ref = new Date(anchor.getFullYear(), anchor.getMonth() + deltaMonths, 1);
  return getCurrentMonthDateRange(ref);
}

/** Còn được sang tháng sau không (không vượt quá tháng lịch hiện tại). */
export function canGoToNextMonth(
  dateFrom: string | undefined,
  ref: Date = new Date()
): boolean {
  const next = shiftMonthDateRange(dateFrom, 1);
  const current = getCurrentMonthDateRange(ref);
  return next.date_from <= current.date_from;
}

export function formatMonthRangeLabel(dateFrom?: string | null, dateTo?: string | null): string {
  if (!dateFrom && !dateTo) {
    const { date_from, date_to } = getCurrentMonthDateRange();
    return formatMonthRangeLabel(date_from, date_to);
  }
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
  const to = dateTo ? new Date(`${dateTo}T00:00:00`) : null;
  const fmt = (d: Date) =>
    d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (from && to) return `${fmt(from)} – ${fmt(to)}`;
  if (from) return `Từ ${fmt(from)}`;
  if (to) return `Đến ${fmt(to)}`;
  return '—';
}
