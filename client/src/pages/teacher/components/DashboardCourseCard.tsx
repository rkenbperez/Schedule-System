import { ArrowUpRight, CalendarDays, Clock, MapPin } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '../../../components/ui';
import { useMe } from '../../../hooks/useAuth';
import type { Schedule } from '../../../types/Types';

export default function DashboardCourseCard({
  schedule,
}: {
  schedule: Schedule;
}) {
  const { name } = useParams<{ name: string }>();
  const { data: user } = useMe({ enabled: true });
  const teacher = name ?? user?.username ?? '';

  return (
    <Link
      to={`/teacher/${teacher}/assignments/${schedule.assignment}`}
      className='group flex h-full flex-col gap-4 rounded-card border border-border bg-surface p-5 transition hover:border-apple-green-300 hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-apple-green-600'
    >
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-baseline gap-x-2 gap-y-1'>
            <h3 className='text-h3 text-text-primary'>
              {schedule.subject_label}
            </h3>
            <span className='text-body-sm text-text-tertiary'>
              Section {schedule.section_name}
            </span>
          </div>
          <p className='mt-1 truncate text-body-sm text-text-secondary'>
            {schedule.assignment_label}
          </p>
        </div>
        <Badge tone='green'>{schedule.mode_display}</Badge>
      </div>

      <div className='grid gap-3 border-t border-border-light pt-4 sm:grid-cols-2'>
        <div className='flex items-start gap-2'>
          <CalendarDays
            size={16}
            className='mt-0.5 shrink-0 text-apple-green-600'
            aria-hidden='true'
          />
          <div className='min-w-0'>
            <p className='text-caption uppercase tracking-wide text-text-tertiary'>
              Day
            </p>
            <p className='text-body-sm text-text-primary'>
              {schedule.day_display}
            </p>
          </div>
        </div>

        <div className='flex items-start gap-2'>
          <Clock
            size={16}
            className='mt-0.5 shrink-0 text-apple-green-600'
            aria-hidden='true'
          />
          <div className='min-w-0'>
            <p className='text-caption uppercase tracking-wide text-text-tertiary'>
              Time
            </p>
            <p className='text-body-sm text-text-primary'>
              {schedule.start_time}
              {schedule.end_time ? ` – ${schedule.end_time}` : ''}
            </p>
          </div>
        </div>

        <div className='flex items-start gap-2 sm:col-span-2'>
          <MapPin
            size={16}
            className='mt-0.5 shrink-0 text-apple-green-600'
            aria-hidden='true'
          />
          <div className='min-w-0'>
            <p className='text-caption uppercase tracking-wide text-text-tertiary'>
              Room
            </p>
            <p className='text-body-sm text-text-primary'>
              {schedule.room_name}
            </p>
          </div>
        </div>
      </div>

      <span className='mt-auto inline-flex items-center gap-1.5 text-body-sm font-medium text-apple-green-700'>
        View assignment
        <ArrowUpRight
          size={15}
          className='transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5'
          aria-hidden='true'
        />
      </span>
    </Link>
  );
}
