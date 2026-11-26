import { useState, useRef, useEffect, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
}

export function Tooltip({ content, children, side = 'top', align = 'center' }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !triggerRef.current || !contentRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const contentRect = contentRef.current.getBoundingClientRect();
    const gap = 8;

    let top = 0;
    let left = 0;

    if (side === 'top') {
      top = triggerRect.top - contentRect.height - gap;
      if (align === 'start') left = triggerRect.left;
      else if (align === 'end') left = triggerRect.right - contentRect.width;
      else left = triggerRect.left + (triggerRect.width - contentRect.width) / 2;
    } else if (side === 'bottom') {
      top = triggerRect.bottom + gap;
      if (align === 'start') left = triggerRect.left;
      else if (align === 'end') left = triggerRect.right - contentRect.width;
      else left = triggerRect.left + (triggerRect.width - contentRect.width) / 2;
    }

    contentRef.current.style.top = `${top}px`;
    contentRef.current.style.left = `${left}px`;
  }, [open, side, align]);

  return (
    <div
      ref={triggerRef}
      className='relative inline-block'
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <div
          ref={contentRef}
          className={cn(
            'fixed z-50 px-2.5 py-1.5 text-caption text-white bg-text-primary rounded-control shadow-lg whitespace-nowrap animate-in fade-in-0 zoom-in-95',
            'pointer-events-none'
          )}
          style={{ position: 'fixed' }}
        >
          {content}
        </div>
      )}
    </div>
  );
}

export function TooltipTrigger({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function TooltipContent({ children }: { children: ReactNode }) {
  return <>{children}</>;
}