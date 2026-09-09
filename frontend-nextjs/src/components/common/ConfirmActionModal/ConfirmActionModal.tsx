'use client';

import { useEffect, useState, type ReactNode } from 'react';
import styles from './ConfirmActionModal.module.scss';

interface ConfirmActionModalProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmActionModal({
  open,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  confirmVariant = 'primary',
  onClose,
  onConfirm,
}: ConfirmActionModalProps) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) setConfirming(false);
  }, [open]);

  if (!open) return null;

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-action-title"
        aria-describedby="confirm-action-message"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-action-title" className={styles.title}>
          {title}
        </h2>
        <div id="confirm-action-message" className={styles.message}>
          {message}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={confirming}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={
              confirmVariant === 'danger'
                ? `${styles.confirmBtn} ${styles.confirmBtnDanger}`
                : styles.confirmBtn
            }
            onClick={() => void handleConfirm()}
            disabled={confirming}
          >
            {confirming ? 'Đang xử lý…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
