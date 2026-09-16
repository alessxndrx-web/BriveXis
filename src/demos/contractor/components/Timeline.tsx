import type { ActivityEvent, ActivityKind } from '../contractor.types';
import { formatDateTime, formatRelativeDay } from '../contractor.utils';
import { useWorkspace } from '../ContractorProvider';
import { getUser } from '../contractor.selectors';
import { EmptyState } from './AppUI';

/**
 * Activity timeline.
 *
 * Reads the shared activity log, so the same component serves a lead, a job,
 * an invoice and the dashboard. Every entry here was produced by something
 * that actually happened to the data — seeded history and a visitor's own
 * actions are the same kind of record.
 */

/** Marker colour by event family. Position and text carry the meaning; this is reinforcement. */
const markerTone: Partial<Record<ActivityKind, string>> = {
  'estimate.accepted': 'bg-success',
  'job.completed': 'bg-success',
  'payment.recorded': 'bg-success',
  'estimate.declined': 'bg-danger',
  'job.cancelled': 'bg-danger',
  'invoice.void': 'bg-danger',
  'job.hold': 'bg-warning',
  'job.started': 'bg-copper',
  'field.added': 'bg-copper',
};

interface TimelineProps {
  events: ActivityEvent[];
  emptyMessage?: string;
  className?: string;
}

export function Timeline({ events, emptyMessage, className = '' }: TimelineProps) {
  const state = useWorkspace();

  if (events.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        description={emptyMessage ?? 'Actions taken on this record will appear here.'}
      />
    );
  }

  return (
    <ol className={`relative ${className}`}>
      <span
        aria-hidden="true"
        className="absolute left-[3px] top-2 bottom-2 w-px bg-app-border"
      />
      {events.map((event) => {
        const actor = getUser(state, event.actorId);
        return (
          <li key={event.id} className="relative pl-5 py-2.5">
            <span
              aria-hidden="true"
              className={`absolute left-0 top-[1.05rem] w-[7px] h-[7px] rounded-full ring-2 ring-app-panel ${
                markerTone[event.kind] ?? 'bg-app-border-strong'
              }`}
            />
            <p className="text-[0.875rem] text-charcoal leading-snug">{event.summary}</p>
            <p className="mt-0.5 text-[0.75rem] text-muted">
              <time dateTime={event.at} title={formatDateTime(event.at)}>
                {formatRelativeDay(event.at)}
              </time>
              {actor && <> · {actor.name}</>}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
