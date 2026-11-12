import { Link } from 'react-router-dom';

export interface CourseCardProps {
  id: number;
  code: string;
  title: string;
  section: string;
  studentCount: number;
  label: string;
  scheduled: boolean;
}

export default function CourseCard({
  id,
  code,
  title,
  section,
  studentCount,
  label,
  scheduled,
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
        hover:border-apple-green-200
      '
    >
      {/* Course info */}
      <div className='flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1'>
        <span className='text-sm font-medium tracking-tight text-text-primary sm:text-base'>
          {code}
        </span>
        <span className='text-xs text-text-tertiary sm:text-sm'>
          section {section}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize ${
            scheduled
              ? 'bg-apple-green-50 text-apple-green-700'
              : 'bg-amber-50 text-amber-700'
          }`}
        >
          {label}
          {scheduled ? ' · scheduled' : ' · pending'}
        </span>
      </div>

      <p className='text-sm text-text-secondary'>{title}</p>

      {/* Course meta */}
      <div className='grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:text-sm'>
        <div className='flex flex-col gap-px'>
          <span className='text-[10px] uppercase tracking-wide text-text-tertiary'>
            Section
          </span>
          <span className='text-text-primary'>{section}</span>
        </div>
        <div className='flex flex-col gap-px'>
          <span className='text-[10px] uppercase tracking-wide text-text-tertiary'>
            Students
          </span>
          <span className='text-text-primary'>{studentCount}</span>
        </div>
      </div>

      {/* View details */}
      <Link
        to={`/teacher/courses/${id}`}
        className='mt-auto flex w-full items-center justify-center rounded-md border border-apple-green-200 px-4 py-1.5 text-xs font-medium text-apple-green-700 transition hover:border-apple-green-500 hover:bg-apple-green-50 sm:text-sm'
      >
        View details →
      </Link>
    </div>
  );
}
