import { useMemo, useState } from 'react';
import { CalendarDays, Clock3, MapPin } from 'lucide-react';
import { useSchedules } from '../../hooks/Schedule.hooks';
import { useMe } from '../../hooks/useAuth';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  LoadingState,
  PageHeader,
  SegmentedControl,
} from '../../components/ui';
import type { Schedule } from '../../types/Types';
import {
  TIMETABLE_START_HOUR,
  formatHour,
  formatTime,
  placementFor,
  timeToHours,
} from '../../utils/timetableLayout';

const DAYS = [
  { label: 'Monday', short: 'Mon' },
  { label: 'Tuesday', short: 'Tue' },
  { label: 'Wednesday', short: 'Wed' },
  { label: 'Thursday', short: 'Thu' },
  { label: 'Friday', short: 'Fri' },
  { label: 'Saturday', short: 'Sat' },
];

const HOURS = Array.from(
  { length: 12 },
  (_, index) => TIMETABLE_START_HOUR + index
);

type DayFilter = 'all' | '0' | '1' | '2' | '3' | '4' | '5';

export default function TeacherSchedulesPage() {
  const { data: user } = useMe({ enabled: true });
  const teacherId = user?.professor?.id;
  const [dayFilter, setDayFilter] = useState<DayFilter>('all');

  const { data: schedules, isLoading, isError } = useSchedules({
    teacherId,
    enabled: !!teacherId,
  });

  const resolvedSchedules: Schedule[] = useMemo(
    () => schedules ?? [],
    [schedules]
  );

  const sortedSchedules = useMemo(
    () =>
      [...resolvedSchedules].sort(
        (a, b) =>
          a.day - b.day ||
          timeToHours(a.start_time) - timeToHours(b.start_time)
      ),
    [resolvedSchedules]
  );

  const filteredSchedules = useMemo(
    () =>
      dayFilter === 'all'
        ? sortedSchedules
        : sortedSchedules.filter(
            (schedule) => String(schedule.day) === dayFilter
          ),
    [sortedSchedules, dayFilter]
  );

  const dayOptions = [
    { value: 'all' as const, label: 'All days', count: sortedSchedules.length },
    ...DAYS.map((day, index) => ({
      value: String(index) as Exclude<DayFilter, 'all'>,
      label: day.short,
      count: sortedSchedules.filter((schedule) => schedule.day === index)
        .length,
    })),
  ];

  const lastEndRow = resolvedSchedules.reduce((max, schedule) => {
    return Math.max(max, placementFor(schedule).endRow);
  }, 13);

  const rowCount = Math.max(12, lastEndRow - 1);

  const termLabel =
    resolvedSchedules.length > 0
      ? '1st Semester, 2026–2027'
      : 'No active schedules';

  return (
    <section className='w-full space-y-6'>
      <PageHeader
        eyebrow='Teacher'
        title='My schedules'
        description={termLabel}
      />

      {isLoading ? (
        <LoadingState label='Loading your schedules…' />
      ) : isError ? (
        <Alert tone='danger' title='Unable to load your schedules'>
          Please refresh the page or try again later.
        </Alert>
      ) : resolvedSchedules.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title='No schedules yet'
          description='Your weekly timetable will appear here once classes are scheduled.'
        />
      ) : (
        <>
          <div className='lg:hidden'>
            <SegmentedControl
              label='Filter by day'
              options={dayOptions}
              value={dayFilter}
              onChange={setDayFilter}
            />
          </div>

          <div className='space-y-3 lg:hidden'>
            {filteredSchedules.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title='No classes on this day'
                description='Choose another day to see your schedule.'
              />
            ) : (
              filteredSchedules.map((schedule) => (
                <Card key={schedule.id} className='p-4'>
                  <div className='flex flex-wrap items-start justify-between gap-2'>
                    <div className='min-w-0'>
                      <p className='text-body font-semibold text-text-primary'>
                        {schedule.subject_label}
                      </p>
                      <p className='text-body-sm text-text-secondary'>
                        Section {schedule.section_name}
                      </p>
                    </div>
                    <Badge tone='green'>{schedule.mode_display}</Badge>
                  </div>

                  <dl className='mt-3 grid grid-cols-2 gap-3 border-t border-border-light pt-3'>
                    <div className='flex items-start gap-2'>
                      <CalendarDays
                        size={15}
                        className='mt-0.5 shrink-0 text-apple-green-600'
                        aria-hidden='true'
                      />
                      <div>
                        <dt className='text-caption uppercase tracking-wide text-text-tertiary'>
                          Day
                        </dt>
                        <dd className='text-body-sm text-text-primary'>
                          {schedule.day_display}
                        </dd>
                      </div>
                    </div>
                    <div className='flex items-start gap-2'>
                      <Clock3
                        size={15}
                        className='mt-0.5 shrink-0 text-apple-green-600'
                        aria-hidden='true'
                      />
                      <div>
                        <dt className='text-caption uppercase tracking-wide text-text-tertiary'>
                          Time
                        </dt>
                        <dd className='text-body-sm text-text-primary'>
                          {formatTime(schedule.start_time)}
                          {schedule.end_time
                            ? ` – ${formatTime(schedule.end_time)}`
                            : ''}
                        </dd>
                      </div>
                    </div>
                    <div className='col-span-2 flex items-start gap-2'>
                      <MapPin
                        size={15}
                        className='mt-0.5 shrink-0 text-apple-green-600'
                        aria-hidden='true'
                      />
                      <div>
                        <dt className='text-caption uppercase tracking-wide text-text-tertiary'>
                          Room
                        </dt>
                        <dd className='text-body-sm text-text-primary'>
                          {schedule.room_name}
                        </dd>
                      </div>
                    </div>
                  </dl>
                </Card>
              ))
            )}
          </div>

          <div className='hidden overflow-auto rounded-card border border-border bg-surface lg:block lg:max-h-[70vh]'>
            <div className='min-w-[920px]'>
              <div
                className='grid gap-px bg-border'
                style={{
                  gridTemplateColumns: '72px repeat(6, minmax(0, 1fr))',
                  gridTemplateRows: `2.75rem repeat(${rowCount}, 5rem)`,
                }}
              >
                <div className='sticky left-0 top-0 z-30 bg-surface' />
                {DAYS.map((day) => (
                  <div
                    key={day.label}
                    className='sticky top-0 z-20 flex items-center justify-center bg-surface px-2 text-body-sm font-medium text-text-primary'
                  >
                    {day.label}
                  </div>
                ))}

                {HOURS.map((hour, index) => (
                  <div
                    key={hour}
                    className='sticky left-0 z-10 bg-surface'
                    style={{ gridColumn: 1, gridRow: index + 2 }}
                  >
                    <span className='flex h-full w-full items-start justify-end px-2 pt-1.5 text-caption leading-none text-text-secondary'>
                      {formatHour(hour)}
                    </span>
                  </div>
                ))}

                {resolvedSchedules.map((schedule) => {
                  const placement = placementFor(schedule);
                  const { isCompact, timeLabel: timeRange } = placement;

                  return (
                    <div
                      key={schedule.id}
                      className='m-1 flex min-h-0 min-w-0 flex-col justify-between gap-1 overflow-hidden rounded-control border border-apple-green-300 bg-apple-green-50 p-2 leading-tight'
                      style={{
                        gridColumn: placement.dayColumn,
                        gridRow: `${placement.startRow} / span ${placement.rowSpan}`,
                      }}
                      title={`${schedule.subject_label} · Section ${schedule.section_name} · ${timeRange} · ${schedule.room_name}`}
                    >
                      <div className='min-h-0 min-w-0'>
                        <div className='flex items-start justify-between gap-1'>
                          <p className='truncate text-caption font-semibold leading-tight text-apple-green-900'>
                            {schedule.subject_label}
                          </p>
                          <span className='shrink-0 text-caption font-medium leading-tight text-apple-green-700'>
                            {schedule.mode_display}
                          </span>
                        </div>
                        <p className='truncate text-caption leading-tight text-apple-green-800'>
                          Section {schedule.section_name}
                        </p>
                        {!isCompact && (
                          <p className='truncate text-caption leading-tight text-apple-green-700'>
                            {schedule.room_name}
                          </p>
                        )}
                      </div>
                      <p className='truncate text-caption font-medium leading-tight text-apple-green-900'>
                        {isCompact
                          ? `${timeRange} • ${schedule.room_name}`
                          : timeRange}
                      </p>
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
