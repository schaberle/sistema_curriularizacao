/**
 * UI Component Types
 */

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number; // milliseconds
}

export interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

export interface ConfirmDialogConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  isDestructive?: boolean; // Red button for dangerous actions
}

export interface ConfirmDialogContextType {
  isOpen: boolean;
  config: ConfirmDialogConfig | null;
  confirm: (config: ConfirmDialogConfig) => Promise<void>;
  close: () => void;
}
