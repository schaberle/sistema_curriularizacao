/**
 * ConfirmDialog Component
 * Modal dialog for confirming actions
 */

import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { ConfirmDialogConfig } from '../../types/ui.types';

interface ConfirmDialogProps {
  isOpen: boolean;
  config: ConfirmDialogConfig | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  config,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onCancel]);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !config) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {config.title}
          </h2>
          <p className="text-slate-600 mt-2">{config.message}</p>
        </div>

        <div className="flex gap-3 justify-end p-6 border-t border-slate-200 bg-slate-50">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            {config.cancelText || 'Cancelar'}
          </Button>
          <Button
            variant={config.isDestructive ? 'danger' : 'primary'}
            onClick={handleConfirm}
            isLoading={isLoading}
          >
            {config.confirmText || 'Confirmar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
