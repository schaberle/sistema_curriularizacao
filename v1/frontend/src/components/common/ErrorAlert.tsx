/**
 * ErrorAlert Component
 * Displays error messages with optional dismiss and retry buttons
 */

import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Button } from './Button';

interface ErrorAlertProps {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
  title?: string;
}

export function ErrorAlert({ message, onDismiss, onRetry, title = 'Erro' }: ErrorAlertProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <div className="flex-1">
          <h3 className="text-sm font-bold text-red-900">{title}</h3>
          <p className="mt-1 text-sm text-red-700">{message}</p>

          {(onDismiss || onRetry) && (
            <div className="mt-3 flex gap-2">
              {onRetry && (
                <Button size="sm" variant="outline" onClick={onRetry}>
                  Tentar novamente
                </Button>
              )}
              {onDismiss && (
                <Button size="sm" variant="ghost" onClick={onDismiss}>
                  Fechar
                </Button>
              )}
            </div>
          )}
        </div>

        {onDismiss && (
          <button type="button" onClick={onDismiss} className="text-red-600 transition hover:text-red-800">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
