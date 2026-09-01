'use client';

import { Calendar } from 'lucide-react';
import styles from './HotTopicDashboard.module.scss';

export interface MonthDateFilterBarProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onApply: () => void;
  onResetMonth: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  canNextMonth: boolean;
  disabled?: boolean;
  /** Chỉ hiện trên dashboard (Xếp hạng). */
  showNewOnlyToggle?: boolean;
  showNewOnly?: boolean;
  onShowNewOnlyChange?: (value: boolean) => void;
}

export function MonthDateFilterBar({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onApply,
  onResetMonth,
  onPrevMonth,
  onNextMonth,
  canNextMonth,
  disabled = false,
  showNewOnlyToggle = false,
  showNewOnly = false,
  onShowNewOnlyChange,
}: MonthDateFilterBarProps) {
  return (
    <div className={styles.filterBar}>
      <div className={styles.filterBarInner}>
        <div className={styles.filterBarRight}>
          {showNewOnlyToggle && (
            <label className={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={showNewOnly}
                disabled={disabled}
                onChange={(e) => onShowNewOnlyChange?.(e.target.checked)}
              />
              <span className={styles.toggleSwitch} aria-hidden />
              <span className={styles.toggleText}>
                <span className={styles.toggleTextFull}>Chỉ hiện chủ đề mới xuất hiện</span>
                <span className={styles.toggleTextShort}>Chỉ hiện chủ đề mới</span>
              </span>
            </label>
          )}
          <div className={styles.datePicker}>
            <Calendar size={15} aria-hidden />
            <button
              type="button"
              disabled={disabled}
              onClick={onPrevMonth}
              title="Tháng trước"
            >
              Tháng trước
            </button>
            <label>
              Từ
              <input
                type="date"
                value={dateFrom}
                disabled={disabled}
                onChange={(e) => onDateFromChange(e.target.value)}
                aria-label="Từ ngày"
              />
            </label>
            <label>
              Đến
              <input
                type="date"
                value={dateTo}
                disabled={disabled}
                onChange={(e) => onDateToChange(e.target.value)}
                aria-label="Đến ngày"
              />
            </label>
            <button type="button" disabled={disabled} onClick={onApply}>
              Áp dụng
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={onResetMonth}
              title="Tháng hiện tại"
            >
              Tháng này
            </button>
            <button
              type="button"
              disabled={disabled || !canNextMonth}
              onClick={onNextMonth}
              title={canNextMonth ? 'Tháng sau' : 'Chưa có dữ liệu tháng tương lai'}
            >
              Tháng sau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
