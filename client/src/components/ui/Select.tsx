import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options?: SelectOption[];
  placeholder?: string;
  onValueChange?: (value: string) => void;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder, children, onValueChange, ...props }, ref) => {
    return (
      <div className='relative'>
        <select
          ref={ref}
          className={cn(
            'h-11 w-full appearance-none rounded-control border border-border-control bg-surface px-3.5 pr-10 text-body text-text-primary transition-colors hover:border-text-tertiary focus:outline-none focus:ring-2 focus:ring-apple-green-400 focus:border-transparent disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-text-disabled',
            className
          )}
          onChange={(e) => onValueChange?.(e.target.value)}
          {...props}
        >
          {placeholder && (
            <option value='' disabled>
              {placeholder}
            </option>
          )}
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
          {children}
        </select>
        <ChevronDown
          size={16}
          className='pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-text-tertiary'
          aria-hidden='true'
        />
      </div>
    );
  }
);
Select.displayName = 'Select';

interface SelectTriggerProps {
  children: React.ReactNode;
}

export const SelectTrigger = forwardRef<HTMLDivElement, SelectTriggerProps>(
  (props, ref) => {
    return <div ref={ref} {...props} />;
  }
);
SelectTrigger.displayName = 'SelectTrigger';

interface SelectValueProps {
  placeholder?: string;
}

export function SelectValue({ placeholder }: SelectValueProps) {
  return <span className='text-text-tertiary'>{placeholder ?? ''}</span>;
}

export function SelectContent({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
}

export function SelectItem({ value, children }: SelectItemProps) {
  return <option value={value}>{children}</option>;
}