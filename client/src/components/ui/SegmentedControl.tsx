import { cn } from '../../lib/cn';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role='group'
      aria-label={label}
      className={cn(
        'flex gap-1 overflow-x-auto rounded-control border border-border bg-surface-secondary p-1',
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type='button'
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-[8px] px-3 text-body-sm font-medium transition-colors max-sm:min-h-11',
              active
                ? 'bg-surface text-text-primary shadow-card'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            {option.label}
            {typeof option.count === 'number' && (
              <span
                className={cn(
                  'rounded-pill px-1.5 py-0.5 text-caption tabular-nums',
                  active
                    ? 'bg-apple-green-50 text-apple-green-700'
                    : 'bg-border-light text-text-tertiary'
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
