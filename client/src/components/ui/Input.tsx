import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'h-11 w-full rounded-control border border-border-control bg-surface px-3.5 text-body text-text-primary transition-colors placeholder:text-text-tertiary hover:border-text-tertiary focus:outline-none focus:ring-2 focus:ring-apple-green-400 focus:border-transparent aria-invalid:border-danger aria-invalid:focus:ring-danger disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-text-disabled',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';