/**
 * Mô tả cron 5-field kiểu Google Cloud Scheduler:
 * hộp giải thích phân cấp Phút / Giờ / Ngày / Tháng / Thứ (tiếng Việt).
 * Validate range từng field (vd. ngày trong tháng 1–31).
 */

const FIELD_RE = /^(\*|\*\/\d+|\d+(-\d+)?(,\d+(-\d+)?)*|\d+-\d+\/\d+)$/;

export const CRON_FORMAT_HINT =
  "Lịch dùng unix-cron (5 field: phút giờ ngày tháng thứ). VD: mỗi phút '* * * * *', mỗi 3 giờ '0 */3 * * *', thứ 2 lúc 09:00 '0 9 * * 1'.";

export type CronExplainItem = {
  text: string;
};

export type CronExplainGroup = {
  label: string;
  items: CronExplainItem[];
};

export type CronExplainResult = {
  valid: boolean;
  /** Thông báo lỗi cụ thể (kiểu GCS), khi valid=false */
  error: string | null;
  groups: CronExplainGroup[];
  summary: string;
};

const DOW_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const MONTH_NAMES = [
  '',
  'tháng 1',
  'tháng 2',
  'tháng 3',
  'tháng 4',
  'tháng 5',
  'tháng 6',
  'tháng 7',
  'tháng 8',
  'tháng 9',
  'tháng 10',
  'tháng 11',
  'tháng 12',
];

const FIELD_BOUNDS: ReadonlyArray<{
  name: string;
  nameEn: string;
  min: number;
  max: number;
}> = [
  { name: 'phút', nameEn: 'minute', min: 0, max: 59 },
  { name: 'giờ', nameEn: 'hour', min: 0, max: 23 },
  { name: 'ngày trong tháng', nameEn: 'day of the month', min: 1, max: 31 },
  { name: 'tháng', nameEn: 'month', min: 1, max: 12 },
  { name: 'thứ trong tuần', nameEn: 'day of the week', min: 0, max: 7 },
];

function isValidField(part: string): boolean {
  return FIELD_RE.test(part);
}

function isWildcard(part: string): boolean {
  return part === '*';
}

function isSingleNumber(part: string): boolean {
  return /^\d+$/.test(part);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseStep(part: string): number | null {
  const m = /^\*\/(\d+)$/.exec(part);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeDow(n: number): number | null {
  if (n === 7) return 0;
  if (n < 0 || n > 6) return null;
  return n;
}

/** Thu thập mọi số xuất hiện trong 1 field (để check range). */
function collectNumbers(part: string): number[] {
  if (isWildcard(part) || parseStep(part) != null) return [];

  const nums: number[] = [];
  const rangeStep = /^(\d+)-(\d+)(?:\/(\d+))?$/.exec(part);
  if (rangeStep) {
    nums.push(Number(rangeStep[1]), Number(rangeStep[2]));
    return nums;
  }

  for (const bit of part.split(',')) {
    if (isSingleNumber(bit)) {
      nums.push(Number(bit));
      continue;
    }
    const rs = /^(\d+)-(\d+)(?:\/(\d+))?$/.exec(bit);
    if (rs) {
      nums.push(Number(rs[1]), Number(rs[2]));
    }
  }
  return nums;
}

/**
 * Validate cú pháp + range. Trả về message lỗi kiểu GCS nếu sai.
 * VD: `"32" out of range for day of the month (1-31).`
 */
export function validateCronExpression(expression: string): string | null {
  const trimmed = String(expression || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Cron trống — cần 5 field: phút giờ ngày tháng thứ.';

  const parts = trimmed.split(' ');
  if (parts.length !== 5) {
    return `Sai số field (${parts.length}/5). Cần đúng: phút giờ ngày tháng thứ.`;
  }

  for (let i = 0; i < 5; i++) {
    const part = parts[i];
    const bound = FIELD_BOUNDS[i];
    if (!isValidField(part)) {
      return `"${part}" không hợp lệ cho ${bound.name}.`;
    }

    const step = parseStep(part);
    if (step != null && step <= 0) {
      return `"${part}" bước không hợp lệ cho ${bound.name}.`;
    }

    for (const n of collectNumbers(part)) {
      if (n < bound.min || n > bound.max) {
        return `"${n}" nằm ngoài khoảng ${bound.name} (${bound.min}-${bound.max}).`;
      }
    }
  }

  return null;
}

type FieldKind = 'minute' | 'hour' | 'dom' | 'month' | 'dow';

type Expanded =
  | { kind: 'every' }
  | { kind: 'equals'; values: number[] }
  | { kind: 'step'; step: number }
  | { kind: 'range'; from: number; to: number; step?: number }
  | { kind: 'mixed'; labels: string[] };

function expandField(part: string): Expanded {
  if (isWildcard(part)) return { kind: 'every' };

  const stepOnly = parseStep(part);
  if (stepOnly != null) return { kind: 'step', step: stepOnly };

  const rangeStep = /^(\d+)-(\d+)(?:\/(\d+))?$/.exec(part);
  if (rangeStep) {
    return {
      kind: 'range',
      from: Number(rangeStep[1]),
      to: Number(rangeStep[2]),
      step: rangeStep[3] ? Number(rangeStep[3]) : undefined,
    };
  }

  if (part.includes(',')) {
    const labels: string[] = [];
    const values: number[] = [];
    let allSimple = true;
    for (const bit of part.split(',')) {
      if (isSingleNumber(bit)) {
        values.push(Number(bit));
        labels.push(bit);
      } else {
        allSimple = false;
        const rs = /^(\d+)-(\d+)(?:\/(\d+))?$/.exec(bit);
        if (rs) {
          labels.push(rs[3] ? `${rs[1]}–${rs[2]} cách ${rs[3]}` : `${rs[1]}–${rs[2]}`);
        } else {
          labels.push(bit);
        }
      }
    }
    if (allSimple) return { kind: 'equals', values };
    return { kind: 'mixed', labels };
  }

  if (isSingleNumber(part)) {
    return { kind: 'equals', values: [Number(part)] };
  }

  return { kind: 'mixed', labels: [part] };
}

/** Ngày trong tháng: mùng 1 / ngày 2… của tháng đó */
function formatDayOfMonth(n: number): string {
  if (n === 1) return 'ngày mùng 1 của tháng đó';
  return `ngày ${n} của tháng đó`;
}

function formatEqualsValue(n: number, kind: FieldKind): string {
  if (kind === 'dow') {
    const d = normalizeDow(n);
    return d == null ? String(n) : DOW_NAMES[d];
  }
  if (kind === 'month') {
    return MONTH_NAMES[n] ?? `tháng ${n}`;
  }
  if (kind === 'dom') {
    return formatDayOfMonth(n);
  }
  return String(n);
}

function itemsForField(part: string, kind: FieldKind): string[] {
  const expanded = expandField(part);
  if (expanded.kind === 'every') return [];

  if (expanded.kind === 'step') {
    const unit =
      kind === 'minute'
        ? 'phút'
        : kind === 'hour'
          ? 'giờ'
          : kind === 'dom'
            ? 'ngày trong tháng'
            : kind === 'month'
              ? 'tháng'
              : 'thứ';
    return [`Mỗi ${expanded.step} ${unit}`];
  }

  if (expanded.kind === 'range') {
    const from = formatEqualsValue(expanded.from, kind);
    const to = formatEqualsValue(expanded.to, kind);
    if (expanded.step) {
      return [`Từ ${from} đến ${to}, cách ${expanded.step}`];
    }
    return [`Từ ${from} đến ${to}`];
  }

  if (expanded.kind === 'mixed') {
    return expanded.labels.map((label, i) =>
      i === 0 ? `Bằng ${label}` : `hoặc Bằng ${label}`
    );
  }

  return expanded.values.map((n, i) => {
    const label = formatEqualsValue(n, kind);
    return i === 0 ? `Bằng ${label}` : `hoặc Bằng ${label}`;
  });
}

function pushGroup(
  groups: CronExplainGroup[],
  baseLabel: string,
  items: string[]
): void {
  if (items.length === 0) return;
  const isFirst = groups.length === 0;
  groups.push({
    label: isFirst ? baseLabel : `và ${baseLabel}`,
    items: items.map((text) => ({ text })),
  });
}

/**
 * Phân tích cron → cấu trúc giống Google Cloud Scheduler.
 */
export function explainCronExpression(expression: string): CronExplainResult {
  const error = validateCronExpression(expression);
  if (error) {
    return { valid: false, error, groups: [], summary: 'sai định dạng' };
  }

  const parts = String(expression || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ');
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const groups: CronExplainGroup[] = [];

  const minSingle = isSingleNumber(minute);
  const hourSingle = isSingleNumber(hour);

  if (minSingle && hourSingle) {
    pushGroup(groups, 'Phút và giờ', [
      `Lúc ${pad2(Number(hour))}:${pad2(Number(minute))}`,
    ]);
  } else {
    pushGroup(groups, 'Phút', itemsForField(minute, 'minute'));
    pushGroup(groups, 'Giờ', itemsForField(hour, 'hour'));
  }

  // Tách rõ: ngày trong tháng vs thứ trong tuần (tránh nhầm field 3 với thứ)
  pushGroup(groups, 'Ngày trong tháng', itemsForField(dayOfMonth, 'dom'));
  pushGroup(groups, 'Tháng', itemsForField(month, 'month'));
  pushGroup(groups, 'Thứ trong tuần', itemsForField(dayOfWeek, 'dow'));

  if (groups.length === 0) {
    pushGroup(groups, 'Phút', ['Mỗi phút']);
  }

  const summary = groups
    .map((g) => `${g.label}: ${g.items.map((it) => it.text).join('; ')}`)
    .join(' · ');

  return { valid: true, error: null, groups, summary };
}

export function describeCronExpression(expression: string): string {
  return explainCronExpression(expression).summary;
}

export function isCronDescriptionInvalid(descriptionOrExpr: string): boolean {
  if (descriptionOrExpr === 'sai định dạng') return true;
  return isCronExpressionInvalid(descriptionOrExpr);
}

export function isCronExpressionInvalid(expression: string): boolean {
  return !explainCronExpression(expression).valid;
}
