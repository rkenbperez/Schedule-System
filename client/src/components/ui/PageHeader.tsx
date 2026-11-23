import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/cn';

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  backTo?: string;
  backLabel?: string;
  children?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  backTo,
  backLabel = 'Back',
  children,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('space-y-4', className)}>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div className='min-w-0 space-y-1.5'>
          {backTo && (
            <Link
              to={backTo}
              className='inline-flex min-h-9 items-center gap-1.5 rounded-control text-body-sm font-medium text-apple-green-700 transition-colors hover:text-apple-green-800'
            >
              <ArrowLeft size={16} aria-hidden='true' />
              {backLabel}
            </Link>
          )}
          {eyebrow && (
            <p className='text-overline uppercase text-text-tertiary'>
              {eyebrow}
            </p>
          )}
          <h1 className='text-h1 text-text-primary sm:text-display'>{title}</h1>
          {description && (
            <p className='max-w-2xl text-body text-text-secondary'>
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className='flex flex-wrap items-center gap-2 sm:justify-end'>
            {actions}
          </div>
        )}
      </div>
      {children}
    </header>
  );
}
