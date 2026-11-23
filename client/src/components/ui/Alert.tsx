import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/cn';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const toneConfig: Record<
  AlertTone,
  { icon: LucideIcon; classes: string; iconClasses: string }
> = {
  info: {
    icon: Info,
    classes: 'border-info-border bg-info-soft text-info',
    iconClasses: 'text-info',
  },
  success: {
    icon: CheckCircle2,
    classes: 'border-success-border bg-success-soft text-success',
    iconClasses: 'text-success',
  },
  warning: {
    icon: AlertTriangle,
    classes: 'border-warning-border bg-warning-soft text-warning',
    iconClasses: 'text-warning',
  },
  danger: {
    icon: XCircle,
    classes: 'border-danger-border bg-danger-soft text-danger',
    iconClasses: 'text-danger',
  },
};

type AlertProps = {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
  action?: ReactNode;
};

export function Alert({
  tone = 'info',
  title,
  children,
  className,
  action,
}: AlertProps) {
  const config = toneConfig[tone];
  const Icon = config.icon;

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-control border px-3.5 py-3 text-body-sm',
        config.classes,
        className
      )}
    >
      <Icon
        size={18}
        className={cn('mt-0.5 shrink-0', config.iconClasses)}
        aria-hidden='true'
      />
      <div className='min-w-0 flex-1'>
        {title && <p className='font-semibold'>{title}</p>}
        {children && (
          <div className={cn(title && 'mt-0.5', 'leading-relaxed')}>
            {children}
          </div>
        )}
      </div>
      {action && <div className='shrink-0'>{action}</div>}
    </div>
  );
}
