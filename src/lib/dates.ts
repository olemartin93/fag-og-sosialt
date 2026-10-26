import type { IsoDate } from './types';

export const TIME_ZONE = 'Europe/Oslo';
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): boolean {
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return toIso(d) === value;
}

function toIso(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

/** Calendar date as a UTC-midnight Date (safe for date arithmetic). */
export function parseIso(date: IsoDate): Date {
  const m = ISO_RE.exec(date);
  if (!m) throw new Error(`Invalid ISO date: ${date}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** Today's date in Norway, regardless of the device's time zone. */
export function osloToday(now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = parseIso(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

/** ISO weekday: 1 = Monday … 7 = Sunday */
export function isoWeekday(date: IsoDate): number {
  const day = parseIso(date).getUTCDay();
  return day === 0 ? 7 : day;
}

export function isFriday(date: IsoDate): boolean {
  return isoWeekday(date) === 5;
}

/** The first Friday on or after `date`. */
export function nextFriday(date: IsoDate): IsoDate {
  return addDays(date, (5 - isoWeekday(date) + 7) % 7);
}

/** The latest Friday on or before `date`. */
export function previousFriday(date: IsoDate): IsoDate {
  return addDays(date, -((isoWeekday(date) - 5 + 7) % 7));
}

export function fridaysInMonth(year: number, month0: number): IsoDate[] {
  const first = toIso(new Date(Date.UTC(year, month0, 1)));
  const result: IsoDate[] = [];
  for (let d = nextFriday(first); parseIso(d).getUTCMonth() === month0; d = addDays(d, 7)) {
    result.push(d);
  }
  return result;
}

/** Monday-first weeks covering the month; days outside the month are included. */
export function monthGrid(year: number, month0: number): IsoDate[][] {
  const first = toIso(new Date(Date.UTC(year, month0, 1)));
  let cursor = addDays(first, -(isoWeekday(first) - 1));
  const weeks: IsoDate[][] = [];
  do {
    const week: IsoDate[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  } while (parseIso(cursor).getUTCMonth() === month0);
  return weeks;
}

export function monthKey(date: IsoDate): { year: number; month0: number } {
  const d = parseIso(date);
  return { year: d.getUTCFullYear(), month0: d.getUTCMonth() };
}

export function startOfMonth(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: IsoDate): IsoDate {
  const { year, month0 } = monthKey(date);
  return toIso(new Date(Date.UTC(year, month0 + 1, 0)));
}

export type Locale = 'nb' | 'en';
const intlLocale = (l: Locale) => (l === 'nb' ? 'nb-NO' : 'en-GB');

function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}

/** «Fredag 23. oktober 2026» */
export function formatLongDate(date: IsoDate, locale: Locale = 'nb'): string {
  return capitalize(
    new Intl.DateTimeFormat(intlLocale(locale), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(parseIso(date)),
  );
}

/** «23. okt. 2026» */
export function formatShortDate(date: IsoDate, locale: Locale = 'nb', withYear = true): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(parseIso(date));
}

/** «Oktober 2026» */
export function formatMonth(year: number, month0: number, locale: Locale = 'nb'): string {
  return capitalize(
    new Intl.DateTimeFormat(intlLocale(locale), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(Date.UTC(year, month0, 1)),
    ),
  );
}

export function weekdayNames(locale: Locale = 'nb'): string[] {
  // 2024-01-01 is a Monday
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(intlLocale(locale), { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2024, 0, 1 + i)),
    ),
  );
}

export function formatDateTime(iso: string, locale: Locale = 'nb'): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

/** Offset (ms) between Oslo wall time and UTC at the given instant. */
function osloOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - instant.getTime();
}

/** Convert an Oslo wall-clock date + time ("14:00") to an absolute instant. */
export function osloDateTimeToInstant(date: IsoDate, time: string | null): Date {
  const [h = 0, m = 0] = (time ?? '00:00').split(':').map(Number);
  const d = parseIso(date);
  const guess = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m);
  const first = guess - osloOffsetMs(new Date(guess));
  // second pass handles DST transitions
  return new Date(guess - osloOffsetMs(new Date(first)));
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  isPast: boolean;
}

export function countdownTo(target: Date, now: Date = new Date()): Countdown {
  const diff = target.getTime() - now.getTime();
  const abs = Math.max(0, diff);
  const totalMinutes = Math.floor(abs / 60000);
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
    isPast: diff <= 0,
  };
}

/** "14:00:00" → "14:00" */
export function formatTime(time: string | null): string | null {
  return time ? time.slice(0, 5) : null;
}
