import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-start gap-3 rounded-card border border-border bg-surface p-4 sm:p-5',
        className
      )}
    >
      {Icon && (
        <span className='grid h-10 w-10 shrink-0 place-items-center rounded-control bg-apple-green-50 text-apple-green-700'>
          <Icon size={19} strokeWidth={1.9} aria-hidden='true' />
        </span>
      )}
      <div className='min-w-0 flex-1'>
        <p className='truncate text-body-sm font-medium text-text-secondary'>
          {label}
        </p>
        <p className='mt-0.5 text-numeric text-text-primary tabular-nums'>
          {value}
        </p>
        {hint && (
          <p className='mt-0.5 text-caption text-text-tertiary'>{hint}</p>
        )}
      </div>
    </div>
  );
}
