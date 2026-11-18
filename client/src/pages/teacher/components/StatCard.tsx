import type { ReactNode } from 'react';

type StatCardProps = {
  icon: ReactNode;
  label: string;
  value: number;
  variant?: 'success' | 'warning';
};

const variantStyles = {
  success: 'bg-apple-green-50 text-apple-green-600',
  warning: 'bg-amber-50 text-amber-600',
};

export default function StatCard({
  icon,
  label,
  value,
  variant = 'success',
}: StatCardProps) {
  return (
    <div
      className='
        flex-1 flex-col gap-3
        rounded-2xl border border-border bg-surface
        p-3
        sm:p-4
        md:p-5
      '
    >
      {/* Icon + Label */}
      <div className='flex flex-wrap items-center gap-2 sm:gap-3'>
        <span
          className={`
            flex h-7 w-7 shrink-0 items-center justify-center
            rounded-full
            sm:h-8 sm:w-8
            ${variantStyles[variant]}
          `}
        >
          {icon}
        </span>

        <span
          className='
            text-xs font-medium leading-snug text-text-secondary
            sm:text-sm
          '
        >
          {label}
        </span>
      </div>

      {/* Value */}
      <div
        className='
          pl-1
          text-2xl font-bold tracking-tight text-text-primary
          sm:pl-2 sm:text-3xl
        '
      >
        {value}
      </div>
    </div>
  );
}
