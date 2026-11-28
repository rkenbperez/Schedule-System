import { type ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode | ((props: { value: string; onValueChange: (value: string) => void }) => ReactNode);
  className?: string;
}

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  const renderChildren = typeof children === 'function' ? children({ value, onValueChange }) : children;
  return <div className={cn('space-y-4', className)}>{renderChildren}</div>;
}

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      className={cn('flex gap-1 p-1 bg-surface-secondary rounded-lg', className)}
      role='tablist'
    >
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}

export function TabsTrigger({ children, disabled, className, onClick }: TabsTriggerProps) {
  return (
    <button
      role='tab'
      aria-selected='false'
      aria-disabled={disabled}
      className={cn(
        'flex items-center gap-2 px-3 py-2 text-body-sm font-medium rounded-md transition-all',
        'data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-text-primary',
        'hover:bg-surface-tertiary hover:text-text-primary',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      data-state='inactive'
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ children, className }: TabsContentProps) {
  return (
    <div role='tabpanel' className={cn('animate-in fade-in-0', className)}>
      {children}
    </div>
  );
}