import { Fragment } from 'react';
import { CalendarDays, CheckCircle2 } from 'lucide-react';
import { Badge } from '../../../components/ui';
import { cn } from '../../../lib/cn';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const TIMES = ['7 AM', '9 AM', '11 AM', '1 PM', '3 PM', '5 PM'];

// Grid geometry: an 8px top spacer keeps the first time label clear of the
// panel edge, the day header is 28px, and every 2-hour band is a uniform 44px.
const HEADER_ROW = 2;
const FIRST_TIME_ROW = 3;
const GRID_TEMPLATE_COLUMNS = '3.25rem repeat(5, minmax(0, 1fr))';
const GRID_TEMPLATE_ROWS = `8px 28px repeat(${TIMES.length}, 44px)`;

function compactTimeRange(startIndex: number, span: number) {
  const from = TIMES[startIndex] ?? TIMES[0];
  const to = TIMES[startIndex + span] ?? TIMES[TIMES.length - 1];
  const [fromHour, fromMeridiem] = from.split(' ');
  const [toHour, toMeridiem] = to.split(' ');
  return fromMeridiem === toMeridiem
    ? `${fromHour}–${toHour} ${toMeridiem}`
    : `${from}–${to}`;
}

type PreviewClass = {
  id: number;
  day: number;
  start: number;
  span: number;
  code: string;
  room: string;
  tone: 'green' | 'amber';
};

const CLASSES: PreviewClass[] = [
  { id: 1, day: 0, start: 0, span: 2, code: 'COSC 7', room: 'Rm 101', tone: 'green' },
  { id: 2, day: 1, start: 2, span: 2, code: 'DCIT 5', room: 'Lab 202', tone: 'green' },
  { id: 3, day: 2, start: 3, span: 1, code: 'MATH 10', room: 'Rm 204', tone: 'amber' },
  { id: 4, day: 3, start: 1, span: 2, code: 'PHYS 3', room: 'Lab 301', tone: 'green' },
  { id: 5, day: 4, start: 4, span: 1, code: 'GNED 12', room: 'Rm 305', tone: 'green' },
];

const toneClasses = {
  green: 'border-apple-green-200 bg-apple-green-50 text-apple-green-800',
  amber: 'border-warning-border bg-warning-soft text-warning',
};

export default function SchedulePreview() {
  return (
    <div className='relative hidden lg:block'>
      <div
        aria-hidden='true'
        className='absolute inset-0 translate-x-2 translate-y-2 rounded-panel border border-apple-green-200 bg-apple-green-100/60'
      />

      <div
        role='img'
        aria-label='Preview of a conflict-free weekly class timetable'
        className='relative rounded-panel border border-border bg-surface p-3.5 shadow-card'
      >
        <div className='flex flex-wrap items-center justify-between gap-2 pb-2.5'>
          <div className='flex items-center gap-1.5 text-text-secondary'>
            <CalendarDays size={14} aria-hidden='true' />
            <span className='text-caption font-medium text-text-primary'>
              1st Semester · Week 1
            </span>
          </div>
          <Badge tone='success' size='sm'>
            <CheckCircle2 size={12} aria-hidden='true' />
            No conflicts
          </Badge>
        </div>

        <div
          aria-hidden='true'
          className='grid'
          style={{
            gridTemplateColumns: GRID_TEMPLATE_COLUMNS,
            gridTemplateRows: GRID_TEMPLATE_ROWS,
          }}
        >
          {DAYS.map((day, index) => (
            <div
              key={day}
              className={cn(
                'flex items-center justify-center border-l border-t border-border-light text-caption font-medium text-text-tertiary',
                index === DAYS.length - 1 && 'border-r'
              )}
              style={{ gridColumn: index + 2, gridRow: HEADER_ROW }}
            >
              {day}
            </div>
          ))}

          {TIMES.map((time, rowIndex) => (
            <Fragment key={time}>
              <div
                className='relative'
                style={{ gridColumn: 1, gridRow: rowIndex + FIRST_TIME_ROW }}
              >
                <span className='absolute right-0 top-0 -translate-y-1/2 whitespace-nowrap pr-2.5 text-right text-caption tabular-nums text-text-tertiary'>
                  {time}
                </span>
              </div>
              {DAYS.map((_, dayIndex) => (
                <div
                  key={`${time}-${dayIndex}`}
                  className={cn(
                    'border-l border-t border-border-light',
                    dayIndex === DAYS.length - 1 && 'border-r',
                    rowIndex === TIMES.length - 1 && 'border-b'
                  )}
                  style={{
                    gridColumn: dayIndex + 2,
                    gridRow: rowIndex + FIRST_TIME_ROW,
                  }}
                />
              ))}
            </Fragment>
          ))}

          {CLASSES.map((cls) => (
            <div
              key={cls.id}
              className={cn(
                'z-10 m-1 flex flex-col justify-between overflow-hidden rounded-md border px-1.5 py-1 leading-tight',
                toneClasses[cls.tone]
              )}
              style={{
                gridColumn: cls.day + 2,
                gridRow: `${cls.start + FIRST_TIME_ROW} / span ${cls.span}`,
              }}
            >
              <span className='truncate text-caption font-semibold'>
                {cls.code}
              </span>
              <span className='truncate text-[10px] leading-3 opacity-80'>
                {cls.span > 1
                  ? `${compactTimeRange(cls.start, cls.span)} · ${cls.room}`
                  : compactTimeRange(cls.start, cls.span)}
              </span>
            </div>
          ))}
        </div>

        <div className='mt-3 flex items-center justify-between border-t border-border-light pt-2 text-caption text-text-tertiary'>
          <span>Sample week</span>
          <span>Mon–Fri</span>
        </div>
      </div>
    </div>
  );
}
