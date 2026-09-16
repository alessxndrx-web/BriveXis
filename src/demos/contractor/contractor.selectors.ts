import type {
  ActivityEvent,
  Cents,
  ContractorState,
  Crew,
  Customer,
  DemoRole,
  Estimate,
  EntityKind,
  FieldRecord,
  FollowUp,
  Id,
  Invoice,
  InvoiceStatus,
  Job,
  Lead,
  LeadStage,
  LineItem,
  Payment,
  ServiceLocation,
} from './contractor.types';
import {
  addDays,
  daysBetween,
  isSameDay,
  matches,
  parseAny,
  parseDateOnly,
  percentOf,
  startOfDay,
  startOfWeek,
} from './contractor.utils';

/**
 * Derived reads over the workspace.
 *
 * Nothing that can be computed is stored. An invoice does not carry a balance
 * field, a job does not carry a total, a customer does not carry a revenue
 * figure — they are all derived here. That is what keeps a badge from ever
 * disagreeing with the records behind it, no matter what a visitor edits.
 */

// ------------------------------------------------------------ money totals

export function lineTotal(item: LineItem): Cents {
  return Math.round(item.quantity * item.unitPrice);
}

export interface DocumentTotals {
  subtotal: Cents;
  discount: Cents;
  taxable: Cents;
  tax: Cents;
  total: Cents;
}

/**
 * Totals for an estimate or an invoice. Both use the same shape, so the same
 * arithmetic and the same rounding rule apply to a quote and to the bill that
 * follows it — the customer never sees the two disagree by a cent.
 */
export function documentTotals(document: {
  items: LineItem[];
  taxRate: number;
  discount: Cents;
}): DocumentTotals {
  const subtotal = document.items.reduce((sum, item) => sum + lineTotal(item), 0);
  const discount = Math.min(document.discount, subtotal);
  const taxable = subtotal - discount;
  const tax = percentOf(taxable, document.taxRate);
  return { subtotal, discount, taxable, tax, total: taxable + tax };
}

export const estimateTotal = (estimate: Estimate): Cents => documentTotals(estimate).total;
export const invoiceTotal = (invoice: Invoice): Cents => documentTotals(invoice).total;

// --------------------------------------------------------- invoice status

export function invoicePayments(state: ContractorState, invoiceId: Id): Payment[] {
  return state.payments
    .filter((payment) => payment.invoiceId === invoiceId)
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
}

export function invoicePaidAmount(state: ContractorState, invoiceId: Id): Cents {
  return state.payments
    .filter((payment) => payment.invoiceId === invoiceId)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

export function invoiceBalance(state: ContractorState, invoice: Invoice): Cents {
  if (invoice.status === 'Void') return 0;
  return invoiceTotal(invoice) - invoicePaidAmount(state, invoice.id);
}

/**
 * The status a visitor actually sees.
 *
 * Draft and Void are decisions someone made, so they are taken from the record.
 * Paid, Overdue and Partial are consequences of payments and the due date, so
 * they are computed — recording a payment cannot leave a stale badge behind.
 */
export function invoiceStatus(
  state: ContractorState,
  invoice: Invoice,
  now: Date = new Date(),
): InvoiceStatus {
  if (invoice.status === 'Draft' || invoice.status === 'Void') return invoice.status;

  const balance = invoiceBalance(state, invoice);
  if (balance <= 0) return 'Paid';

  const paid = invoicePaidAmount(state, invoice.id);
  if (parseDateOnly(invoice.dueAt) < startOfDay(now)) return 'Overdue';
  return paid > 0 ? 'Partial' : 'Sent';
}

export function isInvoiceOpen(state: ContractorState, invoice: Invoice, now?: Date): boolean {
  const status = invoiceStatus(state, invoice, now);
  return status !== 'Paid' && status !== 'Void' && status !== 'Draft';
}

// ------------------------------------------------------------ entity reads

const byId = <T extends { id: Id }>(items: T[], id?: Id): T | undefined =>
  id ? items.find((item) => item.id === id) : undefined;

export const getLead = (s: ContractorState, id?: Id) => byId(s.leads, id);
export const getCustomer = (s: ContractorState, id?: Id) => byId(s.customers, id);
export const getLocation = (s: ContractorState, id?: Id) => byId(s.locations, id);
export const getEstimate = (s: ContractorState, id?: Id) => byId(s.estimates, id);
export const getJob = (s: ContractorState, id?: Id) => byId(s.jobs, id);
export const getCrew = (s: ContractorState, id?: Id) => byId(s.crews, id);
export const getInvoice = (s: ContractorState, id?: Id) => byId(s.invoices, id);
export const getPayment = (s: ContractorState, id?: Id) => byId(s.payments, id);
export const getUser = (s: ContractorState, id?: Id) => byId(s.users, id);

export const getByCode = <T extends { code: string }>(items: T[], code: string) =>
  items.find((item) => item.code.toLowerCase() === code.toLowerCase());

export function customerLocations(state: ContractorState, customerId: Id): ServiceLocation[] {
  return state.locations.filter((location) => location.customerId === customerId);
}

export function crewMembers(state: ContractorState, crewId: Id) {
  return state.crewMembers.filter((member) => member.crewId === crewId);
}

export function jobFieldRecords(state: ContractorState, jobId: Id): FieldRecord[] {
  return state.fieldRecords
    .filter((record) => record.jobId === jobId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function estimateForLead(state: ContractorState, leadId: Id): Estimate | undefined {
  return state.estimates.find((estimate) => estimate.leadId === leadId);
}

export function jobForEstimate(state: ContractorState, estimateId: Id): Job | undefined {
  return state.jobs.find((job) => job.estimateId === estimateId);
}

export function invoicesForJob(state: ContractorState, jobId: Id): Invoice[] {
  return state.invoices.filter((invoice) => invoice.jobId === jobId);
}

export function customerJobs(state: ContractorState, customerId: Id): Job[] {
  return state.jobs
    .filter((job) => job.customerId === customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function customerEstimates(state: ContractorState, customerId: Id): Estimate[] {
  return state.estimates
    .filter((estimate) => estimate.customerId === customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function customerInvoices(state: ContractorState, customerId: Id): Invoice[] {
  return state.invoices
    .filter((invoice) => invoice.customerId === customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function customerPayments(state: ContractorState, customerId: Id): Payment[] {
  return state.payments
    .filter((payment) => payment.customerId === customerId)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

/** Total received from a customer, across every invoice. */
export function customerLifetimeValue(state: ContractorState, customerId: Id): Cents {
  return customerPayments(state, customerId).reduce((sum, payment) => sum + payment.amount, 0);
}

export function customerOpenBalance(state: ContractorState, customerId: Id, now?: Date): Cents {
  return customerInvoices(state, customerId)
    .filter((invoice) => isInvoiceOpen(state, invoice, now))
    .reduce((sum, invoice) => sum + invoiceBalance(state, invoice), 0);
}

// -------------------------------------------------------------- activity

/** Every event where a record is either the subject or a related party. */
export function activityFor(
  state: ContractorState,
  kind: EntityKind,
  id: Id,
  limit = 50,
): ActivityEvent[] {
  return state.activity
    .filter(
      (event) =>
        (event.subject.kind === kind && event.subject.id === id) ||
        event.related.some((ref) => ref.kind === kind && ref.id === id),
    )
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

export function recentActivity(state: ContractorState, limit = 12): ActivityEvent[] {
  return [...state.activity].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export function openFollowUps(state: ContractorState): FollowUp[] {
  return state.followUps
    .filter((task) => !task.done)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function followUpsFor(state: ContractorState, kind: EntityKind, id: Id): FollowUp[] {
  return state.followUps
    .filter((task) => task.relatesTo.kind === kind && task.relatesTo.id === id)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

// -------------------------------------------------------------- scheduling

export interface ScheduledJob {
  job: Job;
  start: Date;
  end: Date;
}

/** Jobs that carry a scheduled start, ordered chronologically. */
export function scheduledJobs(state: ContractorState): ScheduledJob[] {
  return state.jobs
    .filter((job): job is Job & { scheduledStart: string } => Boolean(job.scheduledStart))
    .filter((job) => job.status !== 'Cancelled')
    .map((job) => ({
      job,
      start: new Date(job.scheduledStart),
      end: new Date(job.scheduledEnd ?? job.scheduledStart),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Jobs occurring on a given day. A multi-day job appears on every day it spans,
 * which is how a scheduler has to read: a five-day re-roof is on site Wednesday
 * even though it started Monday.
 */
export function jobsOnDay(state: ContractorState, day: Date): ScheduledJob[] {
  const target = startOfDay(day);
  return scheduledJobs(state).filter(({ start, end }) => {
    const from = startOfDay(start);
    const to = startOfDay(end);
    return target >= from && target <= to;
  });
}

export function jobsInRange(state: ContractorState, from: Date, to: Date): ScheduledJob[] {
  const start = startOfDay(from);
  const end = startOfDay(to);
  return scheduledJobs(state).filter((entry) => {
    const jobStart = startOfDay(entry.start);
    const jobEnd = startOfDay(entry.end);
    return jobStart <= end && jobEnd >= start;
  });
}

export function weekDays(reference: Date): Date[] {
  const monday = startOfWeek(reference);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/**
 * Crew load for a week, expressed against the crew's stated capacity. Scheduled
 * hours are approximated from each job's booked window rather than invented.
 */
export interface CrewWorkload {
  crew: Crew;
  jobCount: number;
  scheduledHours: number;
  capacityHours: number;
  utilization: number;
}

export function crewWorkload(state: ContractorState, reference: Date = new Date()): CrewWorkload[] {
  const days = weekDays(reference);
  const from = days[0];
  const to = days[6];
  const window = jobsInRange(state, from, to);

  return state.crews.map((crew) => {
    const crewJobs = window.filter((entry) => entry.job.crewId === crew.id);
    const scheduledHours = crewJobs.reduce((sum, entry) => {
      const hours = (entry.end.getTime() - entry.start.getTime()) / 3_600_000;
      // A booking that spans days represents working days, not wall-clock hours.
      const spanDays = Math.max(1, daysBetween(entry.start, entry.end) + 1);
      return sum + Math.min(hours, spanDays * 8);
    }, 0);

    return {
      crew,
      jobCount: crewJobs.length,
      scheduledHours: Math.round(scheduledHours),
      capacityHours: crew.weeklyCapacityHours,
      utilization: crew.weeklyCapacityHours
        ? Math.round((scheduledHours / crew.weeklyCapacityHours) * 100)
        : 0,
    };
  });
}

export function crewJobs(state: ContractorState, crewId: Id): Job[] {
  return state.jobs
    .filter((job) => job.crewId === crewId && job.status !== 'Cancelled')
    .sort((a, b) => (a.scheduledStart ?? '').localeCompare(b.scheduledStart ?? ''));
}

// -------------------------------------------------------------- dashboard

export interface DashboardMetrics {
  openLeads: number;
  openLeadValue: Cents;
  estimatesAwaitingDecision: number;
  estimatesAwaitingValue: Cents;
  activeJobs: number;
  jobsScheduledThisWeek: number;
  outstandingInvoices: number;
  outstandingBalance: Cents;
  overdueInvoices: number;
  overdueBalance: Cents;
  paymentsThisMonth: Cents;
  paymentsThisMonthCount: number;
  followUpsDue: number;
}

const OPEN_LEAD_STAGES: LeadStage[] = [
  'New',
  'Contacted',
  'Qualified',
  'Estimate Needed',
  'Estimate Sent',
];

const AWAITING_DECISION = ['Sent', 'Viewed'] as const;

/** Every dashboard number, computed from current state. Nothing is hardcoded. */
export function dashboardMetrics(
  state: ContractorState,
  now: Date = new Date(),
): DashboardMetrics {
  const openLeads = state.leads.filter((lead) => OPEN_LEAD_STAGES.includes(lead.stage));

  const awaiting = state.estimates.filter((estimate) =>
    (AWAITING_DECISION as readonly string[]).includes(estimate.status),
  );

  const activeJobs = state.jobs.filter(
    (job) => job.status === 'Scheduled' || job.status === 'In Progress',
  );

  const days = weekDays(now);
  const thisWeek = jobsInRange(state, days[0], days[6]);

  const openInvoices = state.invoices.filter((invoice) => isInvoiceOpen(state, invoice, now));
  const overdue = openInvoices.filter((invoice) => invoiceStatus(state, invoice, now) === 'Overdue');

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthPayments = state.payments.filter(
    (payment) => parseDateOnly(payment.receivedAt) >= monthStart,
  );

  const today = startOfDay(now);
  const followUpsDue = state.followUps.filter(
    (task) => !task.done && parseDateOnly(task.dueAt) <= today,
  );

  return {
    openLeads: openLeads.length,
    openLeadValue: openLeads.reduce((sum, lead) => sum + lead.estimatedValue, 0),
    estimatesAwaitingDecision: awaiting.length,
    estimatesAwaitingValue: awaiting.reduce((sum, estimate) => sum + estimateTotal(estimate), 0),
    activeJobs: activeJobs.length,
    jobsScheduledThisWeek: thisWeek.length,
    outstandingInvoices: openInvoices.length,
    outstandingBalance: openInvoices.reduce(
      (sum, invoice) => sum + invoiceBalance(state, invoice),
      0,
    ),
    overdueInvoices: overdue.length,
    overdueBalance: overdue.reduce((sum, invoice) => sum + invoiceBalance(state, invoice), 0),
    paymentsThisMonth: monthPayments.reduce((sum, payment) => sum + payment.amount, 0),
    paymentsThisMonthCount: monthPayments.length,
    followUpsDue: followUpsDue.length,
  };
}

export function todaysJobs(state: ContractorState, now: Date = new Date()): ScheduledJob[] {
  return jobsOnDay(state, now);
}

export function upcomingJobs(
  state: ContractorState,
  now: Date = new Date(),
  limit = 6,
): ScheduledJob[] {
  const tomorrow = startOfDay(addDays(now, 1));
  return scheduledJobs(state)
    .filter((entry) => startOfDay(entry.start) >= tomorrow)
    .slice(0, limit);
}

// ---------------------------------------------------------------- reports

export interface Bucket {
  label: string;
  value: number;
  /** Optional money figure shown alongside the count. */
  amount?: Cents;
}

export function leadPipeline(state: ContractorState): Bucket[] {
  return OPEN_LEAD_STAGES.concat(['Won', 'Lost']).map((stage) => {
    const leads = state.leads.filter((lead) => lead.stage === stage);
    return {
      label: stage,
      value: leads.length,
      amount: leads.reduce((sum, lead) => sum + lead.estimatedValue, 0),
    };
  });
}

export function leadsBySource(state: ContractorState): Bucket[] {
  const counts = new Map<string, { value: number; amount: Cents }>();
  for (const lead of state.leads) {
    const entry = counts.get(lead.source) ?? { value: 0, amount: 0 };
    counts.set(lead.source, {
      value: entry.value + 1,
      amount: entry.amount + lead.estimatedValue,
    });
  }
  return [...counts.entries()]
    .map(([label, entry]) => ({ label, ...entry }))
    .sort((a, b) => b.value - a.value);
}

export interface EstimateAcceptance {
  accepted: number;
  declined: number;
  outstanding: number;
  expired: number;
  draft: number;
  /** Accepted as a share of decided estimates. Undefined when none have been decided. */
  acceptanceRate?: number;
  acceptedValue: Cents;
}

export function estimateAcceptance(state: ContractorState): EstimateAcceptance {
  const count = (status: string) =>
    state.estimates.filter((estimate) => estimate.status === status);

  const accepted = count('Accepted');
  const declined = count('Declined');
  const decided = accepted.length + declined.length;

  return {
    accepted: accepted.length,
    declined: declined.length,
    outstanding: count('Sent').length + count('Viewed').length,
    expired: count('Expired').length,
    draft: count('Draft').length,
    acceptanceRate: decided > 0 ? Math.round((accepted.length / decided) * 100) : undefined,
    acceptedValue: accepted.reduce((sum, estimate) => sum + estimateTotal(estimate), 0),
  };
}

export function jobsByStatus(state: ContractorState): Bucket[] {
  const statuses = ['Unscheduled', 'Scheduled', 'In Progress', 'On Hold', 'Completed', 'Cancelled'];
  return statuses
    .map((status) => ({
      label: status,
      value: state.jobs.filter((job) => job.status === status).length,
    }))
    .filter((bucket) => bucket.value > 0);
}

export interface AgingBucket extends Bucket {
  amount: Cents;
}

/** Standard receivable aging, computed from each open invoice's due date. */
export function invoiceAging(state: ContractorState, now: Date = new Date()): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { label: 'Not yet due', value: 0, amount: 0 },
    { label: '1–30 days', value: 0, amount: 0 },
    { label: '31–60 days', value: 0, amount: 0 },
    { label: '60+ days', value: 0, amount: 0 },
  ];

  for (const invoice of state.invoices) {
    if (!isInvoiceOpen(state, invoice, now)) continue;
    const overdueDays = daysBetween(parseDateOnly(invoice.dueAt), now);
    const balance = invoiceBalance(state, invoice);

    const index =
      overdueDays <= 0 ? 0 : overdueDays <= 30 ? 1 : overdueDays <= 60 ? 2 : 3;
    buckets[index].value += 1;
    buckets[index].amount += balance;
  }

  return buckets;
}

/** Payments grouped by calendar month, oldest first. */
export function paymentHistory(state: ContractorState, months = 6, now: Date = new Date()): Bucket[] {
  const result: Bucket[] = [];
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short' });

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
    const payments = state.payments.filter((payment) => {
      const received = parseDateOnly(payment.receivedAt);
      return received >= monthStart && received < monthEnd;
    });
    result.push({
      label: formatter.format(monthStart),
      value: payments.length,
      amount: payments.reduce((sum, payment) => sum + payment.amount, 0),
    });
  }

  return result;
}

export function jobsCompletedByMonth(state: ContractorState, months = 6, now: Date = new Date()): Bucket[] {
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
  const result: Bucket[] = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
    const completed = state.jobs.filter((job) => {
      if (!job.completedAt) return false;
      const at = new Date(job.completedAt);
      return at >= monthStart && at < monthEnd;
    });
    result.push({ label: formatter.format(monthStart), value: completed.length });
  }

  return result;
}

// ----------------------------------------------------------------- search

export type SearchKind = 'lead' | 'customer' | 'estimate' | 'job' | 'invoice';

export interface SearchResult {
  kind: SearchKind;
  id: Id;
  code: string;
  title: string;
  subtitle: string;
  href: string;
}

/**
 * Global search across the records a contractor actually looks up by name or
 * number. Ranked so an exact code match — the way people search for documents —
 * always comes first.
 */
export function searchWorkspace(
  state: ContractorState,
  query: string,
  basePath: string,
  limit = 12,
): SearchResult[] {
  const term = query.trim();
  if (term.length < 2) return [];

  const customerName = (id: Id) => getCustomer(state, id)?.name ?? 'Unknown customer';
  const results: SearchResult[] = [];

  for (const lead of state.leads) {
    if (matches(term, lead.code, lead.name, lead.contactName, lead.email, lead.serviceAddress.city)) {
      results.push({
        kind: 'lead', id: lead.id, code: lead.code, title: lead.name,
        subtitle: `${lead.contactName} · ${lead.stage}`, href: `${basePath}/leads/${lead.id}`,
      });
    }
  }

  for (const customer of state.customers) {
    if (matches(term, customer.code, customer.name, customer.company, customer.email, customer.phone)) {
      results.push({
        kind: 'customer', id: customer.id, code: customer.code, title: customer.name,
        subtitle: customer.company ?? customer.billingAddress.city,
        href: `${basePath}/customers/${customer.id}`,
      });
    }
  }

  for (const estimate of state.estimates) {
    if (matches(term, estimate.code, estimate.title, customerName(estimate.customerId))) {
      results.push({
        kind: 'estimate', id: estimate.id, code: estimate.code, title: estimate.title,
        subtitle: `${customerName(estimate.customerId)} · ${estimate.status}`,
        href: `${basePath}/estimates/${estimate.id}`,
      });
    }
  }

  for (const job of state.jobs) {
    if (matches(term, job.code, job.title, customerName(job.customerId))) {
      results.push({
        kind: 'job', id: job.id, code: job.code, title: job.title,
        subtitle: `${customerName(job.customerId)} · ${job.status}`,
        href: `${basePath}/jobs/${job.id}`,
      });
    }
  }

  for (const invoice of state.invoices) {
    if (matches(term, invoice.code, customerName(invoice.customerId))) {
      results.push({
        kind: 'invoice', id: invoice.id, code: invoice.code,
        title: `Invoice ${invoice.code}`,
        subtitle: `${customerName(invoice.customerId)} · ${invoiceStatus(state, invoice)}`,
        href: `${basePath}/invoices/${invoice.id}`,
      });
    }
  }

  const needle = term.toLowerCase();
  return results
    .sort((a, b) => {
      const exact = (result: SearchResult) => (result.code.toLowerCase() === needle ? 0 : 1);
      const prefix = (result: SearchResult) => (result.code.toLowerCase().startsWith(needle) ? 0 : 1);
      return exact(a) - exact(b) || prefix(a) - prefix(b) || a.title.localeCompare(b.title);
    })
    .slice(0, limit);
}

// ------------------------------------------------------------- demo roles

/**
 * Which modules each demo role can reach.
 *
 * This is a presentation filter for the demo, not authentication. Every role
 * sees a coherent subset — never a menu entry that leads to a blank screen.
 */
export const ROLE_MODULES: Record<DemoRole, string[]> = {
  owner: [
    'dashboard', 'leads', 'customers', 'estimates', 'jobs',
    'schedule', 'crews', 'invoices', 'payments', 'reports', 'settings',
  ],
  sales: ['dashboard', 'leads', 'customers', 'estimates', 'settings'],
  operations: ['dashboard', 'jobs', 'schedule', 'crews', 'customers', 'settings'],
  field: ['dashboard', 'jobs', 'schedule', 'settings'],
};

export function canAccess(role: DemoRole, moduleId: string): boolean {
  return ROLE_MODULES[role].includes(moduleId);
}

// ---------------------------------------------------- workflow guard rails

/**
 * A job may only be created from an estimate the customer has accepted.
 * Anything earlier would let the demo teach a workflow no contractor runs.
 */
export function canCreateJobFromEstimate(state: ContractorState, estimate: Estimate): boolean {
  return estimate.status === 'Accepted' && !jobForEstimate(state, estimate.id);
}

/** Invoicing follows completion; a job still in the field is not billable yet. */
export function canInvoiceJob(job: Job): boolean {
  return job.status === 'Completed';
}

export function jobProgressLabel(job: Job): string {
  switch (job.status) {
    case 'Unscheduled':
      return 'Awaiting scheduling';
    case 'Scheduled':
      return 'Scheduled, not started';
    case 'In Progress':
      return 'Crew on site';
    case 'On Hold':
      return 'Paused';
    case 'Completed':
      return 'Work complete';
    case 'Cancelled':
      return 'Cancelled';
  }
}

/** Jobs a field user would consider "mine today". */
export function fieldJobsForToday(state: ContractorState, now: Date = new Date()): ScheduledJob[] {
  return jobsOnDay(state, now).filter(
    (entry) => entry.job.status === 'Scheduled' || entry.job.status === 'In Progress',
  );
}

export function isToday(value: string, now: Date = new Date()): boolean {
  return isSameDay(parseAny(value), now);
}

/** True when a customer has a live job or an estimate still awaiting a decision. */
export function customerHasOpenWork(state: ContractorState, customer: Customer): boolean {
  return (
    state.jobs.some(
      (job) =>
        job.customerId === customer.id &&
        job.status !== 'Completed' &&
        job.status !== 'Cancelled',
    ) ||
    state.estimates.some(
      (estimate) =>
        estimate.customerId === customer.id &&
        (estimate.status === 'Sent' || estimate.status === 'Viewed'),
    )
  );
}

export function leadNeedsAttention(lead: Lead, now: Date = new Date()): boolean {
  if (!lead.nextFollowUpAt) return false;
  if (lead.stage === 'Won' || lead.stage === 'Lost') return false;
  return parseDateOnly(lead.nextFollowUpAt) <= startOfDay(now);
}
