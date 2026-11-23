// components/shared/StatTile.tsx
import type { ReactNode } from 'react';

const variantStyles: Record<string, string> = {
  success: 'text-apple-green-600',
  warning: 'text-amber-600',
};

export function StatTile({
  icon,
  label,
  value,
  subtitle,
  tone = 'success',
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  subtitle?: string;
  tone?: 'success' | 'warning';
}) {
  return (
    <div className='rounded-2xl border border-border bg-surface px-4 py-4'>
      <div className='mb-2 flex items-center gap-2 text-sm text-text-secondary'>
        <span className={variantStyles[tone]}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className='text-2xl font-medium text-text-primary'>{value}</div>
      {subtitle && (
        <p className='mt-1 text-xs text-text-tertiary'>{subtitle}</p>
      )}
    </div>
  );
}
