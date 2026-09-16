import type { Address, Cents, DateOnly, Id, Timestamp } from '../shared/types';

export type { Address, Cents, DateOnly, Id, Timestamp };

/**
 * Dealer Operations — domain model.
 *
 * The shape of a dealership is different from a contractor's: the scarce thing
 * is not crew time but the vehicle itself, and a vehicle can only be promised
 * to one customer at a time. That constraint is why `Vehicle.status` exists and
 * why reservations, deals and delivery all read it rather than keeping their
 * own copy — a denormalized "is it available" flag is exactly the field that
 * goes stale and sells the same car twice.
 *
 * Money is whole cents. Dates are ISO strings. See `shared/types.ts`.
 */

// ---------------------------------------------------------------- demo users

export type DemoRole = 'owner' | 'sales' | 'sales_manager' | 'finance' | 'operations';

export const DEMO_ROLES: { id: DemoRole; label: string; description: string }[] = [
  { id: 'owner', label: 'Owner', description: 'Every module.' },
  { id: 'sales', label: 'Sales', description: 'Leads, customers, inventory, reservations, tasks.' },
  { id: 'sales_manager', label: 'Sales Manager', description: 'Sales, plus deals and reporting.' },
  { id: 'finance', label: 'Finance', description: 'Deals, financing, payments and documents.' },
  { id: 'operations', label: 'Operations', description: 'Inventory, reservations, documents, delivery.' },
];

export interface Salesperson {
  id: Id;
  name: string;
  title: string;
  role: DemoRole;
  /** Branch they normally work from. */
  locationId: Id;
}

export interface DealerLocation {
  id: Id;
  name: string;
  address: Address;
  phone: string;
}

// ------------------------------------------------------------------ vehicles

export const VEHICLE_STATUSES = [
  'In Stock',
  'Reserved',
  'Pending Sale',
  'Sold',
  'Service Hold',
  'Unavailable',
] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

/** A vehicle in one of these states cannot be promised to a new customer. */
export const UNAVAILABLE_STATUSES: VehicleStatus[] = ['Sold', 'Service Hold', 'Unavailable'];

export const VEHICLE_TYPES = [
  'Sedan',
  'SUV',
  'Truck',
  'Van',
  'Coupe',
  'Motorcycle',
  'Powersports',
] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const FUEL_TYPES = ['Gasoline', 'Diesel', 'Hybrid', 'Electric'] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

export const TRANSMISSIONS = ['Automatic', 'Manual', 'CVT', 'Single-speed'] as const;
export type Transmission = (typeof TRANSMISSIONS)[number];

export const VEHICLE_CONDITIONS = ['New', 'Used', 'Certified Pre-Owned'] as const;
export type VehicleCondition = (typeof VEHICLE_CONDITIONS)[number];

export interface Vehicle {
  id: Id;
  /** Readable stock number, e.g. STK-2031. */
  code: string;
  /**
   * Seventeen-character demonstration identifier. It follows the shape of a VIN
   * so the interface reads correctly, but it does not decode to a real vehicle
   * and never belongs to anyone.
   */
  vin: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  type: VehicleType;
  mileage: number;
  exteriorColor: string;
  interiorColor: string;
  transmission: Transmission;
  fuelType: FuelType;
  condition: VehicleCondition;
  /** What the dealership paid. Hidden from roles that have no business seeing it. */
  acquisitionCost: Cents;
  listPrice: Cents;
  locationId: Id;
  status: VehicleStatus;
  acquiredAt: DateOnly;
  soldAt?: DateOnly;
  notes?: string;
}

// --------------------------------------------------------------------- leads

export const LEAD_STAGES = [
  'New',
  'Contacted',
  'Appointment',
  'Vehicle Selected',
  'Reservation',
  'Negotiation',
  'Won',
  'Lost',
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_SOURCES = [
  'Website',
  'Walk-in',
  'Phone Inquiry',
  'Referral',
  'Marketplace Listing',
  'Repeat Customer',
  'Social Media',
  'Trade Event',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const CONTACT_PREFERENCES = ['Phone', 'Email', 'Text'] as const;
export type ContactPreference = (typeof CONTACT_PREFERENCES)[number];

export const APPOINTMENT_KINDS = [
  'Showroom visit',
  'Vehicle viewing',
  'Test drive',
  'Follow-up call',
] as const;
export type AppointmentKind = (typeof APPOINTMENT_KINDS)[number];

export interface DealerLead {
  id: Id;
  code: string;
  name: string;
  phone: string;
  email: string;
  source: LeadSource;
  stage: LeadStage;
  /** Set once the lead becomes a customer record. */
  customerId?: Id;
  /** The vehicle the conversation is about. */
  vehicleId?: Id;
  /** Other vehicles the shopper has asked about. */
  alsoInterestedIn: Id[];
  budgetMin?: Cents;
  budgetMax?: Cents;
  contactPreference: ContactPreference;
  hasTradeIn: boolean;
  salespersonId: Id;
  appointmentAt?: Timestamp;
  appointmentKind?: AppointmentKind;
  nextFollowUpAt?: DateOnly;
  notes: string;
  createdAt: Timestamp;
}

// ----------------------------------------------------------------- customers

export interface Customer {
  id: Id;
  code: string;
  name: string;
  phone: string;
  email: string;
  address: Address;
  /** Set when the record was created by converting a lead. */
  leadId?: Id;
  customerSince: DateOnly;
  notes: string;
}

// -------------------------------------------------------------- reservations

export const RESERVATION_STATUSES = [
  'Pending',
  'Confirmed',
  'Expired',
  'Cancelled',
  'Converted to Deal',
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** A reservation in one of these states still holds its vehicle. */
export const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = ['Pending', 'Confirmed'];

export interface Reservation {
  id: Id;
  code: string;
  customerId: Id;
  vehicleId: Id;
  salespersonId: Id;
  status: ReservationStatus;
  reservedAt: DateOnly;
  expiresAt: DateOnly;
  /** What the customer agreed to put down to hold the vehicle. */
  requestedDeposit: Cents;
  dealId?: Id;
  notes: string;
}

// --------------------------------------------------------------------- deals

export const DEAL_STATUSES = [
  'Draft',
  'Negotiation',
  'Pending Documents',
  'Pending Financing',
  'Ready to Close',
  'Closed',
  'Cancelled',
] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const PAYMENT_PLANS = ['Cash', 'Financing'] as const;
export type PaymentPlan = (typeof PAYMENT_PLANS)[number];

export interface DealFee {
  id: Id;
  label: string;
  amount: Cents;
}

/**
 * A vehicle the customer is handing over.
 *
 * Every figure is entered by the dealership. Nothing here is an automated
 * valuation and the demo never produces one.
 */
export interface TradeIn {
  year: number;
  make: string;
  model: string;
  mileage: number;
  vin: string;
  /** Dealer-entered allowance. */
  allowance: Cents;
  /** Outstanding finance on the trade, deducted from the allowance. */
  payoff: Cents;
}

export interface Deal {
  id: Id;
  code: string;
  customerId: Id;
  vehicleId: Id;
  salespersonId: Id;
  reservationId?: Id;
  status: DealStatus;
  plan: PaymentPlan;
  salePrice: Cents;
  discount: Cents;
  fees: DealFee[];
  taxRate: number;
  tradeIn?: TradeIn;
  /** What the customer agreed to pay up front, financing or not. */
  downPayment: Cents;
  openedAt: DateOnly;
  closedAt?: DateOnly;
  notes: string;
  delivery?: Delivery;
}

// ------------------------------------------------------------------ delivery

export interface Delivery {
  vehicleReady: boolean;
  documentsSigned: boolean;
  paymentConfirmed: boolean;
  insuranceProvided: boolean;
  keysHandedOver: boolean;
  completedAt?: DateOnly;
  notes: string;
}

export const DELIVERY_CHECKS: { key: keyof Delivery; label: string }[] = [
  { key: 'vehicleReady', label: 'Vehicle prepared and inspected' },
  { key: 'documentsSigned', label: 'Paperwork signed' },
  { key: 'paymentConfirmed', label: 'Payment confirmed' },
  { key: 'insuranceProvided', label: 'Proof of insurance on file' },
  { key: 'keysHandedOver', label: 'Keys and vehicle handed over' },
];

// ----------------------------------------------------------------- financing

export const FINANCING_STATUSES = [
  'Draft',
  'Documents Needed',
  'Ready to Submit',
  'Submitted',
  'Under Review',
  'Approved',
  'Conditionally Approved',
  'Declined',
  'Withdrawn',
  'Completed',
] as const;
export type FinancingStatus = (typeof FINANCING_STATUSES)[number];

/**
 * Deal statuses that commit a vehicle.
 *
 * A deal in one of these states has taken the vehicle off the market: it drives
 * the `Pending Sale` status and blocks a new reservation. A Draft or
 * Negotiation deal has not, which is why neither appears here.
 */
export const COMMITTED_DEAL_STATUSES: DealStatus[] = [
  'Pending Documents',
  'Pending Financing',
  'Ready to Close',
];

/** Statuses that let a deal move forward on a financed plan. */
export const FINANCING_CLEARED: FinancingStatus[] = ['Approved', 'Conditionally Approved', 'Completed'];

export const TERM_PREFERENCES = [36, 48, 60, 72, 84] as const;
export type TermPreference = (typeof TERM_PREFERENCES)[number];

/**
 * Operational tracker for a financing application.
 *
 * This records what the dealership did and what a lender said. It performs no
 * underwriting: there is no score, no decision rule and no lender connection.
 * `status` only ever changes because a person recorded that it changed.
 */
export interface FinancingApplication {
  id: Id;
  code: string;
  customerId: Id;
  dealId: Id;
  vehicleId: Id;
  status: FinancingStatus;
  amountRequested: Cents;
  downPayment: Cents;
  termMonths: TermPreference;
  /** Placeholder category, never a real lender relationship. */
  lenderCategory: string;
  /** Who at the dealership owns the application. */
  financeContactId: Id;
  submittedAt?: DateOnly;
  decisionAt?: DateOnly;
  /** Free text recorded by the finance desk, e.g. conditions attached. */
  decisionNotes: string;
  createdAt: Timestamp;
}

// ------------------------------------------------------------------ payments

export const PAYMENT_KINDS = [
  'Reservation Deposit',
  'Down Payment',
  'Balance Payment',
  'Refund',
] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_METHODS = ['Card', 'ACH', 'Cash', 'Check', 'Other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface Payment {
  id: Id;
  code: string;
  customerId: Id;
  kind: PaymentKind;
  /** Set for deposits. */
  reservationId?: Id;
  /** Set for down payments and balance payments. */
  dealId?: Id;
  /** Positive cents. A refund is recorded as a negative contribution. */
  amount: Cents;
  method: PaymentMethod;
  receivedAt: DateOnly;
  reference: string;
}

// ----------------------------------------------------------------- documents

export const DOCUMENT_TYPES = [
  'Photo ID',
  'Proof of Address',
  'Reservation Receipt',
  'Deal Summary',
  'Proof of Insurance',
  'Financing Application',
  'Income Reference',
  'Trade-in Title',
  'Delivery Confirmation',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = [
  'Missing',
  'Requested',
  'Received',
  'Reviewed',
  'Signed',
  'Not Applicable',
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** Statuses that count as satisfied when checking whether a deal can close. */
export const DOCUMENT_SATISFIED: DocumentStatus[] = ['Received', 'Reviewed', 'Signed', 'Not Applicable'];

/**
 * A document the dealership is tracking.
 *
 * Only the fact that a document exists is recorded — a name, a type and a
 * status. No file is uploaded anywhere and nothing about its contents is
 * stored, which keeps a public demo from ever holding somebody's identity
 * document. The demo does not verify authenticity and does not claim to.
 */
export interface DocumentRecord {
  id: Id;
  code: string;
  type: DocumentType;
  status: DocumentStatus;
  customerId: Id;
  dealId?: Id;
  reservationId?: Id;
  /** Descriptive file name recorded by the person who took it in. */
  fileLabel?: string;
  requestedAt?: DateOnly;
  receivedAt?: DateOnly;
  notes: string;
}

// --------------------------------------------------------------------- tasks

export const TASK_KINDS = [
  'Call new lead',
  'Confirm appointment',
  'Follow up on reservation',
  'Request missing document',
  'Financing status follow-up',
  'Schedule delivery',
  'Post-sale follow-up',
] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export interface Task {
  id: Id;
  code: string;
  kind: TaskKind;
  title: string;
  dueAt: DateOnly;
  done: boolean;
  assigneeId: Id;
  leadId?: Id;
  customerId?: Id;
  vehicleId?: Id;
  dealId?: Id;
  reservationId?: Id;
  notes: string;
}

// ------------------------------------------------------------------ activity

export type ActivityKind =
  | 'lead.created'
  | 'lead.stage'
  | 'lead.converted'
  | 'vehicle.created'
  | 'vehicle.status'
  | 'vehicle.interest'
  | 'reservation.created'
  | 'reservation.confirmed'
  | 'reservation.cancelled'
  | 'reservation.converted'
  | 'deal.created'
  | 'deal.updated'
  | 'deal.status'
  | 'deal.closed'
  | 'financing.created'
  | 'financing.status'
  | 'payment.recorded'
  | 'document.updated'
  | 'delivery.completed'
  | 'task.created'
  | 'task.completed';

export type ActivitySubjectKind =
  | 'lead'
  | 'customer'
  | 'vehicle'
  | 'reservation'
  | 'deal'
  | 'financing'
  | 'payment'
  | 'document'
  | 'task';

export interface ActivitySubject {
  kind: ActivitySubjectKind;
  id: Id;
}

export interface ActivityEvent {
  id: Id;
  kind: ActivityKind;
  at: Timestamp;
  /** The record the event belongs to. */
  subject: ActivitySubject;
  /** Extra records the event should also appear on, e.g. the vehicle of a deal. */
  related: ActivitySubject[];
  actorId: Id;
  message: string;
}

// ------------------------------------------------------------------ settings

export interface DealerSettings {
  companyName: string;
  legalLine: string;
  address: Address;
  phone: string;
  email: string;
  /** Sales tax applied to deals, as a percentage. */
  defaultTaxRate: number;
  /** Days a reservation holds a vehicle by default. */
  reservationHoldDays: number;
  /** Default deposit suggested when a reservation is created. */
  defaultDeposit: Cents;
  dealTerms: string;
}

// ------------------------------------------------------------------ counters

export type CounterKind =
  | 'lead'
  | 'customer'
  | 'vehicle'
  | 'reservation'
  | 'deal'
  | 'financing'
  | 'payment'
  | 'document'
  | 'task';

export type Counters = Record<CounterKind, number>;

// --------------------------------------------------------------------- state

export interface DealerState {
  schemaVersion: number;
  settings: DealerSettings;
  counters: Counters;
  locations: DealerLocation[];
  salespeople: Salesperson[];
  vehicles: Vehicle[];
  leads: DealerLead[];
  customers: Customer[];
  reservations: Reservation[];
  deals: Deal[];
  financing: FinancingApplication[];
  payments: Payment[];
  documents: DocumentRecord[];
  tasks: Task[];
  activity: ActivityEvent[];
}
