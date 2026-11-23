// utils/timeMapping.ts

export const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export type DayName = (typeof DAYS)[number];

const START_HOUR = 7;   // 07:00

export function timeToHour(timeStr: string): number {
  return Number(timeStr.split(':')[0]);
}

/**
 * Given start/end times ("HH:MM"), returns CSS Grid row start/end.
 * Row 1 = header, rows 2+ = hours 7am–8pm (14 rows).
 */
export function gridRowsForRange(startTime: string, endTime: string) {
  const startHour = timeToHour(startTime);
  const endHour = timeToHour(endTime);

  const rowStart = startHour - START_HOUR + 2;
  const rowEnd = endHour - START_HOUR + 2;

  return {
    gridRowStart: Math.max(2, rowStart),
    gridRowEnd: Math.max(3, rowEnd),
    rowSpan: Math.max(1, rowEnd - rowStart),
  };
}

/**
 * Compact time display: "7–10am", "10am–12pm", "10am–1pm", "2–3pm".
 */
export function formatCompactTime(start: string | null, end: string | null): string {
  if (!start || !end) return '–';
  const startHour = timeToHour(start);
  const endHour = timeToHour(end);
  const startPeriod = startHour < 12 ? 'am' : 'pm';
  const endPeriod = endHour < 12 ? 'am' : 'pm';
  const startDisplay = startHour % 12 === 0 ? 12 : startHour % 12;
  const endDisplay = endHour % 12 === 0 ? 12 : endHour % 12;
  if (startPeriod === endPeriod) {
    return `${startDisplay}–${endDisplay}${startPeriod}`;
  }
  return `${startDisplay}${startPeriod}–${endDisplay}${endPeriod}`;
}

export function modeStyle(mode: string | null) {
  const m = (mode || '').toLowerCase();
  const isSync = m === 'synchronous' || m === 'sync';
  const isLab = m === 'laboratory' || m === 'lab';
  const isAsync = m === 'asynchronous' || m === 'async';

  if (isSync) {
    return {
      cardBg: 'bg-apple-green-50',
      cardBorder: 'border-emerald-300',
      cardBorderL: 'border-l-4 border-l-emerald-600',
      titleText: 'text-emerald-950',
      pillBg: 'bg-emerald-100',
      pillText: 'text-emerald-800',
      pillBorder: 'border-emerald-300',
    };
  }
  if (isLab) {
    return {
      cardBg: 'bg-amber-50',
      cardBorder: 'border-amber-300',
      cardBorderL: 'border-l-4 border-l-amber-500',
      titleText: 'text-amber-950',
      pillBg: 'bg-amber-100',
      pillText: 'text-amber-800',
      pillBorder: 'border-amber-300',
    };
  }
  if (isAsync) {
    return {
      cardBg: 'bg-indigo-50',
      cardBorder: 'border-indigo-300',
      cardBorderL: 'border-l-4 border-l-indigo-500',
      titleText: 'text-indigo-950',
      pillBg: 'bg-indigo-100',
      pillText: 'text-indigo-800',
      pillBorder: 'border-indigo-300',
    };
  }
  return {
    cardBg: 'bg-surface-secondary',
    cardBorder: 'border-border',
    cardBorderL: 'border-l-4 border-l-border',
    titleText: 'text-text-primary',
    pillBg: 'bg-surface-tertiary',
    pillText: 'text-text-tertiary',
    pillBorder: 'border-border',
  };
}
