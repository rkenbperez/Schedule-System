import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-control bg-border-light', className)}
      aria-hidden='true'
      {...props}
    />
  );
}

export function LoadingState({
  label = 'Loading…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role='status'
      aria-live='polite'
      className={cn(
        'flex items-center justify-center gap-2.5 rounded-card border border-border bg-surface px-4 py-12 text-body-sm text-text-secondary',
        className
      )}
    >
      <Loader2 size={18} className='animate-spin text-apple-green-600' aria-hidden='true' />
      {label}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'space-y-3 rounded-card border border-border bg-surface p-5',
        className
      )}
    >
      <Skeleton className='h-4 w-24' />
      <Skeleton className='h-8 w-32' />
      <Skeleton className='h-3 w-full' />
    </div>
  );
}
