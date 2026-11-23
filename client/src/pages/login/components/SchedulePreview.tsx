import { Fragment } from 'react';
import { CalendarDays, CheckCircle2 } from 'lucide-react';
import { Badge } from '../../../components/ui';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const TIMES = ['7 AM', '9 AM', '11 AM', '1 PM', '3 PM', '5 PM'];

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
            gridTemplateColumns: '38px repeat(5, minmax(0, 1fr))',
            gridTemplateRows: '28px repeat(6, 30px)',
          }}
        >
          <div />
          {DAYS.map((day, index) => (
            <div
              key={day}
              className='flex items-center justify-center border-b border-border-light text-caption font-medium text-text-tertiary'
              style={{ gridColumn: index + 2, gridRow: 1 }}
            >
              {day}
            </div>
          ))}

          {TIMES.map((time, rowIndex) => (
            <Fragment key={time}>
              <div
                className='flex items-start justify-end pr-2 pt-1 text-caption text-text-tertiary'
                style={{ gridColumn: 1, gridRow: rowIndex + 2 }}
              >
                {time}
              </div>
              {DAYS.map((_, dayIndex) => (
                <div
                  key={`${time}-${dayIndex}`}
                  className='border-l border-t border-border-light/80'
                  style={{
                    gridColumn: dayIndex + 2,
                    gridRow: rowIndex + 2,
                  }}
                />
              ))}
            </Fragment>
          ))}

          {CLASSES.map((cls) => (
            <div
              key={cls.id}
              className={`z-10 m-0.5 flex flex-col justify-between overflow-hidden rounded-md border p-1.5 leading-tight ${toneClasses[cls.tone]}`}
              style={{
                gridColumn: cls.day + 2,
                gridRow: `${cls.start + 2} / span ${cls.span}`,
              }}
            >
              <span className='truncate text-caption font-semibold'>
                {cls.code}
              </span>
              {cls.span > 1 && (
                <span className='truncate text-caption opacity-80'>
                  {cls.room}
                </span>
              )}
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
