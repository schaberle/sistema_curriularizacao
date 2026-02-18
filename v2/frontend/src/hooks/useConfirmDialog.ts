/**
 * useConfirmDialog Hook
 * Provides a promise-based confirmation dialog
 */

import { useState, useCallback } from 'react';
import { ConfirmDialogConfig } from '../types/ui.types';

export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ConfirmDialogConfig | null>(null);
  const [resolver, setResolver] = useState<
    | { resolve: (value: boolean) => void; reject: (reason?: any) => void }
    | undefined
  >();

  const confirm = useCallback((dialogConfig: ConfirmDialogConfig) => {
    return new Promise<boolean>((resolve, reject) => {
      setConfig({
        ...dialogConfig,
        onConfirm: async () => {
          try {
            await dialogConfig.onConfirm?.();
            resolve(true);
          } catch (error) {
            reject(error);
          }
          setIsOpen(false);
        },
        onCancel: () => {
          dialogConfig.onCancel?.();
          resolve(false);
          setIsOpen(false);
        },
      });
      setResolver({ resolve, reject });
      setIsOpen(true);
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (config?.onConfirm) {
      await config.onConfirm();
    }
    setIsOpen(false);
  }, [config]);

  const handleCancel = useCallback(() => {
    if (config?.onCancel) {
      config.onCancel();
    }
    setIsOpen(false);
  }, [config]);

  return {
    isOpen,
    config,
    confirm,
    handleConfirm,
    handleCancel,
  };
}
