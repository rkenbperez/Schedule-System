import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-card border border-dashed border-border-control bg-surface px-6 py-12 text-center',
        className
      )}
    >
      {Icon && (
        <span className='mb-4 grid h-12 w-12 place-items-center rounded-full bg-surface-secondary text-text-tertiary'>
          <Icon size={22} aria-hidden='true' />
        </span>
      )}
      <h2 className='text-h3 text-text-primary'>{title}</h2>
      {description && (
        <p className='mt-1 max-w-md text-body-sm text-text-secondary'>
          {description}
        </p>
      )}
      {action && <div className='mt-5'>{action}</div>}
    </div>
  );
}
