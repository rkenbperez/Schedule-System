import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/cn';

export const Separator = forwardRef<HTMLHRElement, HTMLAttributes<HTMLHRElement>>(
  ({ className, ...props }, ref) => {
    return (
      <hr
        ref={ref}
        className={cn('border-border', className)}
        {...props}
      />
    );
  }
);
Separator.displayName = 'Separator';