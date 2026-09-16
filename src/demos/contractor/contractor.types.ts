/**
 * Contractor Operations — domain model.
 *
 * Money is stored in whole cents everywhere. Currency arithmetic on floats
 * accumulates error across line items, tax and partial payments, which is
 * exactly where an invoice balance must be exact, so every amount in this
 * model is an integer and is only converted to dollars for display and input.
 *
 * Dates use ISO strings: `YYYY-MM-DD` for calendar dates and full ISO 8601 for
 * timestamps. Storing them as strings keeps state JSON-serializable, which is
 * what lets the whole workspace round-trip through localStorage unchanged.
 */

export type Id = string;
/** Whole cents. Never a float. */
export type Cents = number;
/** `YYYY-MM-DD`. */
export type DateOnly = string;
/** Full ISO 8601 timestamp. */
export type Timestamp = string;

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}

// ---------------------------------------------------------------- demo users

export type DemoRole = 'owner' | 'sales' | 'operations' | 'field';

export interface DemoUser {
  id: Id;
  name: string;
  title: string;
  role: DemoRole;
}

// --------------------------------------------------------------------- leads

export const LEAD_STAGES = [
  'New',
  'Contacted',
  'Qualified',
  'Estimate Needed',
  'Estimate Sent',
  'Won',
  'Lost',
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_SOURCES = [
  'Referral',
  'Website',
  'Google Search',
  'Repeat Customer',
  'Yard Sign',
  'Home Show',
  'Social Media',
  'Phone Inquiry',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const SERVICE_TYPES = [
  'Roofing',
  'HVAC',
  'Plumbing',
  'Electrical',
  'Remodeling',
  'Landscaping',
  'General Contracting',
  'Maintenance',
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export interface Lead {
  id: Id;
  /** Human-readable identifier, e.g. `LD-1024`. */
  code: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  source: LeadSource;
  serviceAddress: Address;
  serviceType: ServiceType;
  description: string;
  /** Estimated opportunity value. */
  estimatedValue: Cents;
  stage: LeadStage;
  assignedUserId: Id;
  createdAt: Timestamp;
  nextFollowUpAt?: DateOnly;
  /** Set once the lead is converted into a customer record. */
  customerId?: Id;
}

// ----------------------------------------------------------------- customers

export interface Customer {
  id: Id;
  code: string;
  name: string;
  company?: string;
  phone: string;
  email: string;
  billingAddress: Address;
  notes: string;
  customerSince: DateOnly;
}

/**
 * Where the work happens. Contractors routinely bill one address and work at
 * another, so this is a first-class entity rather than a field on the customer.
 */
export interface ServiceLocation {
  id: Id;
  customerId: Id;
  label: string;
  address: Address;
  notes?: string;
}

// ----------------------------------------------------------------- estimates

export const ESTIMATE_STATUSES = [
  'Draft',
  'Sent',
  'Viewed',
  'Accepted',
  'Declined',
  'Expired',
] as const;
export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export const LINE_ITEM_KINDS = [
  'Labor',
  'Materials',
  'Equipment',
  'Permit',
  'Disposal',
  'Service Fee',
] as const;
export type LineItemKind = (typeof LINE_ITEM_KINDS)[number];

export const UNITS = ['hour', 'day', 'each', 'sq ft', 'linear ft', 'lot'] as const;
export type Unit = (typeof UNITS)[number];

export interface LineItem {
  id: Id;
  kind: LineItemKind;
  description: string;
  quantity: number;
  unit: Unit;
  unitPrice: Cents;
}

export interface Estimate {
  id: Id;
  code: string;
  customerId: Id;
  locationId: Id;
  /** The lead this estimate came from, when it started as one. */
  leadId?: Id;
  title: string;
  scope: string;
  status: EstimateStatus;
  items: LineItem[];
  /** Percentage, e.g. 8.25 for 8.25%. Applied to taxable subtotal after discount. */
  taxRate: number;
  discount: Cents;
  issuedAt: DateOnly;
  expiresAt: DateOnly;
  notes: string;
  terms: string;
  createdAt: Timestamp;
}

// ---------------------------------------------------------------------- jobs

export const JOB_STATUSES = [
  'Unscheduled',
  'Scheduled',
  'In Progress',
  'On Hold',
  'Completed',
  'Cancelled',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const;
export type JobPriority = (typeof JOB_PRIORITIES)[number];

export interface Job {
  id: Id;
  code: string;
  customerId: Id;
  locationId: Id;
  /** The accepted estimate this job was created from. */
  estimateId?: Id;
  title: string;
  scope: string;
  status: JobStatus;
  scheduledStart?: Timestamp;
  scheduledEnd?: Timestamp;
  crewId?: Id;
  priority: JobPriority;
  notes: string;
  completedAt?: Timestamp;
  completionNotes?: string;
  createdAt: Timestamp;
}

// --------------------------------------------------------------------- crews

export const CREW_ROLES = ['Crew Lead', 'Technician', 'Installer', 'Helper'] as const;
export type CrewRole = (typeof CREW_ROLES)[number];

export interface CrewMember {
  id: Id;
  crewId: Id;
  name: string;
  role: CrewRole;
  skills: string[];
}

export interface Crew {
  id: Id;
  name: string;
  trade: ServiceType;
  /** Weekly capacity in hours, used to express workload as a proportion. */
  weeklyCapacityHours: number;
  notes: string;
}

// ------------------------------------------------------------- field records

export interface ChecklistItem {
  label: string;
  done: boolean;
}

export interface FieldRecord {
  id: Id;
  code: string;
  jobId: Id;
  crewId?: Id;
  memberId?: Id;
  occurredAt: Timestamp;
  workPerformed: string;
  /** Free-text progress note, e.g. "Tear-off complete, dry-in tomorrow". */
  statusUpdate: string;
  notes: string;
  hours: number;
  materialsUsed: string;
  checklist: ChecklistItem[];
}

// ------------------------------------------------------------------ invoices

export const INVOICE_STATUSES = [
  'Draft',
  'Sent',
  'Partial',
  'Paid',
  'Overdue',
  'Void',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface Invoice {
  id: Id;
  code: string;
  customerId: Id;
  jobId?: Id;
  estimateId?: Id;
  /**
   * Stored status. It is deliberately NOT the whole truth: Partial, Paid and
   * Overdue are derived from payments and the due date by
   * `selectInvoiceStatus`, so a balance can never disagree with a badge.
   * Only Draft, Sent and Void are authoritative here.
   */
  status: InvoiceStatus;
  items: LineItem[];
  taxRate: number;
  discount: Cents;
  issuedAt: DateOnly;
  dueAt: DateOnly;
  notes: string;
  terms: string;
  createdAt: Timestamp;
}

// ------------------------------------------------------------------ payments

export const PAYMENT_METHODS = ['Card', 'ACH', 'Check', 'Cash', 'Other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface Payment {
  id: Id;
  code: string;
  invoiceId: Id;
  customerId: Id;
  amount: Cents;
  receivedAt: DateOnly;
  method: PaymentMethod;
  reference?: string;
}

// ------------------------------------------------------------------ activity

export type ActivityKind =
  | 'lead.created'
  | 'lead.stage'
  | 'lead.note'
  | 'customer.created'
  | 'estimate.created'
  | 'estimate.sent'
  | 'estimate.accepted'
  | 'estimate.declined'
  | 'estimate.updated'
  | 'job.created'
  | 'job.scheduled'
  | 'job.crew'
  | 'job.started'
  | 'job.hold'
  | 'job.completed'
  | 'job.cancelled'
  | 'field.added'
  | 'invoice.created'
  | 'invoice.sent'
  | 'invoice.void'
  | 'payment.recorded'
  | 'followup.created'
  | 'followup.completed';

/** What an activity event or follow-up is attached to. */
export type EntityKind =
  | 'lead'
  | 'customer'
  | 'estimate'
  | 'job'
  | 'invoice'
  | 'payment'
  | 'crew';

export interface EntityRef {
  kind: EntityKind;
  id: Id;
}

export interface ActivityEvent {
  id: Id;
  at: Timestamp;
  kind: ActivityKind;
  /** Primary record this event belongs to. */
  subject: EntityRef;
  /**
   * Additional records the event should also appear on — a payment shows on
   * both the invoice and the customer without being stored twice.
   */
  related: EntityRef[];
  summary: string;
  actorId?: Id;
}

// ----------------------------------------------------------------- follow-ups

export const FOLLOW_UP_TYPES = [
  'Call customer',
  'Follow up on estimate',
  'Confirm job schedule',
  'Payment reminder',
  'Site visit',
  'Other',
] as const;
export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number];

export interface FollowUp {
  id: Id;
  code: string;
  type: FollowUpType;
  title: string;
  dueAt: DateOnly;
  relatesTo: EntityRef;
  done: boolean;
  assignedUserId: Id;
  createdAt: Timestamp;
}

// -------------------------------------------------------------- workspace

export interface WorkspaceSettings {
  companyName: string;
  legalLine: string;
  phone: string;
  email: string;
  address: Address;
  license: string;
  /** Default sales tax percentage applied to new estimates and invoices. */
  defaultTaxRate: number;
  /** Net terms in days, used to compute an invoice due date. */
  paymentTermsDays: number;
  estimateValidityDays: number;
  defaultTerms: string;
}

/** Next sequence number per identifier prefix. */
export interface Counters {
  lead: number;
  customer: number;
  location: number;
  estimate: number;
  job: number;
  invoice: number;
  payment: number;
  field: number;
  followUp: number;
}

export interface ContractorState {
  /** Bumped when the stored shape changes so old data is discarded safely. */
  schemaVersion: number;
  seededAt: Timestamp;
  settings: WorkspaceSettings;
  users: DemoUser[];
  leads: Lead[];
  customers: Customer[];
  locations: ServiceLocation[];
  estimates: Estimate[];
  jobs: Job[];
  crews: Crew[];
  crewMembers: CrewMember[];
  fieldRecords: FieldRecord[];
  invoices: Invoice[];
  payments: Payment[];
  activity: ActivityEvent[];
  followUps: FollowUp[];
  counters: Counters;
}
