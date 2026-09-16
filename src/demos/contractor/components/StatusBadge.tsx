import { Badge, type BadgeTone } from './AppUI';
import type {
  EstimateStatus,
  InvoiceStatus,
  JobPriority,
  JobStatus,
  LeadStage,
} from '../contractor.types';

/**
 * Status presentation, in one place.
 *
 * Every status in the product maps to a tone here rather than at the call
 * site, so the same stage always looks the same whether it appears in a table,
 * on a detail header or inside the schedule. The label is always the status
 * text itself — colour reinforces it, never replaces it.
 */

const leadTones: Record<LeadStage, BadgeTone> = {
  New: 'info',
  Contacted: 'info',
  Qualified: 'active',
  'Estimate Needed': 'warning',
  'Estimate Sent': 'warning',
  Won: 'success',
  Lost: 'neutral',
};

const estimateTones: Record<EstimateStatus, BadgeTone> = {
  Draft: 'neutral',
  Sent: 'info',
  Viewed: 'active',
  Accepted: 'success',
  Declined: 'danger',
  Expired: 'neutral',
};

const jobTones: Record<JobStatus, BadgeTone> = {
  Unscheduled: 'neutral',
  Scheduled: 'info',
  'In Progress': 'active',
  'On Hold': 'warning',
  Completed: 'success',
  Cancelled: 'neutral',
};

const invoiceTones: Record<InvoiceStatus, BadgeTone> = {
  Draft: 'neutral',
  Sent: 'info',
  Partial: 'warning',
  Paid: 'success',
  Overdue: 'danger',
  Void: 'neutral',
};

const priorityTones: Record<JobPriority, BadgeTone> = {
  Low: 'neutral',
  Normal: 'neutral',
  High: 'warning',
  Urgent: 'danger',
};

export const LeadStageBadge = ({ stage }: { stage: LeadStage }) => (
  <Badge tone={leadTones[stage]}>{stage}</Badge>
);

export const EstimateStatusBadge = ({ status }: { status: EstimateStatus }) => (
  <Badge tone={estimateTones[status]}>{status}</Badge>
);

export const JobStatusBadge = ({ status }: { status: JobStatus }) => (
  <Badge tone={jobTones[status]}>{status}</Badge>
);

export const InvoiceStatusBadge = ({ status }: { status: InvoiceStatus }) => (
  <Badge tone={invoiceTones[status]}>{status}</Badge>
);

/** Normal priority is the default and carries no signal, so it is not shown. */
export function PriorityBadge({ priority }: { priority: JobPriority }) {
  if (priority === 'Normal') return null;
  return <Badge tone={priorityTones[priority]}>{priority}</Badge>;
}

/** Status colours for schedule blocks, where a badge would not fit. */
export const jobAccent: Record<JobStatus, string> = {
  Unscheduled: 'border-l-app-border-strong',
  Scheduled: 'border-l-info',
  'In Progress': 'border-l-copper',
  'On Hold': 'border-l-warning',
  Completed: 'border-l-success',
  Cancelled: 'border-l-muted',
};
