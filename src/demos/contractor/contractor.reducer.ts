import type {
  ActivityEvent,
  ActivityKind,
  Address,
  Cents,
  ContractorState,
  Counters,
  EntityRef,
  Estimate,
  FieldRecord,
  FollowUp,
  FollowUpType,
  Id,
  Invoice,
  Job,
  JobPriority,
  JobStatus,
  Lead,
  LeadStage,
  LineItem,
  Payment,
  PaymentMethod,
  ServiceLocation,
  Customer,
  EstimateStatus,
  WorkspaceSettings,
} from './contractor.types';
import { buildSeedState, seedToday } from './contractor.seed';
import {
  documentTotals,
  getEstimate,
  getJob,
  invoiceBalance,
} from './contractor.selectors';
import { addDays, createId, nextCode, toDateOnly } from './contractor.utils';

/**
 * Every write to the workspace.
 *
 * Two invariants hold across this file:
 *
 * 1. **Connected records move together.** Accepting an estimate, scheduling a
 *    job or recording a payment updates each record the change touches in the
 *    same action, so no screen can show a stale relationship.
 *
 * 2. **Nothing derivable is stored.** Totals, balances and effective invoice
 *    status are computed by selectors. The reducer never writes a number that
 *    could later disagree with the rows behind it.
 */

// ------------------------------------------------------------------ actions

export type ContractorAction =
  | { type: 'demo/reset' }
  | { type: 'demo/replace'; state: ContractorState }
  | { type: 'settings/update'; patch: Partial<WorkspaceSettings> }

  | { type: 'lead/create'; input: LeadInput; id?: Id }
  | { type: 'lead/update'; id: Id; patch: Partial<Lead> }
  | { type: 'lead/stage'; id: Id; stage: LeadStage }

  | { type: 'customer/create'; input: CustomerInput; id?: Id; locationId?: Id }
  | { type: 'customer/update'; id: Id; patch: Partial<Customer> }
  | { type: 'location/create'; customerId: Id; label: string; address: Address; notes?: string }

  | { type: 'estimate/create'; input: EstimateInput; id?: Id }
  | { type: 'estimate/update'; id: Id; patch: Partial<Estimate> }
  | { type: 'estimate/status'; id: Id; status: EstimateStatus }
  | { type: 'estimate/duplicate'; id: Id }
  | { type: 'estimate/delete'; id: Id }

  | { type: 'job/createFromEstimate'; estimateId: Id; priority?: JobPriority }
  | { type: 'job/create'; input: JobInput; id?: Id }
  | { type: 'job/update'; id: Id; patch: Partial<Job> }
  | { type: 'job/schedule'; id: Id; start?: string; end?: string }
  | { type: 'job/assignCrew'; id: Id; crewId?: Id }
  | { type: 'job/status'; id: Id; status: JobStatus }
  | { type: 'job/complete'; id: Id; completedAt: string; notes: string }

  | { type: 'field/add'; input: FieldRecordInput }
  | { type: 'field/toggleChecklist'; recordId: Id; index: number }

  | { type: 'invoice/createFromJob'; jobId: Id }
  | { type: 'invoice/create'; input: InvoiceInput; id?: Id }
  | { type: 'invoice/update'; id: Id; patch: Partial<Invoice> }
  | { type: 'invoice/send'; id: Id }
  | { type: 'invoice/void'; id: Id }
  | { type: 'invoice/delete'; id: Id }

  | { type: 'payment/record'; input: PaymentInput }

  | { type: 'followUp/create'; input: FollowUpInput }
  | { type: 'followUp/toggle'; id: Id };

export interface LeadInput {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  source: Lead['source'];
  serviceAddress: Address;
  serviceType: Lead['serviceType'];
  description: string;
  estimatedValue: Cents;
  stage: LeadStage;
  assignedUserId: Id;
  nextFollowUpAt?: string;
  customerId?: Id;
}

export interface CustomerInput {
  name: string;
  company?: string;
  phone: string;
  email: string;
  billingAddress: Address;
  notes: string;
  /** Creates a matching service location so the customer is immediately usable. */
  serviceLocationLabel?: string;
  serviceAddress?: Address;
}

export interface EstimateInput {
  customerId: Id;
  locationId: Id;
  leadId?: Id;
  title: string;
  scope: string;
  items: LineItem[];
  taxRate: number;
  discount: Cents;
  notes: string;
  terms: string;
  status?: EstimateStatus;
}

export interface JobInput {
  customerId: Id;
  locationId: Id;
  estimateId?: Id;
  title: string;
  scope: string;
  priority: JobPriority;
  notes: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  crewId?: Id;
}

export interface FieldRecordInput {
  jobId: Id;
  crewId?: Id;
  memberId?: Id;
  occurredAt: string;
  workPerformed: string;
  statusUpdate: string;
  notes: string;
  hours: number;
  materialsUsed: string;
  checklist: { label: string; done: boolean }[];
}

export interface InvoiceInput {
  customerId: Id;
  jobId?: Id;
  estimateId?: Id;
  items: LineItem[];
  taxRate: number;
  discount: Cents;
  issuedAt: string;
  dueAt: string;
  notes: string;
  terms: string;
  status?: Invoice['status'];
}

export interface PaymentInput {
  invoiceId: Id;
  amount: Cents;
  receivedAt: string;
  method: PaymentMethod;
  reference?: string;
}

export interface FollowUpInput {
  type: FollowUpType;
  title: string;
  dueAt: string;
  relatesTo: EntityRef;
  assignedUserId: Id;
}

// ------------------------------------------------------------------ helpers

const now = () => new Date().toISOString();

/**
 * Appends an activity event. Every meaningful action logs one, which is what
 * makes the timeline a record of what happened rather than seeded decoration.
 */
function log(
  state: ContractorState,
  kind: ActivityKind,
  subject: EntityRef,
  summary: string,
  related: EntityRef[] = [],
  actorId = 'usr-1',
): ActivityEvent[] {
  const event: ActivityEvent = {
    id: createId('act'),
    at: now(),
    kind,
    subject,
    related,
    summary,
    actorId,
  };
  return [event, ...state.activity];
}

/** Takes the next readable code and hands back the advanced counters. */
function take(counters: Counters, kind: Parameters<typeof nextCode>[1]) {
  return nextCode(counters, kind);
}

const replaceById = <T extends { id: Id }>(items: T[], id: Id, patch: Partial<T>): T[] =>
  items.map((item) => (item.id === id ? { ...item, ...patch } : item));

/** Copies line items with fresh ids so an estimate and its invoice never share rows. */
function cloneItems(items: LineItem[]): LineItem[] {
  return items.map((item) => ({ ...item, id: createId('li') }));
}

// ------------------------------------------------------------------ reducer

export function contractorReducer(
  state: ContractorState,
  action: ContractorAction,
): ContractorState {
  switch (action.type) {
    case 'demo/reset':
      return buildSeedState(seedToday());

    case 'demo/replace':
      return action.state;

    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    // ------------------------------------------------------------- leads

    case 'lead/create': {
      const { code, counters } = take(state.counters, 'lead');
      const lead: Lead = {
        id: action.id ?? createId('lead'),
        code,
        createdAt: now(),
        ...action.input,
      };
      return {
        ...state,
        counters,
        leads: [lead, ...state.leads],
        activity: log(
          state,
          'lead.created',
          { kind: 'lead', id: lead.id },
          `Lead ${lead.code} created from ${lead.source.toLowerCase()}.`,
          lead.customerId ? [{ kind: 'customer', id: lead.customerId }] : [],
          lead.assignedUserId,
        ),
      };
    }

    case 'lead/update':
      return { ...state, leads: replaceById(state.leads, action.id, action.patch) };

    case 'lead/stage': {
      const lead = state.leads.find((candidate) => candidate.id === action.id);
      if (!lead || lead.stage === action.stage) return state;
      return {
        ...state,
        leads: replaceById(state.leads, action.id, { stage: action.stage }),
        activity: log(
          state,
          'lead.stage',
          { kind: 'lead', id: lead.id },
          `${lead.code} moved from ${lead.stage} to ${action.stage}.`,
          lead.customerId ? [{ kind: 'customer', id: lead.customerId }] : [],
        ),
      };
    }

    // --------------------------------------------------------- customers

    case 'customer/create': {
      const { code, counters: afterCustomer } = take(state.counters, 'customer');
      const customer: Customer = {
        id: action.id ?? createId('cus'),
        code,
        name: action.input.name,
        company: action.input.company,
        phone: action.input.phone,
        email: action.input.email,
        billingAddress: action.input.billingAddress,
        notes: action.input.notes,
        customerSince: toDateOnly(new Date()),
      };

      // A customer with no service location cannot be given an estimate or a
      // job, so one is always created alongside — the billing address by
      // default, or a distinct service address when supplied.
      // The caller may supply the location id so it can select the location
      // immediately, without waiting for this state to come back.
      const { counters } = take(afterCustomer, 'location');
      const location: ServiceLocation = {
        id: action.locationId ?? createId('loc'),
        customerId: customer.id,
        label: action.input.serviceLocationLabel || 'Primary location',
        address: action.input.serviceAddress ?? action.input.billingAddress,
      };

      return {
        ...state,
        counters,
        customers: [customer, ...state.customers],
        locations: [...state.locations, location],
        activity: log(
          state,
          'customer.created',
          { kind: 'customer', id: customer.id },
          `Customer record created for ${customer.name}.`,
        ),
      };
    }

    case 'customer/update':
      return { ...state, customers: replaceById(state.customers, action.id, action.patch) };

    case 'location/create': {
      const { counters } = take(state.counters, 'location');
      const location: ServiceLocation = {
        id: createId('loc'),
        customerId: action.customerId,
        label: action.label,
        address: action.address,
        notes: action.notes,
      };
      return { ...state, counters, locations: [...state.locations, location] };
    }

    // --------------------------------------------------------- estimates

    case 'estimate/create': {
      const { code, counters } = take(state.counters, 'estimate');
      const today = new Date();
      const estimate: Estimate = {
        id: action.id ?? createId('est'),
        code,
        customerId: action.input.customerId,
        locationId: action.input.locationId,
        leadId: action.input.leadId,
        title: action.input.title,
        scope: action.input.scope,
        status: action.input.status ?? 'Draft',
        items: action.input.items,
        taxRate: action.input.taxRate,
        discount: action.input.discount,
        issuedAt: toDateOnly(today),
        expiresAt: toDateOnly(addDays(today, state.settings.estimateValidityDays)),
        notes: action.input.notes,
        terms: action.input.terms,
        createdAt: now(),
      };

      // An estimate built from a lead advances that lead, so the pipeline
      // reflects the work that was just done rather than needing a second edit.
      const leads = estimate.leadId
        ? replaceById(state.leads, estimate.leadId, {
            stage: estimate.status === 'Draft' ? 'Estimate Needed' : 'Estimate Sent',
          })
        : state.leads;

      return {
        ...state,
        counters,
        leads,
        estimates: [estimate, ...state.estimates],
        activity: log(
          state,
          'estimate.created',
          { kind: 'estimate', id: estimate.id },
          `Estimate ${estimate.code} created.`,
          [
            { kind: 'customer', id: estimate.customerId },
            ...(estimate.leadId ? [{ kind: 'lead' as const, id: estimate.leadId }] : []),
          ],
          'usr-2',
        ),
      };
    }

    case 'estimate/update': {
      const estimate = getEstimate(state, action.id);
      if (!estimate) return state;
      return {
        ...state,
        estimates: replaceById(state.estimates, action.id, action.patch),
        activity: log(
          state,
          'estimate.updated',
          { kind: 'estimate', id: action.id },
          `Estimate ${estimate.code} updated.`,
          [{ kind: 'customer', id: estimate.customerId }],
          'usr-2',
        ),
      };
    }

    case 'estimate/status': {
      const estimate = getEstimate(state, action.id);
      if (!estimate || estimate.status === action.status) return state;

      const kind: ActivityKind =
        action.status === 'Accepted'
          ? 'estimate.accepted'
          : action.status === 'Declined'
            ? 'estimate.declined'
            : action.status === 'Sent'
              ? 'estimate.sent'
              : 'estimate.updated';

      // The lead that produced this estimate follows its outcome.
      let leads = state.leads;
      if (estimate.leadId) {
        const stage: LeadStage | undefined =
          action.status === 'Accepted'
            ? 'Won'
            : action.status === 'Declined'
              ? 'Lost'
              : action.status === 'Sent'
                ? 'Estimate Sent'
                : undefined;
        if (stage) leads = replaceById(state.leads, estimate.leadId, { stage });
      }

      return {
        ...state,
        leads,
        estimates: replaceById(state.estimates, action.id, { status: action.status }),
        activity: log(
          state,
          kind,
          { kind: 'estimate', id: estimate.id },
          `Estimate ${estimate.code} marked ${action.status.toLowerCase()}.`,
          [{ kind: 'customer', id: estimate.customerId }],
          'usr-2',
        ),
      };
    }

    case 'estimate/duplicate': {
      const source = getEstimate(state, action.id);
      if (!source) return state;
      const { code, counters } = take(state.counters, 'estimate');
      const today = new Date();
      const copy: Estimate = {
        ...source,
        id: createId('est'),
        code,
        status: 'Draft',
        leadId: undefined,
        title: `${source.title} (copy)`,
        items: cloneItems(source.items),
        issuedAt: toDateOnly(today),
        expiresAt: toDateOnly(addDays(today, state.settings.estimateValidityDays)),
        createdAt: now(),
      };
      return {
        ...state,
        counters,
        estimates: [copy, ...state.estimates],
        activity: log(
          state,
          'estimate.created',
          { kind: 'estimate', id: copy.id },
          `Estimate ${copy.code} duplicated from ${source.code}.`,
          [{ kind: 'customer', id: copy.customerId }],
          'usr-2',
        ),
      };
    }

    case 'estimate/delete': {
      const estimate = getEstimate(state, action.id);
      // Only drafts are removable. Anything sent is part of the record.
      if (!estimate || estimate.status !== 'Draft') return state;
      return {
        ...state,
        estimates: state.estimates.filter((candidate) => candidate.id !== action.id),
        activity: state.activity.filter(
          (event) => !(event.subject.kind === 'estimate' && event.subject.id === action.id),
        ),
      };
    }

    // -------------------------------------------------------------- jobs

    case 'job/createFromEstimate': {
      const estimate = getEstimate(state, action.estimateId);
      if (!estimate || estimate.status !== 'Accepted') return state;
      if (state.jobs.some((job) => job.estimateId === estimate.id)) return state;

      const { code, counters } = take(state.counters, 'job');
      const job: Job = {
        id: createId('job'),
        code,
        customerId: estimate.customerId,
        locationId: estimate.locationId,
        estimateId: estimate.id,
        title: estimate.title,
        scope: estimate.scope,
        status: 'Unscheduled',
        priority: action.priority ?? 'Normal',
        notes: '',
        createdAt: now(),
      };

      return {
        ...state,
        counters,
        jobs: [job, ...state.jobs],
        activity: log(
          state,
          'job.created',
          { kind: 'job', id: job.id },
          `Job ${job.code} created from accepted estimate ${estimate.code}.`,
          [
            { kind: 'customer', id: job.customerId },
            { kind: 'estimate', id: estimate.id },
          ],
          'usr-3',
        ),
      };
    }

    case 'job/create': {
      const { code, counters } = take(state.counters, 'job');
      const job: Job = {
        id: action.id ?? createId('job'),
        code,
        status: action.input.scheduledStart ? 'Scheduled' : 'Unscheduled',
        createdAt: now(),
        ...action.input,
      };
      return {
        ...state,
        counters,
        jobs: [job, ...state.jobs],
        activity: log(
          state,
          'job.created',
          { kind: 'job', id: job.id },
          `Job ${job.code} created.`,
          [{ kind: 'customer', id: job.customerId }],
          'usr-3',
        ),
      };
    }

    case 'job/update':
      return { ...state, jobs: replaceById(state.jobs, action.id, action.patch) };

    case 'job/schedule': {
      const job = getJob(state, action.id);
      if (!job) return state;

      // Scheduling a job that had no date moves it out of Unscheduled; clearing
      // the date moves it back. Completed and cancelled jobs keep their status.
      const keepsStatus = job.status === 'Completed' || job.status === 'Cancelled';
      const status: JobStatus = keepsStatus
        ? job.status
        : action.start
          ? job.status === 'Unscheduled'
            ? 'Scheduled'
            : job.status
          : 'Unscheduled';

      return {
        ...state,
        jobs: replaceById(state.jobs, action.id, {
          scheduledStart: action.start,
          scheduledEnd: action.end,
          status,
        }),
        activity: log(
          state,
          'job.scheduled',
          { kind: 'job', id: job.id },
          action.start
            ? `${job.code} scheduled for ${new Date(action.start).toLocaleDateString('en-US')}.`
            : `${job.code} returned to unscheduled.`,
          [{ kind: 'customer', id: job.customerId }],
          'usr-3',
        ),
      };
    }

    case 'job/assignCrew': {
      const job = getJob(state, action.id);
      if (!job) return state;
      const crew = state.crews.find((candidate) => candidate.id === action.crewId);
      return {
        ...state,
        jobs: replaceById(state.jobs, action.id, { crewId: action.crewId }),
        activity: log(
          state,
          'job.crew',
          { kind: 'job', id: job.id },
          crew ? `${crew.name} assigned to ${job.code}.` : `Crew removed from ${job.code}.`,
          [
            { kind: 'customer', id: job.customerId },
            ...(action.crewId ? [{ kind: 'crew' as const, id: action.crewId }] : []),
          ],
          'usr-3',
        ),
      };
    }

    case 'job/status': {
      const job = getJob(state, action.id);
      if (!job || job.status === action.status) return state;

      const kind: ActivityKind =
        action.status === 'In Progress'
          ? 'job.started'
          : action.status === 'On Hold'
            ? 'job.hold'
            : action.status === 'Cancelled'
              ? 'job.cancelled'
              : 'job.scheduled';

      return {
        ...state,
        jobs: replaceById(state.jobs, action.id, { status: action.status }),
        activity: log(
          state,
          kind,
          { kind: 'job', id: job.id },
          `${job.code} moved to ${action.status}.`,
          [{ kind: 'customer', id: job.customerId }],
          'usr-4',
        ),
      };
    }

    case 'job/complete': {
      const job = getJob(state, action.id);
      if (!job) return state;
      return {
        ...state,
        jobs: replaceById(state.jobs, action.id, {
          status: 'Completed',
          completedAt: action.completedAt,
          completionNotes: action.notes,
        }),
        activity: log(
          state,
          'job.completed',
          { kind: 'job', id: job.id },
          `${job.code} marked complete.`,
          [{ kind: 'customer', id: job.customerId }],
          'usr-4',
        ),
      };
    }

    // ----------------------------------------------------- field records

    case 'field/add': {
      const job = getJob(state, action.input.jobId);
      if (!job) return state;
      const { code, counters } = take(state.counters, 'field');
      const record: FieldRecord = {
        id: createId('fr'),
        code,
        ...action.input,
      };

      // Logging work from the field means the crew is on site, so a job that is
      // merely scheduled starts. This is the behaviour a supervisor expects.
      const jobs =
        job.status === 'Scheduled'
          ? replaceById(state.jobs, job.id, { status: 'In Progress' as JobStatus })
          : state.jobs;

      return {
        ...state,
        counters,
        jobs,
        fieldRecords: [record, ...state.fieldRecords],
        activity: log(
          state,
          'field.added',
          { kind: 'job', id: job.id },
          `Field record ${record.code} added — ${record.statusUpdate || record.workPerformed}`,
          [{ kind: 'customer', id: job.customerId }],
          'usr-4',
        ),
      };
    }

    case 'field/toggleChecklist': {
      return {
        ...state,
        fieldRecords: state.fieldRecords.map((record) =>
          record.id === action.recordId
            ? {
                ...record,
                checklist: record.checklist.map((item, index) =>
                  index === action.index ? { ...item, done: !item.done } : item,
                ),
              }
            : record,
        ),
      };
    }

    // ---------------------------------------------------------- invoices

    case 'invoice/createFromJob': {
      const job = getJob(state, action.jobId);
      if (!job || job.status !== 'Completed') return state;

      const estimate = getEstimate(state, job.estimateId);
      const { code, counters } = take(state.counters, 'invoice');
      const today = new Date();

      // Billing starts from the accepted estimate when there is one — that is
      // the figure the customer agreed to. Items are cloned so later edits to
      // the invoice never rewrite the estimate.
      const invoice: Invoice = {
        id: createId('inv'),
        code,
        customerId: job.customerId,
        jobId: job.id,
        estimateId: estimate?.id,
        status: 'Draft',
        items: estimate ? cloneItems(estimate.items) : [],
        taxRate: estimate?.taxRate ?? state.settings.defaultTaxRate,
        discount: estimate?.discount ?? 0,
        issuedAt: toDateOnly(today),
        dueAt: toDateOnly(addDays(today, state.settings.paymentTermsDays)),
        notes: '',
        terms: `Payment due within ${state.settings.paymentTermsDays} days of the invoice date.`,
        createdAt: now(),
      };

      return {
        ...state,
        counters,
        invoices: [invoice, ...state.invoices],
        activity: log(
          state,
          'invoice.created',
          { kind: 'invoice', id: invoice.id },
          `Invoice ${invoice.code} created from ${job.code}.`,
          [
            { kind: 'customer', id: job.customerId },
            { kind: 'job', id: job.id },
          ],
        ),
      };
    }

    case 'invoice/create': {
      const { code, counters } = take(state.counters, 'invoice');
      const invoice: Invoice = {
        id: action.id ?? createId('inv'),
        code,
        status: action.input.status ?? 'Draft',
        createdAt: now(),
        ...action.input,
      };
      return {
        ...state,
        counters,
        invoices: [invoice, ...state.invoices],
        activity: log(
          state,
          'invoice.created',
          { kind: 'invoice', id: invoice.id },
          `Invoice ${invoice.code} created.`,
          [{ kind: 'customer', id: invoice.customerId }],
        ),
      };
    }

    case 'invoice/update':
      return { ...state, invoices: replaceById(state.invoices, action.id, action.patch) };

    case 'invoice/send': {
      const invoice = state.invoices.find((candidate) => candidate.id === action.id);
      if (!invoice || invoice.status !== 'Draft') return state;
      return {
        ...state,
        invoices: replaceById(state.invoices, action.id, { status: 'Sent' }),
        activity: log(
          state,
          'invoice.sent',
          { kind: 'invoice', id: invoice.id },
          `Invoice ${invoice.code} sent to the customer.`,
          [{ kind: 'customer', id: invoice.customerId }],
        ),
      };
    }

    case 'invoice/void': {
      const invoice = state.invoices.find((candidate) => candidate.id === action.id);
      if (!invoice) return state;
      return {
        ...state,
        invoices: replaceById(state.invoices, action.id, { status: 'Void' }),
        activity: log(
          state,
          'invoice.void',
          { kind: 'invoice', id: invoice.id },
          `Invoice ${invoice.code} voided.`,
          [{ kind: 'customer', id: invoice.customerId }],
        ),
      };
    }

    case 'invoice/delete': {
      const invoice = state.invoices.find((candidate) => candidate.id === action.id);
      if (!invoice || invoice.status !== 'Draft') return state;
      return {
        ...state,
        invoices: state.invoices.filter((candidate) => candidate.id !== action.id),
        activity: state.activity.filter(
          (event) => !(event.subject.kind === 'invoice' && event.subject.id === action.id),
        ),
      };
    }

    // ---------------------------------------------------------- payments

    case 'payment/record': {
      const invoice = state.invoices.find(
        (candidate) => candidate.id === action.input.invoiceId,
      );
      if (!invoice || invoice.status === 'Void') return state;

      // A payment can never exceed what is owed, and can never be zero or
      // negative. Clamping here means no caller can push an invoice into a
      // credit balance the rest of the app has no way to express.
      const outstanding = invoiceBalance(state, invoice);
      const amount = Math.min(Math.max(1, Math.round(action.input.amount)), outstanding);
      if (outstanding <= 0) return state;

      const { code, counters } = take(state.counters, 'payment');
      const payment: Payment = {
        id: createId('pay'),
        code,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        amount,
        receivedAt: action.input.receivedAt,
        method: action.input.method,
        reference: action.input.reference,
      };

      // A draft invoice that receives money has evidently been issued.
      const invoices =
        invoice.status === 'Draft'
          ? replaceById(state.invoices, invoice.id, { status: 'Sent' as Invoice['status'] })
          : state.invoices;

      return {
        ...state,
        counters,
        invoices,
        payments: [payment, ...state.payments],
        activity: log(
          state,
          'payment.recorded',
          { kind: 'invoice', id: invoice.id },
          `Payment ${payment.code} recorded against ${invoice.code} by ${payment.method.toLowerCase()}.`,
          [
            { kind: 'customer', id: invoice.customerId },
            { kind: 'payment', id: payment.id },
          ],
        ),
      };
    }

    // --------------------------------------------------------- follow-ups

    case 'followUp/create': {
      const { code, counters } = take(state.counters, 'followUp');
      const task: FollowUp = {
        id: createId('fu'),
        code,
        done: false,
        createdAt: now(),
        ...action.input,
      };
      return {
        ...state,
        counters,
        followUps: [task, ...state.followUps],
        activity: log(
          state,
          'followup.created',
          action.input.relatesTo,
          `Follow-up scheduled: ${task.title}.`,
        ),
      };
    }

    case 'followUp/toggle': {
      const task = state.followUps.find((candidate) => candidate.id === action.id);
      if (!task) return state;
      const done = !task.done;
      return {
        ...state,
        followUps: replaceById(state.followUps, action.id, { done }),
        activity: done
          ? log(
              state,
              'followup.completed',
              task.relatesTo,
              `Follow-up completed: ${task.title}.`,
            )
          : state.activity,
      };
    }

    default:
      return state;
  }
}

/**
 * Builds the invoice line items a job should be billed with, without writing
 * anything. The invoice editor uses this to show a pre-filled draft the user
 * can still change before saving.
 */
export function proposedInvoiceItems(state: ContractorState, job: Job): LineItem[] {
  const estimate = getEstimate(state, job.estimateId);
  if (estimate) return cloneItems(estimate.items);

  return [
    {
      id: createId('li'),
      kind: 'Labor',
      description: job.title,
      quantity: 1,
      unit: 'lot',
      unitPrice: 0,
    },
  ];
}

export { documentTotals };
