import { describe, expect, it } from 'vitest';
import {
  addDays,
  countdownTo,
  endOfMonth,
  formatLongDate,
  fridaysInMonth,
  isFriday,
  isIsoDate,
  monthGrid,
  nextFriday,
  osloDateTimeToInstant,
  osloToday,
  previousFriday,
} from '../dates';

describe('dates', () => {
  it('validates ISO dates strictly', () => {
    expect(isIsoDate('2026-10-23')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('23.10.2026')).toBe(false);
  });

  it('uses Norwegian time for "today"', () => {
    // 23:30 UTC on 23 Oct is already 24 Oct in Oslo (UTC+2 in summer time)
    expect(osloToday(new Date('2026-10-23T23:30:00Z'))).toBe('2026-10-24');
    // 22:30 UTC on 1 Dec is 23:30 in Oslo (UTC+1) – still the same day
    expect(osloToday(new Date('2026-12-01T22:30:00Z'))).toBe('2026-12-01');
  });

  it('finds Fridays', () => {
    expect(isFriday('2026-10-23')).toBe(true);
    expect(isFriday('2026-10-26')).toBe(false);
    expect(nextFriday('2026-10-26')).toBe('2026-10-30');
    expect(nextFriday('2026-10-30')).toBe('2026-10-30');
    expect(previousFriday('2026-10-26')).toBe('2026-10-23');
    expect(previousFriday('2026-10-23')).toBe('2026-10-23');
    expect(fridaysInMonth(2026, 9)).toEqual(['2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30']);
  });

  it('does date arithmetic across months and years', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
  });

  it('builds Monday-first month grids', () => {
    const weeks = monthGrid(2026, 9);
    expect(weeks[0]?.[0]).toBe('2026-09-28');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat()).toContain('2026-10-31');
  });

  it('formats dates in Norwegian', () => {
    expect(formatLongDate('2026-10-23')).toBe('Fredag 23. oktober 2026');
    expect(formatLongDate('2026-10-30', 'en')).toBe('Friday, 30 October 2026');
  });

  it('converts Oslo wall time to an instant, including DST', () => {
    expect(osloDateTimeToInstant('2026-10-23', '14:00').toISOString()).toBe('2026-10-23T12:00:00.000Z');
    expect(osloDateTimeToInstant('2026-11-06', '14:00').toISOString()).toBe('2026-11-06T13:00:00.000Z');
  });

  it('counts down to a meeting', () => {
    const target = new Date('2026-10-30T12:00:00Z');
    expect(countdownTo(target, new Date('2026-10-26T08:57:00Z'))).toEqual({ days: 4, hours: 3, minutes: 3, isPast: false });
    expect(countdownTo(target, new Date('2026-10-30T12:05:00Z')).isPast).toBe(true);
  });
});
