import type {
  ActivityEvent,
  ActivitySubject,
  Cents,
  Customer,
  Deal,
  DealerLead,
  DealerState,
  DemoRole,
  DocumentRecord,
  DocumentType,
  FinancingApplication,
  Id,
  Payment,
  Reservation,
  Task,
  Vehicle,
} from './dealer.types';
import {
  ACTIVE_RESERVATION_STATUSES,
  COMMITTED_DEAL_STATUSES,
  DOCUMENT_SATISFIED,
  FINANCING_CLEARED,
  UNAVAILABLE_STATUSES,
} from './dealer.types';
import type { Bucket } from '../shared/types';
import {
  daysBetween,
  matches,
  parseAny,
  percentOf,
  startOfDay,
  sumCents,
  vehicleTitle,
} from './dealer.utils';
import type { ModuleId } from './dealer.routes';

/**
 * Every derived read in the dealer workspace.
 *
 * Nothing that can be computed is stored. A deal has no `total` field and an
 * invoice-style balance is never written down, because the moment a figure is
 * duplicated it starts disagreeing with the records it came from — which in a
 * dealership means a car that is both available and sold.
 */

// -------------------------------------------------------------- basic lookups

export const getVehicle = (state: DealerState, id?: Id) =>
  id ? state.vehicles.find((vehicle) => vehicle.id === id) : undefined;
export const getCustomer = (state: DealerState, id?: Id) =>
  id ? state.customers.find((customer) => customer.id === id) : undefined;
export const getLead = (state: DealerState, id?: Id) =>
  id ? state.leads.find((lead) => lead.id === id) : undefined;
export const getReservation = (state: DealerState, id?: Id) =>
  id ? state.reservations.find((reservation) => reservation.id === id) : undefined;
export const getDeal = (state: DealerState, id?: Id) =>
  id ? state.deals.find((deal) => deal.id === id) : undefined;
export const getFinancing = (state: DealerState, id?: Id) =>
  id ? state.financing.find((application) => application.id === id) : undefined;
export const getPayment = (state: DealerState, id?: Id) =>
  id ? state.payments.find((payment) => payment.id === id) : undefined;
export const getSalesperson = (state: DealerState, id?: Id) =>
  id ? state.salespeople.find((person) => person.id === id) : undefined;
export const getLocation = (state: DealerState, id?: Id) =>
  id ? state.locations.find((location) => location.id === id) : undefined;

export const salespersonName = (state: DealerState, id?: Id) =>
  getSalesperson(state, id)?.name ?? 'Unassigned';

// ------------------------------------------------------------------ vehicles

/** The reservation currently holding a vehicle, if there is one. */
export function activeReservationForVehicle(
  state: DealerState,
  vehicleId: Id,
  ignoreReservationId?: Id,
): Reservation | undefined {
  return state.reservations.find(
    (reservation) =>
      reservation.vehicleId === vehicleId &&
      reservation.id !== ignoreReservationId &&
      ACTIVE_RESERVATION_STATUSES.includes(reservation.status),
  );
}

/** The open deal on a vehicle, if any. A closed or cancelled deal does not count. */
export function openDealForVehicle(state: DealerState, vehicleId: Id): Deal | undefined {
  return state.deals.find(
    (deal) =>
      deal.vehicleId === vehicleId && deal.status !== 'Closed' && deal.status !== 'Cancelled',
  );
}

/** The deal that has taken a vehicle off the market, if there is one. */
export function committedDealForVehicle(state: DealerState, vehicleId: Id): Deal | undefined {
  return state.deals.find(
    (deal) => deal.vehicleId === vehicleId && COMMITTED_DEAL_STATUSES.includes(deal.status),
  );
}

export function closedDealForVehicle(state: DealerState, vehicleId: Id): Deal | undefined {
  return state.deals.find((deal) => deal.vehicleId === vehicleId && deal.status === 'Closed');
}

export interface AvailabilityCheck {
  available: boolean;
  reason?: string;
}

/**
 * Whether a vehicle can be promised to a customer right now.
 *
 * This is the single rule that stops the same unit being sold twice, so both
 * the reservation form and the reducer ask it rather than re-deriving it.
 */
export function checkVehicleAvailability(
  state: DealerState,
  vehicleId: Id,
  ignoreReservationId?: Id,
): AvailabilityCheck {
  const vehicle = getVehicle(state, vehicleId);
  if (!vehicle) return { available: false, reason: 'That vehicle is no longer in the system.' };

  if (vehicle.status === 'Sold') {
    return { available: false, reason: `${vehicle.code} has already been sold.` };
  }
  if (UNAVAILABLE_STATUSES.includes(vehicle.status)) {
    return { available: false, reason: `${vehicle.code} is marked ${vehicle.status.toLowerCase()}.` };
  }

  const held = activeReservationForVehicle(state, vehicleId, ignoreReservationId);
  if (held) {
    return {
      available: false,
      reason: `${vehicle.code} is already held by reservation ${held.code}.`,
    };
  }

  // A converted reservation stops holding the vehicle, but the deal it became
  // still does — otherwise the same unit could be promised twice over.
  const committed = committedDealForVehicle(state, vehicleId);
  if (committed) {
    return { available: false, reason: `${vehicle.code} is on open deal ${committed.code}.` };
  }

  return { available: true };
}

export const availableVehicles = (state: DealerState) =>
  state.vehicles.filter((vehicle) => checkVehicleAvailability(state, vehicle.id).available);

/** Days a vehicle has been in stock. Drives the inventory aging report. */
export function daysInStock(vehicle: Vehicle, now = new Date()): number {
  return Math.max(0, daysBetween(parseAny(vehicle.acquiredAt), startOfDay(now)));
}

export const vehicleInterestLeads = (state: DealerState, vehicleId: Id) =>
  state.leads.filter(
    (lead) => lead.vehicleId === vehicleId || lead.alsoInterestedIn.includes(vehicleId),
  );

// ------------------------------------------------------------ deal arithmetic

export interface DealTotals {
  subtotal: Cents;
  tradeCredit: Cents;
  taxableBase: Cents;
  tax: Cents;
  feesTotal: Cents;
  total: Cents;
  /** Money actually recorded against this deal, deposits included. */
  paid: Cents;
  balance: Cents;
  /** What a lender would be asked to cover, on a financed plan. */
  financedAmount: Cents;
}

/**
 * Every figure on a deal, derived from the deal itself and its payments.
 *
 * Trade-in credit reduces the taxable base, which is how most U.S. states treat
 * it, and a trade worth less than its payoff contributes nothing rather than
 * going negative. Fees are added after tax — the demo does not model per-fee
 * taxability, which varies by state and is not what this is demonstrating.
 */
export function dealTotals(state: DealerState, deal: Deal): DealTotals {
  const subtotal = Math.max(0, deal.salePrice - deal.discount);

  const tradeCredit = deal.tradeIn
    ? Math.max(0, deal.tradeIn.allowance - deal.tradeIn.payoff)
    : 0;

  const taxableBase = Math.max(0, subtotal - tradeCredit);
  const tax = percentOf(taxableBase, deal.taxRate);
  const feesTotal = sumCents(deal.fees.map((fee) => fee.amount));
  const total = taxableBase + tax + feesTotal;

  const paid = sumCents(dealPayments(state, deal.id).map((payment) => payment.amount));
  const balance = total - paid;
  const financedAmount = deal.plan === 'Financing' ? Math.max(0, total - deal.downPayment) : 0;

  return { subtotal, tradeCredit, taxableBase, tax, feesTotal, total, paid, balance, financedAmount };
}

export const dealPayments = (state: DealerState, dealId: Id) =>
  state.payments.filter((payment) => payment.dealId === dealId);

export const reservationPayments = (state: DealerState, reservationId: Id) =>
  state.payments.filter((payment) => payment.reservationId === reservationId);

/** Deposit recorded against a reservation. */
export function depositPaid(state: DealerState, reservationId: Id): Cents {
  return sumCents(reservationPayments(state, reservationId).map((payment) => payment.amount));
}

export const customerPayments = (state: DealerState, customerId: Id) =>
  state.payments.filter((payment) => payment.customerId === customerId);

// ------------------------------------------------------------------ documents

export const documentsForDeal = (state: DealerState, dealId: Id) =>
  state.documents.filter((document) => document.dealId === dealId);

export const documentsForCustomer = (state: DealerState, customerId: Id) =>
  state.documents.filter((document) => document.customerId === customerId);

export const documentsForReservation = (state: DealerState, reservationId: Id) =>
  state.documents.filter((document) => document.reservationId === reservationId);

export const isDocumentSatisfied = (document: DocumentRecord) =>
  DOCUMENT_SATISFIED.includes(document.status);

/**
 * Documents a deal cannot close without.
 *
 * Kept deliberately small: a cash deal should not be blocked by paperwork a
 * lender would have wanted, so the financing application only appears on a
 * financed plan.
 */
export function requiredDocumentTypes(deal: Deal): DocumentType[] {
  const base: DocumentType[] = ['Photo ID', 'Deal Summary', 'Proof of Insurance'];
  if (deal.plan === 'Financing') base.push('Financing Application');
  if (deal.tradeIn) base.push('Trade-in Title');
  return base;
}

export interface DocumentReadiness {
  required: DocumentType[];
  satisfied: DocumentType[];
  outstanding: DocumentType[];
  complete: boolean;
}

export function documentReadiness(state: DealerState, deal: Deal): DocumentReadiness {
  const required = requiredDocumentTypes(deal);
  const records = documentsForDeal(state, deal.id);

  const satisfied = required.filter((type) =>
    records.some((record) => record.type === type && isDocumentSatisfied(record)),
  );
  const outstanding = required.filter((type) => !satisfied.includes(type));

  return { required, satisfied, outstanding, complete: outstanding.length === 0 };
}

// ------------------------------------------------------------------ financing

export const financingForDeal = (state: DealerState, dealId: Id) =>
  state.financing.find((application) => application.dealId === dealId);

export const financingForCustomer = (state: DealerState, customerId: Id) =>
  state.financing.filter((application) => application.customerId === customerId);

export const isFinancingCleared = (application?: FinancingApplication) =>
  !!application && FINANCING_CLEARED.includes(application.status);

// ---------------------------------------------------------- deal readiness

export interface CloseReadiness {
  ready: boolean;
  /** Everything still standing between the deal and a close, in plain words. */
  blockers: string[];
}

/**
 * Whether a deal can be closed.
 *
 * A cash deal has to be paid in full; a financed deal only has to have its
 * agreed down payment recorded and a decision written down by the finance desk.
 * Requiring a financed customer to pay the whole balance before delivery would
 * be wrong, and requiring a cash customer to have a lender would be worse.
 */
export function closeReadiness(state: DealerState, deal: Deal): CloseReadiness {
  const blockers: string[] = [];

  if (deal.status === 'Closed') return { ready: false, blockers: ['This deal is already closed.'] };
  if (deal.status === 'Cancelled') return { ready: false, blockers: ['This deal was cancelled.'] };

  const vehicle = getVehicle(state, deal.vehicleId);
  const customer = getCustomer(state, deal.customerId);

  if (!vehicle) blockers.push('The vehicle on this deal no longer exists.');
  else if (vehicle.status === 'Sold' && closedDealForVehicle(state, vehicle.id)?.id !== deal.id) {
    blockers.push(`${vehicle.code} has already been sold on another deal.`);
  }

  if (!customer) blockers.push('The customer on this deal no longer exists.');

  const totals = dealTotals(state, deal);
  if (totals.total <= 0) blockers.push('The deal total has to be greater than zero.');

  const documents = documentReadiness(state, deal);
  if (!documents.complete) {
    blockers.push(`Outstanding documents: ${documents.outstanding.join(', ')}.`);
  }

  if (deal.plan === 'Financing') {
    const application = financingForDeal(state, deal.id);
    if (!application) {
      blockers.push('This is a financed deal with no financing application.');
    } else if (!isFinancingCleared(application)) {
      blockers.push(`Financing ${application.code} is ${application.status.toLowerCase()}.`);
    }
    if (totals.paid < deal.downPayment) {
      blockers.push('The agreed down payment has not been recorded yet.');
    }
  } else if (totals.balance > 0) {
    blockers.push('A cash deal has to be paid in full before it closes.');
  }

  return { ready: blockers.length === 0, blockers };
}

export interface DeliveryReadiness {
  ready: boolean;
  outstanding: string[];
}

export function deliveryReadiness(deal: Deal): DeliveryReadiness {
  const delivery = deal.delivery;
  if (!delivery) return { ready: false, outstanding: ['Delivery has not been started.'] };

  const outstanding: string[] = [];
  if (!delivery.vehicleReady) outstanding.push('Vehicle prepared and inspected');
  if (!delivery.documentsSigned) outstanding.push('Paperwork signed');
  if (!delivery.paymentConfirmed) outstanding.push('Payment confirmed');
  if (!delivery.keysHandedOver) outstanding.push('Keys and vehicle handed over');

  return { ready: outstanding.length === 0, outstanding };
}

export const isDelivered = (deal: Deal) => Boolean(deal.delivery?.completedAt);

// ---------------------------------------------------------------- activity

const sameSubject = (a: ActivitySubject, b: ActivitySubject) => a.kind === b.kind && a.id === b.id;

/** Events attached to a record, newest first. */
export function activityFor(state: DealerState, subject: ActivitySubject): ActivityEvent[] {
  return state.activity
    .filter(
      (event) =>
        sameSubject(event.subject, subject) ||
        event.related.some((related) => sameSubject(related, subject)),
    )
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at));
}

export const recentActivity = (state: DealerState, limit = 12) =>
  state.activity.slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);

// -------------------------------------------------------------------- tasks

export const openTasks = (state: DealerState) => state.tasks.filter((task) => !task.done);

export function tasksDueBy(state: DealerState, days: number, now = new Date()): Task[] {
  return openTasks(state)
    .filter((task) => daysBetween(startOfDay(now), parseAny(task.dueAt)) <= days)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export const tasksFor = (state: DealerState, subject: Partial<Record<'leadId' | 'customerId' | 'vehicleId' | 'dealId' | 'reservationId', Id>>) =>
  state.tasks.filter((task) =>
    Object.entries(subject).every(([key, value]) => task[key as keyof Task] === value),
  );

// ---------------------------------------------------------------- dashboard

export interface DashboardMetrics {
  newLeads: number;
  activeReservations: number;
  vehiclesInStock: number;
  dealsInProgress: number;
  pendingDocuments: number;
  financingUnderReview: number;
  soldThisMonth: number;
  soldThisMonthValue: Cents;
  outstandingBalance: Cents;
  inventoryValue: Cents;
  tasksDue: number;
}

const OPEN_LEAD_STAGES = ['New', 'Contacted', 'Appointment', 'Vehicle Selected', 'Negotiation'];
const IN_PROGRESS_DEAL_STATUSES = [
  'Draft',
  'Negotiation',
  'Pending Documents',
  'Pending Financing',
  'Ready to Close',
];
const REVIEW_FINANCING_STATUSES = ['Submitted', 'Under Review', 'Documents Needed', 'Ready to Submit'];

export function dashboardMetrics(state: DealerState, now = new Date()): DashboardMetrics {
  const month = now.getMonth();
  const year = now.getFullYear();

  const closedThisMonth = state.deals.filter((deal) => {
    if (deal.status !== 'Closed' || !deal.closedAt) return false;
    const date = parseAny(deal.closedAt);
    return date.getMonth() === month && date.getFullYear() === year;
  });

  const openDeals = state.deals.filter((deal) => IN_PROGRESS_DEAL_STATUSES.includes(deal.status));

  return {
    newLeads: state.leads.filter((lead) => OPEN_LEAD_STAGES.includes(lead.stage)).length,
    activeReservations: state.reservations.filter((reservation) =>
      ACTIVE_RESERVATION_STATUSES.includes(reservation.status),
    ).length,
    vehiclesInStock: state.vehicles.filter((vehicle) => vehicle.status === 'In Stock').length,
    dealsInProgress: openDeals.length,
    pendingDocuments: state.documents.filter(
      (document) => document.status === 'Missing' || document.status === 'Requested',
    ).length,
    financingUnderReview: state.financing.filter((application) =>
      REVIEW_FINANCING_STATUSES.includes(application.status),
    ).length,
    soldThisMonth: closedThisMonth.length,
    soldThisMonthValue: sumCents(closedThisMonth.map((deal) => dealTotals(state, deal).total)),
    outstandingBalance: sumCents(
      openDeals.map((deal) => Math.max(0, dealTotals(state, deal).balance)),
    ),
    inventoryValue: sumCents(
      state.vehicles
        .filter((vehicle) => vehicle.status !== 'Sold')
        .map((vehicle) => vehicle.listPrice),
    ),
    tasksDue: tasksDueBy(state, 0).length,
  };
}

/** Reservations whose hold runs out soon, which is what a sales desk chases. */
export function reservationsExpiringSoon(state: DealerState, days = 5, now = new Date()) {
  return state.reservations
    .filter((reservation) => ACTIVE_RESERVATION_STATUSES.includes(reservation.status))
    .filter((reservation) => daysBetween(startOfDay(now), parseAny(reservation.expiresAt)) <= days)
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
}

/** Deals that cannot move without somebody doing something. */
export function dealsNeedingAttention(state: DealerState) {
  return state.deals
    .filter((deal) => IN_PROGRESS_DEAL_STATUSES.includes(deal.status))
    .map((deal) => ({ deal, readiness: closeReadiness(state, deal) }))
    .filter((entry) => entry.readiness.blockers.length > 0)
    .sort((a, b) => b.readiness.blockers.length - a.readiness.blockers.length);
}

// ------------------------------------------------------------------ reports

const bucketize = <T>(items: T[], labels: readonly string[], key: (item: T) => string, amount?: (item: T) => Cents): Bucket[] =>
  labels.map((label) => {
    const matching = items.filter((item) => key(item) === label);
    return {
      label,
      value: matching.length,
      amount: amount ? sumCents(matching.map(amount)) : undefined,
    };
  });

export function leadPipeline(state: DealerState, stages: readonly string[]): Bucket[] {
  return bucketize(state.leads, stages, (lead) => lead.stage);
}

export function leadsBySource(state: DealerState, sources: readonly string[]): Bucket[] {
  return bucketize(state.leads, sources, (lead) => lead.source).filter((bucket) => bucket.value > 0);
}

export function inventoryByStatus(state: DealerState, statuses: readonly string[]): Bucket[] {
  return bucketize(
    state.vehicles,
    statuses,
    (vehicle) => vehicle.status,
    (vehicle) => vehicle.listPrice,
  );
}

export function inventoryByType(state: DealerState, types: readonly string[]): Bucket[] {
  return bucketize(state.vehicles, types, (vehicle) => vehicle.type).filter((bucket) => bucket.value > 0);
}

/** In-stock units grouped by how long they have been sitting. */
export function inventoryAging(state: DealerState, now = new Date()): Bucket[] {
  const bands: { label: string; min: number; max: number }[] = [
    { label: '0–30 days', min: 0, max: 30 },
    { label: '31–60 days', min: 31, max: 60 },
    { label: '61–90 days', min: 61, max: 90 },
    { label: '90+ days', min: 91, max: Number.MAX_SAFE_INTEGER },
  ];

  const unsold = state.vehicles.filter((vehicle) => vehicle.status !== 'Sold');

  return bands.map((band) => {
    const matching = unsold.filter((vehicle) => {
      const age = daysInStock(vehicle, now);
      return age >= band.min && age <= band.max;
    });
    return {
      label: band.label,
      value: matching.length,
      amount: sumCents(matching.map((vehicle) => vehicle.listPrice)),
    };
  });
}

export function dealsByStatus(state: DealerState, statuses: readonly string[]): Bucket[] {
  return bucketize(
    state.deals,
    statuses,
    (deal) => deal.status,
    (deal) => dealTotals(state, deal).total,
  );
}

export function financingByStatus(state: DealerState, statuses: readonly string[]): Bucket[] {
  return bucketize(state.financing, statuses, (application) => application.status).filter(
    (bucket) => bucket.value > 0,
  );
}

export function reservationsByStatus(state: DealerState, statuses: readonly string[]): Bucket[] {
  return bucketize(state.reservations, statuses, (reservation) => reservation.status).filter(
    (bucket) => bucket.value > 0,
  );
}

/** Units sold per salesperson, with the value they closed. */
export function salespersonPerformance(state: DealerState): Bucket[] {
  return state.salespeople
    .map((person) => {
      const closed = state.deals.filter(
        (deal) => deal.salespersonId === person.id && deal.status === 'Closed',
      );
      return {
        label: person.name,
        value: closed.length,
        amount: sumCents(closed.map((deal) => dealTotals(state, deal).total)),
      };
    })
    .sort((a, b) => b.value - a.value);
}

/** Money received per month, for the last `months` months. */
export function paymentsByMonth(state: DealerState, months = 6, now = new Date()): Bucket[] {
  const labels = new Intl.DateTimeFormat('en-US', { month: 'short' });
  const buckets: Bucket[] = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const matching = state.payments.filter((payment) => {
      const received = parseAny(payment.receivedAt);
      return received.getMonth() === date.getMonth() && received.getFullYear() === date.getFullYear();
    });
    buckets.push({
      label: labels.format(date),
      value: matching.length,
      amount: sumCents(matching.map((payment) => payment.amount)),
    });
  }

  return buckets;
}

/** Units sold per month, for the last `months` months. */
export function unitsSoldByMonth(state: DealerState, months = 6, now = new Date()): Bucket[] {
  const labels = new Intl.DateTimeFormat('en-US', { month: 'short' });
  const buckets: Bucket[] = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const matching = state.deals.filter((deal) => {
      if (deal.status !== 'Closed' || !deal.closedAt) return false;
      const closed = parseAny(deal.closedAt);
      return closed.getMonth() === date.getMonth() && closed.getFullYear() === date.getFullYear();
    });
    buckets.push({
      label: labels.format(date),
      value: matching.length,
      amount: sumCents(matching.map((deal) => dealTotals(state, deal).total)),
    });
  }

  return buckets;
}

// -------------------------------------------------------------------- search

export interface SearchResult {
  id: Id;
  label: string;
  meta: string;
  group: 'Leads' | 'Customers' | 'Inventory' | 'Reservations' | 'Deals' | 'Financing';
  href: string;
}

/**
 * Global search across the records a dealership looks things up by: a customer
 * name, a stock number, a demo VIN, a model, a deal or reservation number.
 */
export function searchWorkspace(
  state: DealerState,
  query: string,
  href: {
    lead: (id: Id) => string;
    customer: (id: Id) => string;
    vehicle: (id: Id) => string;
    reservation: (id: Id) => string;
    deal: (id: Id) => string;
    financing: (id: Id) => string;
  },
  limit = 8,
): SearchResult[] {
  const needle = query.trim();
  if (needle.length < 2) return [];

  const results: SearchResult[] = [];

  for (const lead of state.leads) {
    if (matches(needle, lead.name, lead.code, lead.email, lead.phone)) {
      results.push({
        id: lead.id,
        label: lead.name,
        meta: `${lead.code} · ${lead.stage}`,
        group: 'Leads',
        href: href.lead(lead.id),
      });
    }
  }

  for (const customer of state.customers) {
    if (matches(needle, customer.name, customer.code, customer.email, customer.phone)) {
      results.push({
        id: customer.id,
        label: customer.name,
        meta: `${customer.code} · ${customer.address.city}, ${customer.address.state}`,
        group: 'Customers',
        href: href.customer(customer.id),
      });
    }
  }

  for (const vehicle of state.vehicles) {
    if (matches(needle, vehicle.code, vehicle.vin, vehicleTitle(vehicle), vehicle.make, vehicle.model)) {
      results.push({
        id: vehicle.id,
        label: vehicleTitle(vehicle),
        meta: `${vehicle.code} · ${vehicle.status}`,
        group: 'Inventory',
        href: href.vehicle(vehicle.id),
      });
    }
  }

  for (const reservation of state.reservations) {
    const customer = getCustomer(state, reservation.customerId);
    if (matches(needle, reservation.code, customer?.name)) {
      results.push({
        id: reservation.id,
        label: `${reservation.code} · ${customer?.name ?? 'Unknown'}`,
        meta: reservation.status,
        group: 'Reservations',
        href: href.reservation(reservation.id),
      });
    }
  }

  for (const deal of state.deals) {
    const customer = getCustomer(state, deal.customerId);
    if (matches(needle, deal.code, customer?.name)) {
      results.push({
        id: deal.id,
        label: `${deal.code} · ${customer?.name ?? 'Unknown'}`,
        meta: deal.status,
        group: 'Deals',
        href: href.deal(deal.id),
      });
    }
  }

  for (const application of state.financing) {
    const customer = getCustomer(state, application.customerId);
    if (matches(needle, application.code, customer?.name)) {
      results.push({
        id: application.id,
        label: `${application.code} · ${customer?.name ?? 'Unknown'}`,
        meta: application.status,
        group: 'Financing',
        href: href.financing(application.id),
      });
    }
  }

  return results.slice(0, limit);
}

// --------------------------------------------------------------- demo roles

/**
 * Which modules each demo role can reach.
 *
 * Not authentication — a label on a control that changes the navigation, so a
 * visitor can see how the same workspace looks to different parts of a
 * dealership. Closing a sale sits with the manager and finance roles, which is
 * how the separation of duties usually runs on a real floor.
 */
export const ROLE_MODULES: Record<DemoRole, ModuleId[]> = {
  owner: [
    'dashboard',
    'leads',
    'customers',
    'inventory',
    'reservations',
    'deals',
    'financing',
    'payments',
    'documents',
    'tasks',
    'reports',
    'settings',
  ],
  sales: ['dashboard', 'leads', 'customers', 'inventory', 'reservations', 'tasks', 'settings'],
  sales_manager: [
    'dashboard',
    'leads',
    'customers',
    'inventory',
    'reservations',
    'deals',
    'tasks',
    'reports',
    'settings',
  ],
  finance: ['dashboard', 'customers', 'deals', 'financing', 'payments', 'documents', 'settings'],
  operations: ['dashboard', 'inventory', 'reservations', 'deals', 'documents', 'tasks', 'settings'],
};

/** Roles allowed to close a deal and record a sale. */
export const CLOSING_ROLES: DemoRole[] = ['owner', 'sales_manager', 'finance'];

export const canCloseDeals = (role: DemoRole) => CLOSING_ROLES.includes(role);

/** Acquisition cost is a management figure, not a showroom one. */
export const canSeeCost = (role: DemoRole) =>
  role === 'owner' || role === 'sales_manager' || role === 'finance';

// ------------------------------------------------------- customer roll-ups

export interface CustomerSummary {
  customer: Customer;
  reservations: Reservation[];
  deals: Deal[];
  payments: Payment[];
  financing: FinancingApplication[];
  documents: DocumentRecord[];
  totalPaid: Cents;
  openBalance: Cents;
  vehiclesOwned: Vehicle[];
}

export function customerSummary(state: DealerState, customerId: Id): CustomerSummary | undefined {
  const customer = getCustomer(state, customerId);
  if (!customer) return undefined;

  const deals = state.deals.filter((deal) => deal.customerId === customerId);
  const payments = customerPayments(state, customerId);

  return {
    customer,
    reservations: state.reservations.filter((reservation) => reservation.customerId === customerId),
    deals,
    payments,
    financing: financingForCustomer(state, customerId),
    documents: documentsForCustomer(state, customerId),
    totalPaid: sumCents(payments.map((payment) => payment.amount)),
    openBalance: sumCents(
      deals
        .filter((deal) => deal.status !== 'Cancelled')
        .map((deal) => Math.max(0, dealTotals(state, deal).balance)),
    ),
    vehiclesOwned: deals
      .filter((deal) => deal.status === 'Closed')
      .map((deal) => getVehicle(state, deal.vehicleId))
      .filter((vehicle): vehicle is Vehicle => Boolean(vehicle)),
  };
}

export const leadsForCustomer = (state: DealerState, customerId: Id): DealerLead[] =>
  state.leads.filter((lead) => lead.customerId === customerId);
