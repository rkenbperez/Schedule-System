export const TIMETABLE_START_HOUR = 7;
export const TIMETABLE_DAY_COUNT = 6;

export interface TimetableSlot {
  day: number;
  start_time: string;
  end_time: string | null;
}

export interface TimetablePlacement {
  dayColumn: number;
  startRow: number;
  endRow: number;
  rowSpan: number;
  startHour: number;
  endHour: number;
  durationHours: number;
  isCompact: boolean;
  timeLabel: string;
}

export function timeToHours(time: string): number {
  const [hours, minutes = '0'] = time.split(':');
  const parsedHours = Number(hours);
  const parsedMinutes = Number(minutes);
  if (!Number.isFinite(parsedHours) || !Number.isFinite(parsedMinutes)) {
    return 0;
  }
  return parsedHours + parsedMinutes / 60;
}

export function formatHour(hour: number): string {
  const whole = Math.floor(hour);
  const minutes = Math.round((hour - whole) * 60);
  const period = whole < 12 ? 'AM' : 'PM';
  const display = whole % 12 === 0 ? 12 : whole % 12;

  return `${display}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function formatTime(time: string): string {
  return formatHour(timeToHours(time));
}

/**
 * Map a schedule slot to whole CSS grid rows.
 *
 * CSS grid lines are hour boundaries, so half-hour starts are rounded down to
 * the containing hour and the span is measured in whole hours. This keeps
 * manually entered 07:30 classes from producing invalid fractional row lines.
 */
export function placementFor(
  slot: TimetableSlot,
  startHour = TIMETABLE_START_HOUR
): TimetablePlacement {
  const start = timeToHours(slot.start_time);
  const end = slot.end_time ? timeToHours(slot.end_time) : start + 2;
  const safeEnd = Math.max(end, start);

  const startRow = Math.max(2, Math.floor(start - startHour) + 2);
  const durationHours = Math.max(0.5, safeEnd - start);
  const rowSpan = Math.max(1, Math.ceil(durationHours - 1e-9));
  const endRow = startRow + rowSpan;
  const dayColumn = Math.min(
    TIMETABLE_DAY_COUNT + 1,
    Math.max(2, Math.floor(slot.day) + 2)
  );

  return {
    dayColumn,
    startRow,
    endRow,
    rowSpan,
    startHour: start,
    endHour: safeEnd,
    durationHours,
    isCompact: durationHours <= 1,
    timeLabel: slot.end_time
      ? `${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}`
      : formatTime(slot.start_time),
  };
}
