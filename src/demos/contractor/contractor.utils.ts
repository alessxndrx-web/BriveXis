import type { Counters } from './contractor.types';
import type { Timestamp } from '../shared/types';
import { makeCodeFactory } from '../shared/format';

/**
 * Contractor formatting helpers.
 *
 * Money, dates, phones and addresses are shared with the other demos; only the
 * document numbering and the job scheduling window are specific to this one.
 */
export * from '../shared/format';

const CODE_PREFIX = {
  lead: 'LD',
  customer: 'CUS',
  location: 'LOC',
  estimate: 'EST',
  job: 'JOB',
  invoice: 'INV',
  payment: 'PAY',
  field: 'FR',
  followUp: 'TSK',
} as const;

export type CodeKind = keyof typeof CODE_PREFIX;

const codes = makeCodeFactory<CodeKind>(CODE_PREFIX);

export function formatCode(kind: CodeKind, sequence: number): string {
  return codes.format(kind, sequence);
}

/**
 * Takes the next readable code for a kind and returns the advanced counters.
 * Sequences are incremental rather than random so the numbers a visitor sees
 * behave the way real document numbers do.
 */
export function nextCode(
  counters: Counters,
  kind: CodeKind,
): { code: string; counters: Counters } {
  return codes.next(counters, kind) as { code: string; counters: Counters };
}

const windowDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const windowTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

/**
 * Scheduled window for a job.
 *
 * Contractor work is often multi-day — a remodel runs for a fortnight — so a
 * window that ends on a different date has to say so. Rendering only the start
 * date with a time range would show a two-week job as a single shift.
 */
export function formatScheduleWindow(start?: Timestamp, end?: Timestamp): string {
  if (!start) return '—';
  const from = new Date(start);
  if (!end) return `${windowDate.format(from)} · ${windowTime.format(from)}`;

  const to = new Date(end);
  const sameDay = windowDate.format(from) === windowDate.format(to);

  return sameDay
    ? `${windowDate.format(from)} · ${windowTime.format(from)} – ${windowTime.format(to)}`
    : `${windowDate.format(from)}, ${windowTime.format(from)} – ${windowDate.format(to)}, ${windowTime.format(to)}`;
}
