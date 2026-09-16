import {
  Banknote,
  Car,
  CheckCircle2,
  CircleDot,
  FileText,
  Handshake,
  Landmark,
  ListChecks,
  Tag,
  UserPlus,
} from 'lucide-react';
import type { ActivityEvent, ActivityKind } from '../dealer.types';
import { formatDateTime, formatRelativeDay } from '../dealer.utils';
import { useWorkspace } from '../DealerProvider';
import { getSalesperson } from '../dealer.selectors';
import { EmptyState } from '../../shared/ui/AppUI';

/**
 * Activity history.
 *
 * Events are produced by the reducer as work happens, so this is a record of
 * what was actually done in the workspace rather than a decorative feed. The
 * icon repeats what the text already says; it is never the only signal.
 */

const ICONS: Record<ActivityKind, typeof CircleDot> = {
  'lead.created': UserPlus,
  'lead.stage': CircleDot,
  'lead.converted': UserPlus,
  'vehicle.created': Car,
  'vehicle.status': Tag,
  'vehicle.interest': Car,
  'reservation.created': Tag,
  'reservation.confirmed': CheckCircle2,
  'reservation.cancelled': CircleDot,
  'reservation.converted': Handshake,
  'deal.created': Handshake,
  'deal.updated': Handshake,
  'deal.status': CircleDot,
  'deal.closed': CheckCircle2,
  'financing.created': Landmark,
  'financing.status': Landmark,
  'payment.recorded': Banknote,
  'document.updated': FileText,
  'delivery.completed': CheckCircle2,
  'task.created': ListChecks,
  'task.completed': CheckCircle2,
};

interface TimelineProps {
  events: ActivityEvent[];
  emptyMessage?: string;
  className?: string;
  /** Caps a long history on a busy record. */
  limit?: number;
}

export function Timeline({ events, emptyMessage, className = '', limit }: TimelineProps) {
  const state = useWorkspace();
  const shown = limit ? events.slice(0, limit) : events;

  if (shown.length === 0) {
    return (
      <EmptyState
        title="Nothing recorded yet"
        description={emptyMessage ?? 'Activity appears here as work happens on this record.'}
      />
    );
  }

  return (
    <ol className={`relative ${className}`}>
      {shown.map((event, index) => {
        const Icon = ICONS[event.kind] ?? CircleDot;
        const actor = getSalesperson(state, event.actorId);
        const last = index === shown.length - 1;

        return (
          <li key={event.id} className="relative flex gap-3 pl-0">
            <div className="relative flex flex-col items-center">
              <span className="flex items-center justify-center w-6 h-6 shrink-0 rounded-full border border-app-border bg-app-panel">
                <Icon size={12} strokeWidth={1.9} aria-hidden="true" className="text-copper" />
              </span>
              {!last && <span aria-hidden="true" className="flex-1 w-px bg-app-border my-1" />}
            </div>

            <div className={`min-w-0 flex-1 ${last ? 'pb-0' : 'pb-4'}`}>
              <p className="text-[0.875rem] leading-snug text-charcoal">{event.message}</p>
              <p className="mt-0.5 text-[0.75rem] text-muted">
                <time dateTime={event.at}>{formatDateTime(event.at)}</time>
                <span className="mx-1.5" aria-hidden="true">
                  ·
                </span>
                {formatRelativeDay(event.at)}
                {actor && (
                  <>
                    <span className="mx-1.5" aria-hidden="true">
                      ·
                    </span>
                    {actor.name}
                  </>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
