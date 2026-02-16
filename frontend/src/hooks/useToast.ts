/**
 * useToast Hook
 * Provides access to toast notifications
 */

import { useContext } from 'react';
import { ToastContext } from '../context/ToastContext';
import { ToastContextType } from '../types/ui.types';

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
}
