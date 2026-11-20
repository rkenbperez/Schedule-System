// pages/teacher/TeacherSchedulesPage.tsx
import { useParams, Link } from 'react-router-dom';
import { Calendar, ArrowRight } from 'lucide-react';
import { useSchedules } from '../../hooks/Schedule.hooks';
import { useMe } from '../../hooks/useAuth';
import { SkeletonCard } from '../../components/shared/Skeleton';
import type { Schedule } from '../../types/Types';

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const START_HOUR = 7;
const END_HOUR = 20;

function timeToHours(time: string): number {
  const [hours, minutes = '0'] = time.split(':');
  return Number(hours) + Number(minutes) / 60;
}

function formatHour(hour: number) {
  const period = hour < 12 ? 'AM' : 'PM';
  const whole = Math.floor(hour);
  const minutes = Math.round((hour - whole) * 60);
  const display = whole % 12 === 0 ? 12 : whole % 12;
  return `${display}:${String(minutes).padStart(2, '0')} ${period}`;
}

function splitSubject(label: string) {
  const parts = label.split(' - ');
  return {
    code: parts[0] ?? '',
    title: parts.slice(1).join(' - '),
  };
}

function formatTimeRange(startHour: number, endHour: number): string {
  const startPeriod = startHour < 12 ? 'am' : 'pm';
  const endPeriod = endHour < 12 ? 'am' : 'pm';
  const startDisplay = startHour % 12 === 0 ? 12 : startHour % 12;
  const endDisplay = endHour % 12 === 0 ? 12 : endHour % 12;
  // Same half of day: show period once at the end (e.g. "7–10am", "2–3pm").
  // Cross-meridiem: show period on each side (e.g. "10am–1pm", "10am–12pm").
  if (startPeriod === endPeriod) {
    return `${startDisplay}–${endDisplay}${startPeriod}`;
  }
  return `${startDisplay}${startPeriod}–${endDisplay}${endPeriod}`;
}

function modeStyle(mode: string | null) {
  switch (mode) {
    case 'Synchronous':
      return {
        bg: 'bg-emerald-50',
        border: 'border-emerald-300',
        text: 'text-emerald-900',
        modeText: 'text-emerald-800',
      };
    case 'Laboratory':
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-300',
        text: 'text-amber-900',
        modeText: 'text-amber-800',
      };
    case 'Asynchronous':
      return {
        bg: 'bg-indigo-50',
        border: 'border-indigo-300',
        text: 'text-indigo-900',
        modeText: 'text-indigo-800',
      };
    default:
      return {
        bg: 'bg-surface-secondary',
        border: 'border-border',
        text: 'text-text-primary',
        modeText: 'text-text-secondary',
      };
  }
}

function placementFor(schedule: Schedule): {
  dayColumn: number;
  startRow: number;
  endRow: number;
} {
  const startHour = timeToHours(schedule.start_time);
  const endHour = schedule.end_time
    ? timeToHours(schedule.end_time)
    : startHour + 2;
  return {
    dayColumn: schedule.day + 2,
    startRow: startHour - START_HOUR + 2,
    endRow: endHour - START_HOUR + 2,
  };
}

export default function TeacherSchedulesPage() {
  const { data: user } = useMe({ enabled: true });
  const { name: teacherName } = useParams<{ name: string }>();
  const teacher = teacherName ?? 'juan';
  const teacherId = user?.professor?.id;

  const { data: schedules, isLoading, isError } = useSchedules({
    teacherId,
    enabled: !!teacherId,
  });

  const resolvedSchedules: Schedule[] = schedules ?? [];

  if (isLoading) {
    return (
      <section className='w-full'>
        <h1 className='mb-1 text-lg font-medium text-text-primary'>
          My Schedule
        </h1>
        <div className='mt-8 flex flex-col items-center justify-center py-16 text-text-tertiary text-sm'>
          <div className='mb-3 opacity-50'>
            <SkeletonCard />
          </div>
          <p className='text-sm font-medium text-text-primary'>
            Loading schedule…
          </p>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className='w-full'>
        <p className='text-sm text-text-secondary'>
          Unable to load your schedules.
        </p>
      </section>
    );
  }

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

  return (
    <section className='w-full'>
      <h1 className='mb-1 text-lg font-medium text-text-primary'>
        My Schedule
      </h1>

      {resolvedSchedules.length === 0 ? (
        <div className='mt-8 flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-border bg-surface-secondary'>
          <Calendar size={32} className='mb-3 opacity-50' />
          <h3 className='text-sm font-medium text-text-primary'>
            No classes scheduled yet
          </h3>
          <p className='text-xs text-text-secondary mt-1'>
            Your schedule will appear here once classes are assigned to you.
          </p>
          <Link
            to={`/teacher/${teacher}/assignments`}
            className='mt-4 flex items-center gap-1.5 text-xs font-medium text-apple-green-600 hover:text-apple-green-700'
          >
            Go to My assignments
            <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <>
          <p className='mb-6 text-sm text-text-secondary'>
            1st semester, 2026 to 2027
          </p>

          <div className='overflow-x-auto overflow-y-auto visible-scrollbar max-h-[calc(100vh-10rem)]'>
            <div className='min-w-[860px]'>
              <div
                className='grid gap-px rounded-card border border-border bg-border'
                style={{
                  gridTemplateColumns: '64px repeat(6, minmax(0, 1fr))',
                  gridTemplateRows: `2.5rem repeat(${END_HOUR - START_HOUR + 1}, 58px)`,
                }}
              >
                <div className='bg-surface' />
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className='flex items-center justify-center bg-surface text-sm font-medium text-text-primary'
                  >
                    {day}
                  </div>
                ))}

                {hours.map((hour, index) => (
                  <div
                    key={hour}
                    className='bg-surface'
                    style={{ gridColumn: 1, gridRow: index + 2 }}
                  >
                    <span
                      className='flex h-full w-full items-start justify-end px-2 pt-1 text-[11px] leading-none text-text-secondary'
                    >
                      {formatHour(hour)}
                    </span>
                  </div>
                ))}

                {resolvedSchedules.map((schedule) => {
                  const placement = placementFor(schedule);
                  const { code } = splitSubject(schedule.subject_label);
                  const startHour = timeToHours(schedule.start_time);
                  const endHour = schedule.end_time
                    ? timeToHours(schedule.end_time)
                    : startHour + Math.max(1, schedule.duration_slots ?? 1);
                  const { bg, border, text, modeText } = modeStyle(
                    schedule.mode_display,
                  );
                  return (
                    <div
                      key={schedule.id}
                      className={`overflow-hidden rounded-md border ${border} ${bg} ${text} p-2 py-1`}
                      title={schedule.subject_label}
                      style={{
                        gridColumn: placement.dayColumn,
                        gridRow: `${placement.startRow} / ${placement.endRow}`,
                      }}
                    >
                      <div className='flex items-baseline justify-between gap-1 leading-tight mb-0.5'>
                        <span className='font-semibold text-[10px] truncate'>
                          {code}
                        </span>
                        <span className={`text-[9px] font-medium normal-case shrink-0 ${modeText}`}>
                          {schedule.mode_display ?? '—'}
                        </span>
                      </div>
                      <div className='flex items-center gap-1 leading-tight mb-0.5'>
                        <span className={`text-[9px] truncate ${text}`}>
                          {schedule.section_name}
                        </span>
                        <span className='text-[9px] text-text-tertiary'>·</span>
                        <span className={`text-[9px] truncate ${text}`}>
                          {formatTimeRange(startHour, endHour)}
                        </span>
                      </div>
                      <div className='flex items-center gap-1 leading-tight'>
                        <span className={`text-[9px] truncate ${text}`}>
                          {schedule.room_name ?? 'No Room'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
