/**
 * LoadingSpinner Component
 * Displays a loading indicator with optional message
 */

import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

const sizeStyles = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export function LoadingSpinner({ message, size = 'md', fullScreen = false }: LoadingSpinnerProps) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="relative">
        <div className={`${sizeStyles[size]} rounded-full border-4 border-slate-200`} />
        <div
          className={`absolute inset-0 ${sizeStyles[size]} animate-spin rounded-full border-4 border-transparent border-t-[var(--brand-600)]`}
        />
      </div>
      {message && <p className="text-sm font-medium text-slate-600">{message}</p>}
    </div>
  );

  if (fullScreen) {
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">{content}</div>;
  }

  return content;
}
