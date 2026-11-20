// pages/teacher/components/CourseCard.tsx
import { ModeBadge } from '../../../components/shared/ModeBadge';
import { StatusBadge } from '../../../components/shared/StatusBadge';

export interface CourseCardProps {
  id: number;
  code: string;
  title: string;
  section: string;
  modes: string[];
  scheduled: boolean;
  onViewDetails: () => void;
}

export default function CourseCard({
  code,
  title,
  section,
  modes,
  scheduled,
  onViewDetails,
}: CourseCardProps) {
  return (
    <div
      className='
        flex h-full flex-col gap-3
        rounded-2xl border border-border bg-surface
        px-3 py-3
        sm:px-4 sm:py-4
        md:px-5 md:py-4
        transition
        hover:border-apple-green-200 hover:shadow-sm
        cursor-pointer
      '
      onClick={onViewDetails}
    >
      {/* Course info */}
      <div className='flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1'>
        <span className='text-sm font-medium tracking-tight text-text-primary sm:text-base'>
          {code}
        </span>
        <div className='flex items-center gap-2 shrink-0'>
          {modes.map((mode, idx) => (
            <ModeBadge key={idx} mode={mode} />
          ))}
          <StatusBadge status={scheduled ? 'scheduled' : 'pending'} />
        </div>
      </div>

      {title && title !== code && (
        <p className='text-sm text-text-secondary truncate'>{title}</p>
      )}

      {/* Course meta */}
      <div className='grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:text-sm'>
        <div className='flex flex-col gap-px'>
          <span className='text-[10px] uppercase tracking-wide text-text-tertiary'>
            Section
          </span>
          <span className='text-text-primary'>{section}</span>
        </div>
      </div>

      {/* View details */}
      <div className='mt-auto flex w-full items-center justify-center rounded-md border border-apple-green-200 px-4 py-1.5 text-xs font-medium text-apple-green-700 transition hover:border-apple-green-500 hover:bg-apple-green-50 sm:text-sm'>
        View details →
      </div>
    </div>
  );
}
