import { type LabelHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../../lib/cn';

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement> & { children: ReactNode }>(
  ({ className, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn('block text-body-sm font-medium text-text-primary', className)}
        {...props}
      >
        {children}
      </label>
    );
  }
);
Label.displayName = 'Label';