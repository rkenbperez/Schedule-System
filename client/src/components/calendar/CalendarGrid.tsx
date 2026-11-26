// components/calendar/CalendarGrid.tsx
import { DAYS, gridRowsForRange, timeToHour } from '../../utils/timeMapping';
import { EventCard } from './EventCard';
import type { PublicClass } from '../../types/Types';

const START_HOUR = 7;
const END_HOUR = 20;
const ROW_COUNT = END_HOUR - START_HOUR + 1; // 14 rows

interface CalendarGridProps {
  classes: PublicClass[];
  viewBySection: boolean;
}

export function CalendarGrid({ classes, viewBySection }: CalendarGridProps) {
  const hourLabels = Array.from({ length: ROW_COUNT }, (_, i) => START_HOUR + i);

  return (
    <div className='overflow-x-auto overflow-y-auto visible-scrollbar max-h-[calc(100vh-24rem)]'>
      <div className='min-w-[1040px]'>
        <div
          className='grid gap-px rounded-card border border-border bg-surface'
          style={{
            gridTemplateColumns: '4.5rem repeat(6, minmax(160px, 1fr))',
            gridTemplateRows: `2.5rem repeat(${ROW_COUNT}, 64px)`,
          }}
        >
          {/* Top-left corner */}
          <div className='bg-surface' />

          {/* Day headers (sticky) */}
          {DAYS.map((day: string, idx: number) => (
            <div
              key={day}
              className='sticky top-0 z-10 bg-surface flex items-center justify-center text-sm font-medium text-text-primary border-b border-border'
              style={{ gridColumn: idx + 2 }}
            >
              {day}
            </div>
          ))}

          {/* Hour labels */}
          {hourLabels.map((hour: number) => (
            <div
              key={hour}
              className='bg-surface flex items-start justify-end px-2 pt-1 text-[11px] leading-none text-text-secondary'
              style={{ gridColumn: 1, gridRow: hourLabels.indexOf(hour) + 2 }}
            >
              {hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`}
            </div>
          ))}

          {/* Event blocks: direct grid children with proper gridRow spanning */}
          {classes.map((cls: PublicClass) => {
            const dayIdx = DAYS.indexOf(cls.day_name as (typeof DAYS)[number]);
            const dayColumn = dayIdx + 2; // day column starts at grid column 2
            const startHour = timeToHour(cls.start_time);
            const { gridRowStart, gridRowEnd } = gridRowsForRange(
              cls.start_time,
              cls.end_time
            );

            // For overlapping events at the same day and start hour, split column width
            const cellClasses = classes.filter(
              c => c.day_name === cls.day_name && timeToHour(c.start_time) === startHour
            );
            const clsIdx = cellClasses.indexOf(cls);
            const blockCount = cellClasses.length;

            const width = viewBySection ? '100%' : `${100 / blockCount}%`;
            const left = viewBySection ? '0%' : `${(100 / blockCount) * clsIdx}%`;

            return (
              <EventCard
                key={cls.id}
                cls={cls}
                isSingleFilterMode={viewBySection}
                style={{
                  position: 'relative',
                  gridColumn: `${dayColumn} / span 1`,
                  gridRow: `${gridRowStart} / span ${Math.max(
                    1,
                    gridRowEnd - gridRowStart
                  )}`,
                  width,
                  left,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
