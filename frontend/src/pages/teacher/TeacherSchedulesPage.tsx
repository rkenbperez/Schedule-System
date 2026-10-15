import { useSchedules } from '../../hooks/Schedule.hooks';
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

type GridPlacement = {
  dayColumn: number;
  startRow: number;
  endRow: number;
};

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

function placementFor(schedule: Schedule): GridPlacement {
  const startHour = timeToHours(schedule.start_time);
  const endHour = schedule.end_time
    ? timeToHours(schedule.end_time)
    : startHour + 2;

  return {
    dayColumn: schedule.day_of_week + 2,
    startRow: startHour - START_HOUR + 2,
    endRow: endHour - START_HOUR + 2,
  };
}

export default function TeacherSchedulesPage() {
  const teacherId = 1; // TEMP: hardcoded so schedules are viewable without login

  const { data: schedules, isLoading, isError } = useSchedules({ teacherId });

  const term = schedules?.[0]?.academic_term;

  const hours = Array.from({ length: 12 }, (_, i) => START_HOUR + i);

  const lastEndRow =
    schedules?.reduce((max, schedule) => {
      const placement = placementFor(schedule);

      return Math.max(max, placement.endRow);
    }, 13) ?? 13;

  const rowCount = Math.max(12, lastEndRow - 1);

  return (
    <section className='w-full'>
      <h1 className='mb-1 text-lg font-medium text-text-primary'>
        My schedules
      </h1>
      <p className='mb-6 text-sm text-text-secondary'>
        {term ? `${term.name}, ${term.school_year}` : 'No active schedules'}
      </p>

      {isLoading ? (
        <p className='text-sm text-text-secondary'>Loading schedules...</p>
      ) : isError ? (
        <p className='text-sm text-text-secondary'>
          Unable to load your schedules.
        </p>
      ) : !schedules || schedules.length === 0 ? (
        <p className='text-sm text-text-secondary'>No schedules yet.</p>
      ) : (
        <div className='overflow-x-auto'>
          <div className='min-w-[860px]'>
            <div
              className='grid gap-px rounded-card border border-border bg-border'
              style={{
                gridTemplateColumns: '64px repeat(6, minmax(0, 1fr))',
                gridTemplateRows: `2.5rem repeat(${rowCount}, 3.5rem)`,
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
                  <span className='flex h-full w-full items-start justify-end px-2 pt-1 text-[11px] leading-none text-text-secondary'>
                    {formatHour(hour)}
                  </span>
                </div>
              ))}

              {schedules.map((schedule) => {
                const placement = placementFor(schedule);
                const { course_component } = schedule;
                const { course_assignment } = schedule;
                const { section, room } = schedule;

                return (
                  <div
                    key={schedule.id}
                    className='flex flex-col justify-between overflow-hidden rounded-md border border-apple-green-300 bg-apple-green-50 p-1.5'
                    style={{
                      gridColumn: placement.dayColumn,
                      gridRow: `${placement.startRow} / ${placement.endRow}`,
                    }}
                  >
                    <div>
                      <p className='flex items-baseline justify-between gap-1 text-xs font-semibold text-apple-green-800'>
                        <span className='truncate'>
                          {course_assignment.course.code}
                        </span>
                        <span className='text-[10px] font-medium normal-case text-apple-green-700'>
                          {course_component.label}
                        </span>
                      </p>
                      <p className='truncate text-[11px] text-apple-green-700'>
                        {course_assignment.course.title}
                      </p>
                    </div>
                    <div>
                      <p className='truncate text-[10px] capitalize text-apple-green-700'>
                        {section.code} · {room.code}
                      </p>
                      <p className='text-[10px] text-apple-green-800'>
                        {formatHour(timeToHours(schedule.start_time))} -{' '}
                        {schedule.end_time
                          ? formatHour(timeToHours(schedule.end_time))
                          : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
