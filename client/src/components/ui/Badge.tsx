import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type BadgeTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'green';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'border-border bg-surface-secondary text-text-secondary',
  success: 'border-success-border bg-success-soft text-success',
  warning: 'border-warning-border bg-warning-soft text-warning',
  danger: 'border-danger-border bg-danger-soft text-danger',
  info: 'border-info-border bg-info-soft text-info',
  green: 'border-apple-green-200 bg-apple-green-50 text-apple-green-700',
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  size?: 'sm' | 'md';
};

export function Badge({
  tone = 'neutral',
  size = 'sm',
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-pill border font-medium',
        size === 'sm'
          ? 'px-2 py-0.5 text-caption'
          : 'px-2.5 py-1 text-body-sm',
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
