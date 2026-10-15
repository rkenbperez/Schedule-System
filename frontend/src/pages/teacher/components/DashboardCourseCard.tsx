import {
  CalendarDays,
  Clock,
  GraduationCap,
  Layers,
  MapPin,
  Users,
} from 'lucide-react';
import type { ScheduledCourse } from '../../../types/Types';

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function DashboardCourseCard({
  schedule,
}: {
  schedule: ScheduledCourse;
}) {
  const isLab = schedule.type === 'laboratory';

  return (
    <div
      className='
        flex h-full flex-col gap-4
        rounded-2xl border border-border bg-surface
        px-4 py-4
        transition
        hover:border-apple-green-200 hover:shadow-sm
      '
    >
      {/* Header */}
      <div className='flex items-start justify-between gap-2'>
        <div className='flex min-w-0 flex-col gap-0.5'>
          <div className='flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1'>
            <span className='text-base font-semibold tracking-tight text-text-primary'>
              {schedule.course.code}
            </span>
            <span className='text-xs text-text-tertiary sm:text-sm'>
              section {schedule.section.name}
            </span>
          </div>
          <span className='truncate text-sm text-text-secondary'>
            {schedule.course.name}
          </span>
        </div>

        {/* Type badge */}
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium capitalize tracking-wide ${
            isLab
              ? 'bg-apple-green-100 text-apple-green-700'
              : 'bg-apple-green-50 text-apple-green-700'
          }`}
        >
          {schedule.type}
        </span>
      </div>

      {/* Divider */}
      <div className='border-t border-border-light' />

      {/* Schedule meta */}
      <div className='grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:text-sm'>
        <div className='flex items-center gap-2'>
          <div className='flex flex-col leading-tight'>
            <div className='flex gap-2'>
              <CalendarDays
                size={14}
                className='shrink-0 text-apple-green-600'
              />
              <span className='text-[10px] uppercase tracking-wide text-text-tertiary'>
                Day
              </span>
            </div>

            <span className='text-text-primary'>
              {DAY_LABELS[schedule.day_of_week]}
            </span>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <div className='flex flex-col leading-tight'>
            <div className='flex gap-2'>
              <Clock size={14} className='shrink-0 text-apple-green-600' />
              <span className='text-[10px] uppercase tracking-wide text-text-tertiary'>
                Time
              </span>
            </div>
            <span className='text-text-primary'>
              {schedule.time_slot_label}
            </span>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <div className='flex flex-col leading-tight'>
            <div className='flex gap-2'>
              <MapPin size={14} className='shrink-0 text-apple-green-600' />
              <span className='text-[10px] uppercase tracking-wide text-text-tertiary'>
                Room
              </span>
            </div>
            <span className='text-text-primary'>{schedule.room.name}</span>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <div className='flex flex-col leading-tight'>
            <div className='flex gap-2'>
              <Users size={14} className='shrink-0 text-apple-green-600' />
              <span className='text-[10px] uppercase tracking-wide text-text-tertiary'>
                Students
              </span>
            </div>
            <span className='text-text-primary'>
              {schedule.section.student_count}
            </span>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <div className='flex flex-col leading-tight'>
            <div className='flex gap-2'>
              <GraduationCap
                size={14}
                className='shrink-0 text-apple-green-600'
              />
              <span className='text-[10px] uppercase tracking-wide text-text-tertiary'>
                Year level
              </span>
            </div>
            <span className='text-text-primary'>
              {schedule.section.year_leve}
            </span>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <div className='flex flex-col leading-tight'>
            <div className='flex gap-2'>
              <Layers size={14} className='shrink-0 text-apple-green-600' />
              <span className='text-[10px] uppercase tracking-wide text-text-tertiary'>
                Term
              </span>
            </div>
            <span className='text-text-primary'>
              {schedule.section.academic_term}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
