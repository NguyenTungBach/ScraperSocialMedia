'use client';

import { useEffect, useId, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildPageItems } from './buildPageItems';
import styles from './Pagination.module.scss';

export interface PaginationProps {
  page: number;
  totalPages: number;
  totalRecords?: number;
  /** Ví dụ: "đối tượng", "bài", "kênh" */
  unitLabel?: string;
  /** Chuỗi info tùy chỉnh — nếu có thì bỏ qua unitLabel/totalRecords mặc định */
  info?: string;
  disabled?: boolean;
  onChange: (page: number) => void;
  className?: string;
  siblingCount?: number;
}

function clampPage(value: number, totalPages: number): number {
  const total = Math.max(1, totalPages);
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(1, Math.floor(value)), total);
}

export function Pagination({
  page,
  totalPages,
  totalRecords,
  unitLabel,
  info,
  disabled = false,
  onChange,
  className,
  siblingCount = 1,
}: PaginationProps) {
  const safeTotal = Math.max(1, totalPages || 1);
  const current = clampPage(page, safeTotal);
  const items = buildPageItems(current, safeTotal, siblingCount);
  const jumpId = useId();
  const [jumpValue, setJumpValue] = useState(String(current));

  useEffect(() => {
    setJumpValue(String(current));
  }, [current]);

  const goTo = (next: number) => {
    if (disabled) return;
    const target = clampPage(next, safeTotal);
    if (target === current) return;
    onChange(target);
  };

  const submitJump = () => {
    const parsed = Number(String(jumpValue).trim());
    if (!Number.isFinite(parsed)) {
      setJumpValue(String(current));
      return;
    }
    goTo(parsed);
  };

  const defaultInfo =
    totalRecords != null
      ? `Trang ${current}/${safeTotal} · ${totalRecords.toLocaleString('vi-VN')}${
          unitLabel ? ` ${unitLabel}` : ''
        }`
      : `Trang ${current}/${safeTotal}`;

  return (
    <nav className={cn(styles.root, className)} aria-label="Phân trang">
      <div className={styles.info}>{info ?? defaultInfo}</div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.navBtn}
          disabled={disabled || current <= 1}
          onClick={() => goTo(current - 1)}
          aria-label="Trang trước"
        >
          <ChevronLeft size={16} aria-hidden />
          <span>Trang trước</span>
        </button>

        <div className={styles.pages} role="list">
          {items.map((item, index) =>
            item === 'ellipsis' ? (
              <span key={`e-${index}`} className={styles.ellipsis} aria-hidden>
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                role="listitem"
                className={cn(styles.pageNum, item === current && styles.pageNumActive)}
                disabled={disabled}
                aria-current={item === current ? 'page' : undefined}
                aria-label={`Trang ${item}`}
                onClick={() => goTo(item)}
              >
                {item}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          className={styles.navBtn}
          disabled={disabled || current >= safeTotal}
          onClick={() => goTo(current + 1)}
          aria-label="Trang sau"
        >
          <span>Trang sau</span>
          <ChevronRight size={16} aria-hidden />
        </button>

        {safeTotal > 1 && (
          <form
            className={styles.jump}
            onSubmit={(e) => {
              e.preventDefault();
              submitJump();
            }}
          >
            <label className={styles.jumpLabel} htmlFor={jumpId}>
              Đi tới
            </label>
            <input
              id={jumpId}
              className={styles.jumpInput}
              type="number"
              min={1}
              max={safeTotal}
              inputMode="numeric"
              value={jumpValue}
              disabled={disabled}
              onChange={(e) => setJumpValue(e.target.value)}
              onBlur={() => setJumpValue(String(current))}
              aria-label="Nhập số trang"
            />
            <button type="submit" className={styles.jumpBtn} disabled={disabled}>
              Go
            </button>
          </form>
        )}
      </div>
    </nav>
  );
}
