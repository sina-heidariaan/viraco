/**
 * Persian display formats (plan §8.1). Values stay ISO / Latin digits everywhere else;
 * these functions are only for what the user reads. Nothing here reads the clock, so
 * the output depends only on the input and never differs between renders.
 */

// A due date is a calendar day with no time zone; formatting it as UTC midnight keeps the
// day from shifting in time zones west of UTC.
const DAY = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

const DATE_TIME = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const NUMBER = new Intl.NumberFormat('fa-IR');

/** `2026-10-11` → `۱۹ مهر ۱۴۰۵`. Returns the input unchanged if it is not yyyy-mm-dd. */
export function formatDay(isoDay: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay);
  if (!match) return isoDay;
  const [, y, m, d] = match;
  return DAY.format(new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))));
}

/** An ISO timestamp in the viewer's time zone, Jalali calendar. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DATE_TIME.format(date);
}

/** `12` → `۱۲`. */
export function formatNumber(value: number): string {
  return NUMBER.format(value);
}
