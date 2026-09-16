import type { Address, Cents, DateOnly, Timestamp } from './types';

/**
 * Formatting, money and date helpers shared by the demo applications.
 *
 * Everything here is U.S.-localized on purpose — the demos represent U.S.
 * businesses, so currency, dates, phone numbers and addresses follow U.S.
 * conventions regardless of the visitor's own locale.
 */

// ---------------------------------------------------------------------- money

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const currencyWhole = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function formatMoney(cents: Cents): string {
  return currency.format(cents / 100);
}

/** Compact form for dashboard tiles, where cents are noise. */
export function formatMoneyWhole(cents: Cents): string {
  return currencyWhole.format(Math.round(cents / 100));
}

export function dollarsToCents(value: string | number): Cents {
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100);
}

export function centsToDollars(cents: Cents): number {
  return cents / 100;
}

/** Plain decimal string for number inputs — no symbol, no thousands separator. */
export function centsToInput(cents: Cents): string {
  return (cents / 100).toFixed(2);
}

/**
 * Percentage of a cent amount, rounded to the nearest cent.
 * Used for tax so the same rounding rule applies everywhere.
 */
export function percentOf(cents: Cents, rate: number): Cents {
  return Math.round((cents * rate) / 100);
}

// ---------------------------------------------------------------------- dates

/** Local calendar date as `YYYY-MM-DD`, avoiding the UTC shift of toISOString. */
export function toDateOnly(date: Date): DateOnly {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parses `YYYY-MM-DD` as a local date. `new Date(string)` would parse it as UTC. */
export function parseDateOnly(value: DateOnly): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function parseAny(value: DateOnly | Timestamp): Date {
  return value.length === 10 ? parseDateOnly(value) : new Date(value);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Day offset from a reference date, as a calendar date. Keeps seeds deterministic. */
export function dayOffset(reference: Date, days: number): DateOnly {
  return toDateOnly(addDays(reference, days));
}

/** Day offset with a wall-clock time, as a full timestamp. */
export function timeOffset(reference: Date, days: number, hour: number, minute = 0): Timestamp {
  const next = addDays(reference, days);
  next.setHours(hour, minute, 0, 0);
  return next.toISOString();
}

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

/** Monday-based start of week, matching how contractors schedule. */
export function startOfWeek(date: Date): Date {
  const next = startOfDay(date);
  const weekday = (next.getDay() + 6) % 7;
  return addDays(next, -weekday);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Whole days from `a` to `b`, ignoring time of day. */
export function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS_PER_DAY);
}

const dateShort = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const dateNumeric = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
});
const weekdayShort = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const timeShort = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

/** e.g. "Mar 4, 2026". */
export function formatDate(value?: DateOnly | Timestamp): string {
  if (!value) return '—';
  return dateShort.format(parseAny(value));
}

/** e.g. "03/04/2026", for dense table columns. */
export function formatDateNumeric(value?: DateOnly | Timestamp): string {
  if (!value) return '—';
  return dateNumeric.format(parseAny(value));
}

/** e.g. "Wed, Mar 4". */
export function formatWeekday(value: DateOnly | Timestamp): string {
  return weekdayShort.format(parseAny(value));
}

/** e.g. "8:00 AM". */
export function formatTime(value: Timestamp): string {
  return timeShort.format(new Date(value));
}

export function formatDateTime(value?: Timestamp): string {
  if (!value) return '—';
  const date = new Date(value);
  return `${dateShort.format(date)} · ${timeShort.format(date)}`;
}

/** "3 days ago" / "in 4 days" / "Today". Used on timelines and follow-up lists. */
export function formatRelativeDay(value: DateOnly | Timestamp, now = new Date()): string {
  const delta = daysBetween(now, parseAny(value));
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Tomorrow';
  if (delta === -1) return 'Yesterday';
  if (delta < 0) return `${Math.abs(delta)} days ago`;
  return `in ${delta} days`;
}

/** `YYYY-MM-DDTHH:mm` for datetime-local inputs, in local time. */
export function toDateTimeInput(value?: Timestamp): string {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function fromDateTimeInput(value: string): Timestamp | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

// ------------------------------------------------------------------ contact

/** Formats 10 digits as (555) 123-4567; anything else is returned untouched. */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 10) return value;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function formatAddress(address: Address): string {
  const street = address.line2 ? `${address.line1}, ${address.line2}` : address.line1;
  return `${street}, ${address.city}, ${address.state} ${address.zip}`;
}

/** Street line only, for dense table cells. */
export function formatAddressShort(address: Address): string {
  return `${address.line1}, ${address.city}, ${address.state}`;
}

// ------------------------------------------------------------- identifiers

let internalIdSequence = 0;

/**
 * Opaque internal id. Never shown as a record's identity in the UI — records
 * are identified there by their readable code (LD-1024, STK-2031).
 */
export function createId(prefix = 'id'): string {
  internalIdSequence += 1;
  return `${prefix}_${Date.now().toString(36)}_${internalIdSequence.toString(36)}`;
}

/**
 * Readable document numbers.
 *
 * Each demo supplies its own prefixes and keeps its own counters in state, so
 * the numbers a visitor sees behave the way real document numbers do:
 * incremental, never reused, never random.
 */
export function makeCodeFactory<K extends string>(prefixes: Record<K, string>) {
  return {
    format(kind: K, sequence: number): string {
      return `${prefixes[kind]}-${sequence}`;
    },
    next(counters: Record<K, number>, kind: K): { code: string; counters: Record<K, number> } {
      const sequence = counters[kind];
      return {
        code: `${prefixes[kind]}-${sequence}`,
        counters: { ...counters, [kind]: sequence + 1 },
      };
    },
  };
}

// ------------------------------------------------------------------- misc

export function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Case-insensitive "does this record match the query" test. */
export function matches(query: string, ...fields: (string | undefined)[]): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => field?.toLowerCase().includes(needle));
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Clamps a value into a range, used by progress bars and workload meters. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Sums a money column without leaving integer arithmetic. */
export function sumCents(values: Cents[]): Cents {
  return values.reduce((total, value) => total + value, 0);
}
