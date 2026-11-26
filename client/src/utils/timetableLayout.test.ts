import { describe, expect, it } from 'vitest';
import {
  formatTime,
  placementFor,
  timeToHours,
} from './timetableLayout';

describe('placementFor', () => {
  it('places a one-hour block in a single row', () => {
    const placement = placementFor({
      day: 0,
      start_time: '07:00',
      end_time: '08:00',
    });

    expect(placement).toMatchObject({
      dayColumn: 2,
      startRow: 2,
      endRow: 3,
      rowSpan: 1,
      isCompact: true,
    });
    expect(placement.timeLabel).toBe('7:00 AM – 8:00 AM');
  });

  it('spans a two-hour block across two rows', () => {
    const placement = placementFor({
      day: 1,
      start_time: '09:00',
      end_time: '11:00',
    });

    expect(placement).toMatchObject({
      dayColumn: 3,
      startRow: 4,
      endRow: 6,
      rowSpan: 2,
      isCompact: false,
    });
  });

  it('defaults to a two-hour block when end_time is null', () => {
    const placement = placementFor({
      day: 3,
      start_time: '13:00',
      end_time: null,
    });

    expect(placement.rowSpan).toBe(2);
    expect(placement.isCompact).toBe(false);
    expect(placement.timeLabel).toBe('1:00 PM');
  });

  it('rounds half-hour starts down to a whole grid row', () => {
    const placement = placementFor({
      day: 2,
      start_time: '07:30',
      end_time: '08:30',
    });

    expect(placement.startRow).toBe(2);
    expect(placement.rowSpan).toBe(1);
    expect(placement.dayColumn).toBe(4);
  });

  it('clamps columns to the six-day grid', () => {
    expect(
      placementFor({ day: -1, start_time: '07:00', end_time: '08:00' })
        .dayColumn
    ).toBe(2);
    expect(
      placementFor({ day: 9, start_time: '07:00', end_time: '08:00' })
        .dayColumn
    ).toBe(7);
  });
});

describe('time helpers', () => {
  it('parses hours and minutes', () => {
    expect(timeToHours('07:30')).toBe(7.5);
    expect(timeToHours('13:00')).toBe(13);
  });

  it('formats morning, noon, and evening times', () => {
    expect(formatTime('07:00')).toBe('7:00 AM');
    expect(formatTime('12:00')).toBe('12:00 PM');
    expect(formatTime('13:00')).toBe('1:00 PM');
  });
});
