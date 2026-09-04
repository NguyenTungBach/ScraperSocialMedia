/**
 * Mô tả cron 5-field (phút giờ ngày tháng thứ) bằng tiếng Việt.
 * Không đủ 5 field / field sai → "sai định dạng".
 */

const FIELD_RE = /^(\*|\*\/\d+|\d+(-\d+)?(,\d+(-\d+)?)*|\d+-\d+\/\d+)$/;

function isValidField(part: string): boolean {
  return FIELD_RE.test(part);
}

function parseStep(part: string): number | null {
  const m = /^\*\/(\d+)$/.exec(part);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isSingleNumber(part: string): boolean {
  return /^\d+$/.test(part);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * @returns Mô tả lịch, hoặc "sai định dạng"
 */
export function describeCronExpression(expression: string): string {
  const trimmed = String(expression || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'sai định dạng';

  const parts = trimmed.split(' ');
  if (parts.length !== 5) return 'sai định dạng';
  if (!parts.every(isValidField)) return 'sai định dạng';

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // * * * * * → mỗi phút
  if (parts.every((p) => p === '*')) {
    return '1 phút mỗi lần';
  }

  // */N * * * * → mỗi N phút
  const minStep = parseStep(minute);
  if (minStep != null && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return minStep === 1 ? '1 phút mỗi lần' : `${minStep} phút mỗi lần`;
  }

  // 0 */N * * * → mỗi N giờ (phút 0)
  const hourStep = parseStep(hour);
  if (
    isSingleNumber(minute) &&
    hourStep != null &&
    dayOfMonth === '*' &&
    month === '*' &&
    dayOfWeek === '*'
  ) {
    const atMin = Number(minute);
    if (hourStep === 1) {
      return atMin === 0 ? '1 giờ mỗi lần' : `mỗi giờ lúc phút ${pad2(atMin)}`;
    }
    return atMin === 0
      ? `${hourStep} giờ mỗi lần`
      : `${hourStep} giờ mỗi lần (phút ${pad2(atMin)})`;
  }

  // M * * * * → mỗi giờ lúc phút M  (vd: 0 * * * * → 1 giờ mỗi lần)
  if (
    isSingleNumber(minute) &&
    hour === '*' &&
    dayOfMonth === '*' &&
    month === '*' &&
    dayOfWeek === '*'
  ) {
    const atMin = Number(minute);
    return atMin === 0 ? '1 giờ mỗi lần' : `mỗi giờ lúc phút ${pad2(atMin)}`;
  }

  // M H * * * → mỗi ngày lúc H:M
  if (
    isSingleNumber(minute) &&
    isSingleNumber(hour) &&
    dayOfMonth === '*' &&
    month === '*' &&
    dayOfWeek === '*'
  ) {
    return `${pad2(Number(hour))}:${pad2(Number(minute))} mỗi ngày`;
  }

  // M H */N * * → mỗi N ngày lúc H:M
  const domStep = parseStep(dayOfMonth);
  if (
    isSingleNumber(minute) &&
    isSingleNumber(hour) &&
    domStep != null &&
    month === '*' &&
    dayOfWeek === '*'
  ) {
    return `${pad2(Number(hour))}:${pad2(Number(minute))} mỗi ${domStep} ngày`;
  }

  // M H * * D → thứ D hàng tuần (0/7=CN … 6=T7)
  if (
    isSingleNumber(minute) &&
    isSingleNumber(hour) &&
    dayOfMonth === '*' &&
    month === '*' &&
    isSingleNumber(dayOfWeek)
  ) {
    const dowNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    let dow = Number(dayOfWeek);
    if (dow === 7) dow = 0;
    if (dow < 0 || dow > 6) return 'sai định dạng';
    return `${pad2(Number(hour))}:${pad2(Number(minute))} mỗi ${dowNames[dow]}`;
  }

  // Các pattern còn lại: vẫn 5 field hợp lệ về mặt cú pháp → mô tả ngắn
  return `Cron: ${trimmed} (Asia/Ho_Chi_Minh)`;
}

export function isCronDescriptionInvalid(description: string): boolean {
  return description === 'sai định dạng';
}
