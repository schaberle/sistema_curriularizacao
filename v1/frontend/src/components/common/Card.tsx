/**
 * Card Component
 * Container for content with consistent styling
 */

import React, { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  padding?: 'sm' | 'md' | 'lg';
}

const paddingStyles = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

export function Card({
  children,
  title,
  subtitle,
  footer,
  padding = 'md',
  className = '',
  ...props
}: CardProps) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`} {...props}>
      {(title || subtitle) && (
        <header className={`${paddingStyles[padding]} border-b border-slate-100`}>
          {title && <h3 className="text-base font-extrabold tracking-tight text-slate-900">{title}</h3>}
          {subtitle && <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>}
        </header>
      )}

      <div className={paddingStyles[padding]}>{children}</div>

      {footer && <footer className={`${paddingStyles[padding]} border-t border-slate-100 bg-slate-50`}>{footer}</footer>}
    </section>
  );
}
