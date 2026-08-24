import { createElement } from 'react';
import { toast } from 'react-toastify';
import { translate } from '@/lib/i18n';

export type ToastVariant = 'success' | 'danger' | 'warning' | 'info';

interface ToastOptions {
  variant?: ToastVariant;
  title?: string;
  content: string;
}

const TOAST_TITLE_KEY: Record<ToastVariant, string> = {
  success: 'TOAST.SUCCESS',
  warning: 'TOAST.WARNING',
  danger: 'TOAST.DANGER',
  info: 'TOAST.INFO',
};

export const MakeToast = ({ variant = 'info', title, content }: ToastOptions): void => {
  const toastTitle = title || translate(TOAST_TITLE_KEY[variant]);
  const toastNode = createElement(
    'div',
    { className: 'awa-toast-content' },
    toastTitle
      ? [
          createElement('div', { className: 'awa-toast-title', key: 'title' }, toastTitle),
          createElement('div', { className: 'awa-toast-message', key: 'message' }, content),
        ]
      : [createElement('div', { className: 'awa-toast-message', key: 'message' }, content)]
  );

  const options = {
    autoClose: 3000,
    closeButton: true,
    className: `awa-toast awa-toast--${variant}`,
    progressClassName: 'awa-toast-progress',
  };

  switch (variant) {
    case 'success':
      toast.success(toastNode, options);
      break;
    case 'danger':
      toast.error(toastNode, options);
      break;
    case 'warning':
      toast.warning(toastNode, options);
      break;
    default:
      toast.info(toastNode, options);
  }
};
