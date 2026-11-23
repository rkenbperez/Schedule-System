import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'outline'
  | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-apple-green-600 text-white hover:bg-apple-green-700 active:bg-apple-green-800',
  secondary:
    'border border-border-control bg-surface text-text-primary hover:bg-surface-secondary active:bg-border-light',
  ghost:
    'text-text-secondary hover:bg-surface-secondary hover:text-text-primary active:bg-border-light',
  outline:
    'border border-apple-green-600 bg-transparent text-apple-green-700 hover:bg-apple-green-50 active:bg-apple-green-100',
  danger:
    'bg-danger text-white hover:bg-red-800 active:bg-red-900',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-body-sm max-sm:min-h-11',
  md: 'h-11 px-4 text-body',
  lg: 'h-12 px-5 text-body',
};

function buttonClasses({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-control font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
    variantClasses[variant],
    sizeClasses[size],
    className
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {loading ? (
        <Loader2 size={16} className='animate-spin' aria-hidden='true' />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}

type LinkButtonProps = LinkProps & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  children: ReactNode;
};

export function LinkButton({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props}>
      {icon}
      {children}
    </Link>
  );
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
  label: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
};

export function IconButton({
  label,
  variant = 'ghost',
  size = 'md',
  className,
  children,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-control transition-colors disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        size === 'sm'
          ? 'h-9 w-9 max-sm:min-h-11 max-sm:min-w-11'
          : 'h-11 w-11',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
