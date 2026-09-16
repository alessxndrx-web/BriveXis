import type {
  ActivityEvent,
  ActivityKind,
  ActivitySubject,
  Cents,
  Customer,
  Deal,
  DealFee,
  DealStatus,
  DealerLead,
  DealerSettings,
  DealerState,
  Delivery,
  DocumentRecord,
  DocumentStatus,
  DocumentType,
  FinancingApplication,
  FinancingStatus,
  Id,
  LeadStage,
  Payment,
  PaymentKind,
  PaymentMethod,
  Reservation,
  Task,
  TaskKind,
  TermPreference,
  TradeIn,
  Vehicle,
  VehicleStatus,
} from './dealer.types';
import { ACTIVE_RESERVATION_STATUSES, COMMITTED_DEAL_STATUSES } from './dealer.types';
import { buildSeedState, seedToday } from './dealer.seed';
import { createId, nextCode, toDateOnly, vehicleTitle } from './dealer.utils';
import {
  activeReservationForVehicle,
  checkVehicleAvailability,
  closeReadiness,
  dealTotals,
  financingForDeal,
  getCustomer,
  getDeal,
  getLead,
  getReservation,
  getVehicle,
} from './dealer.selectors';

/**
 * Every write in the dealer workspace.
 *
 * The reducer is where connected records are kept in step, because that is the
 * only place that sees the whole workspace at once. Confirming a reservation
 * moves the vehicle to Reserved; closing a deal marks the vehicle Sold and the
 * reservation converted. Nothing outside this file changes a status, so the two
 * can never drift.
 *
 * Financing status is the deliberate exception to automation: it only ever
 * changes because somebody recorded a decision. No rule in this file approves,
 * declines or scores anything.
 */

export type DealerAction =
  | { type: 'demo/reset' }
  | { type: 'settings/update'; patch: Partial<DealerSettings> }

  | { type: 'lead/create'; input: LeadInput; id?: Id }
  | { type: 'lead/update'; id: Id; patch: Partial<DealerLead> }
  | { type: 'lead/stage'; id: Id; stage: LeadStage }
  | { type: 'lead/interest'; id: Id; vehicleId: Id }
  | { type: 'lead/convert'; id: Id; customerId?: Id }

  | { type: 'customer/create'; input: CustomerInput; id?: Id }
  | { type: 'customer/update'; id: Id; patch: Partial<Customer> }

  | { type: 'vehicle/create'; input: VehicleInput; id?: Id }
  | { type: 'vehicle/update'; id: Id; patch: Partial<Vehicle> }
  | { type: 'vehicle/status'; id: Id; status: VehicleStatus }

  | { type: 'reservation/create'; input: ReservationInput; id?: Id }
  | { type: 'reservation/confirm'; id: Id }
  | { type: 'reservation/cancel'; id: Id; reason?: string }
  | { type: 'reservation/expire'; id: Id }
  | { type: 'reservation/convert'; id: Id; dealId: Id }

  | { type: 'deal/create'; input: DealInput; id?: Id }
  | { type: 'deal/update'; id: Id; patch: Partial<Deal> }
  | { type: 'deal/status'; id: Id; status: DealStatus }
  | { type: 'deal/addFee'; id: Id; label: string; amount: Cents }
  | { type: 'deal/removeFee'; id: Id; feeId: Id }
  | { type: 'deal/tradeIn'; id: Id; tradeIn?: TradeIn }
  | { type: 'deal/close'; id: Id }
  | { type: 'deal/cancel'; id: Id }
  | { type: 'deal/delivery'; id: Id; patch: Partial<Delivery> }
  | { type: 'deal/completeDelivery'; id: Id; notes: string }

  | { type: 'financing/create'; input: FinancingInput; id?: Id }
  | { type: 'financing/update'; id: Id; patch: Partial<FinancingApplication> }
  | { type: 'financing/status'; id: Id; status: FinancingStatus; notes?: string }

  | { type: 'payment/record'; input: PaymentInput }

  | { type: 'document/create'; input: DocumentInput; id?: Id }
  | { type: 'document/status'; id: Id; status: DocumentStatus; fileLabel?: string }
  | { type: 'document/delete'; id: Id }

  | { type: 'task/create'; input: TaskInput; id?: Id }
  | { type: 'task/toggle'; id: Id }
  | { type: 'task/delete'; id: Id };

// ------------------------------------------------------------------- inputs

export interface LeadInput {
  name: string;
  phone: string;
  email: string;
  source: DealerLead['source'];
  stage: LeadStage;
  vehicleId?: Id;
  budgetMin?: Cents;
  budgetMax?: Cents;
  contactPreference: DealerLead['contactPreference'];
  hasTradeIn: boolean;
  salespersonId: Id;
  appointmentAt?: string;
  appointmentKind?: DealerLead['appointmentKind'];
  nextFollowUpAt?: string;
  notes: string;
}

export interface CustomerInput {
  name: string;
  phone: string;
  email: string;
  address: Customer['address'];
  leadId?: Id;
  notes: string;
}

export type VehicleInput = Omit<Vehicle, 'id' | 'code' | 'status' | 'soldAt'> & {
  status?: VehicleStatus;
};

export interface ReservationInput {
  customerId: Id;
  vehicleId: Id;
  salespersonId: Id;
  reservedAt: string;
  expiresAt: string;
  requestedDeposit: Cents;
  notes: string;
}

export interface DealInput {
  customerId: Id;
  vehicleId: Id;
  salespersonId: Id;
  reservationId?: Id;
  plan: Deal['plan'];
  salePrice: Cents;
  discount: Cents;
  taxRate: number;
  downPayment: Cents;
  notes: string;
}

export interface FinancingInput {
  customerId: Id;
  dealId: Id;
  vehicleId: Id;
  amountRequested: Cents;
  downPayment: Cents;
  termMonths: TermPreference;
  lenderCategory: string;
  financeContactId: Id;
}

export interface PaymentInput {
  customerId: Id;
  kind: PaymentKind;
  amount: Cents;
  method: PaymentMethod;
  receivedAt: string;
  reference: string;
  reservationId?: Id;
  dealId?: Id;
}

export interface DocumentInput {
  type: DocumentType;
  status: DocumentStatus;
  customerId: Id;
  dealId?: Id;
  reservationId?: Id;
  fileLabel?: string;
  notes: string;
}

export interface TaskInput {
  kind: TaskKind;
  title: string;
  dueAt: string;
  assigneeId: Id;
  leadId?: Id;
  customerId?: Id;
  vehicleId?: Id;
  dealId?: Id;
  reservationId?: Id;
  notes: string;
}

// -------------------------------------------------------------------- helpers

const replaceById = <T extends { id: Id }>(items: T[], id: Id, patch: Partial<T>): T[] =>
  items.map((item) => (item.id === id ? { ...item, ...patch } : item));

/**
 * Appends an activity event.
 *
 * `related` is what makes one action show up on every record it touched — a
 * payment appears on the customer, the deal and the vehicle without three
 * copies of the event existing.
 */
function log(
  state: DealerState,
  kind: ActivityKind,
  subject: ActivitySubject,
  message: string,
  related: ActivitySubject[] = [],
  actorId?: Id,
): ActivityEvent[] {
  const event: ActivityEvent = {
    id: createId('act'),
    kind,
    at: new Date().toISOString(),
    subject,
    related,
    actorId: actorId ?? state.salespeople[0]?.id ?? 'system',
    message,
  };
  return [...state.activity, event];
}

const subject = (kind: ActivitySubject['kind'], id: Id): ActivitySubject => ({ kind, id });

/**
 * Recomputes a vehicle's status from the records that actually constrain it.
 *
 * Called after anything that could change availability. Deriving the status in
 * one place is what stops a cancelled reservation leaving a car stuck on
 * Reserved, or a closed deal leaving one showing as available.
 */
function syncVehicleStatus(state: DealerState, vehicleId: Id): DealerState {
  const vehicle = getVehicle(state, vehicleId);
  if (!vehicle) return state;

  // Manual holds are a human decision and are never overridden here.
  if (vehicle.status === 'Service Hold' || vehicle.status === 'Unavailable') return state;

  const closedDeal = state.deals.find(
    (deal) => deal.vehicleId === vehicleId && deal.status === 'Closed',
  );
  if (closedDeal) {
    return vehicle.status === 'Sold'
      ? state
      : { ...state, vehicles: replaceById(state.vehicles, vehicleId, { status: 'Sold' }) };
  }

  const openDeal = state.deals.find(
    (deal) => deal.vehicleId === vehicleId && COMMITTED_DEAL_STATUSES.includes(deal.status),
  );
  if (openDeal) {
    return vehicle.status === 'Pending Sale'
      ? state
      : { ...state, vehicles: replaceById(state.vehicles, vehicleId, { status: 'Pending Sale' }) };
  }

  const held = state.reservations.find(
    (reservation) =>
      reservation.vehicleId === vehicleId &&
      ACTIVE_RESERVATION_STATUSES.includes(reservation.status),
  );
  const next: VehicleStatus = held ? 'Reserved' : 'In Stock';

  return vehicle.status === next
    ? state
    : { ...state, vehicles: replaceById(state.vehicles, vehicleId, { status: next, soldAt: undefined }) };
}

// ------------------------------------------------------------------- reducer

export function dealerReducer(state: DealerState, action: DealerAction): DealerState {
  switch (action.type) {
    case 'demo/reset':
      return buildSeedState(seedToday());

    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    // ------------------------------------------------------------------ leads

    case 'lead/create': {
      const { code, counters } = nextCode(state.counters, 'lead');
      const lead: DealerLead = {
        id: action.id ?? createId('lead'),
        code,
        name: action.input.name,
        phone: action.input.phone,
        email: action.input.email,
        source: action.input.source,
        stage: action.input.stage,
        vehicleId: action.input.vehicleId,
        alsoInterestedIn: [],
        budgetMin: action.input.budgetMin,
        budgetMax: action.input.budgetMax,
        contactPreference: action.input.contactPreference,
        hasTradeIn: action.input.hasTradeIn,
        salespersonId: action.input.salespersonId,
        appointmentAt: action.input.appointmentAt,
        appointmentKind: action.input.appointmentKind,
        nextFollowUpAt: action.input.nextFollowUpAt,
        notes: action.input.notes,
        createdAt: new Date().toISOString(),
      };

      return {
        ...state,
        counters,
        leads: [lead, ...state.leads],
        activity: log(state, 'lead.created', subject('lead', lead.id), `Lead ${lead.code} created for ${lead.name}.`),
      };
    }

    case 'lead/update':
      return { ...state, leads: replaceById(state.leads, action.id, action.patch) };

    case 'lead/stage': {
      const lead = getLead(state, action.id);
      if (!lead || lead.stage === action.stage) return state;
      return {
        ...state,
        leads: replaceById(state.leads, action.id, { stage: action.stage }),
        activity: log(
          state,
          'lead.stage',
          subject('lead', action.id),
          `${lead.code} moved from ${lead.stage} to ${action.stage}.`,
        ),
      };
    }

    case 'lead/interest': {
      const lead = getLead(state, action.id);
      const vehicle = getVehicle(state, action.vehicleId);
      if (!lead || !vehicle) return state;

      // The first vehicle becomes the primary interest; later ones are added
      // alongside it rather than replacing what the shopper already asked about.
      const patch: Partial<DealerLead> = lead.vehicleId
        ? lead.vehicleId === action.vehicleId || lead.alsoInterestedIn.includes(action.vehicleId)
          ? {}
          : { alsoInterestedIn: [...lead.alsoInterestedIn, action.vehicleId] }
        : { vehicleId: action.vehicleId, stage: lead.stage === 'New' ? 'Vehicle Selected' : lead.stage };

      if (Object.keys(patch).length === 0) return state;

      return {
        ...state,
        leads: replaceById(state.leads, action.id, patch),
        activity: log(
          state,
          'vehicle.interest',
          subject('lead', action.id),
          `${lead.code} is interested in ${vehicle.code} — ${vehicleTitle(vehicle)}.`,
          [subject('vehicle', action.vehicleId)],
        ),
      };
    }

    case 'lead/convert': {
      const lead = getLead(state, action.id);
      if (!lead || lead.customerId) return state;

      // An existing customer is matched by email or phone so the same person
      // does not end up with two records after a second visit.
      const existing =
        (action.customerId ? getCustomer(state, action.customerId) : undefined) ??
        state.customers.find(
          (customer) =>
            (lead.email && customer.email.toLowerCase() === lead.email.toLowerCase()) ||
            (lead.phone && customer.phone.replace(/\D/g, '') === lead.phone.replace(/\D/g, '')),
        );

      if (!existing) return state;

      return {
        ...state,
        leads: replaceById(state.leads, action.id, { customerId: existing.id }),
        activity: log(
          state,
          'lead.converted',
          subject('lead', action.id),
          `${lead.code} linked to customer ${existing.code}.`,
          [subject('customer', existing.id)],
        ),
      };
    }

    // -------------------------------------------------------------- customers

    case 'customer/create': {
      const { code, counters } = nextCode(state.counters, 'customer');
      const customer: Customer = {
        id: action.id ?? createId('cus'),
        code,
        name: action.input.name,
        phone: action.input.phone,
        email: action.input.email,
        address: action.input.address,
        leadId: action.input.leadId,
        customerSince: toDateOnly(new Date()),
        notes: action.input.notes,
      };

      const leads = action.input.leadId
        ? replaceById(state.leads, action.input.leadId, { customerId: customer.id })
        : state.leads;

      return {
        ...state,
        counters,
        customers: [customer, ...state.customers],
        leads,
        activity: log(
          state,
          'lead.converted',
          subject('customer', customer.id),
          `Customer record created for ${customer.name}.`,
          action.input.leadId ? [subject('lead', action.input.leadId)] : [],
        ),
      };
    }

    case 'customer/update':
      return { ...state, customers: replaceById(state.customers, action.id, action.patch) };

    // --------------------------------------------------------------- vehicles

    case 'vehicle/create': {
      const { code, counters } = nextCode(state.counters, 'vehicle');
      const vehicle: Vehicle = {
        ...action.input,
        id: action.id ?? createId('veh'),
        code,
        status: action.input.status ?? 'In Stock',
      };
      return {
        ...state,
        counters,
        vehicles: [vehicle, ...state.vehicles],
        activity: log(
          state,
          'vehicle.created',
          subject('vehicle', vehicle.id),
          `${vehicle.code} added to inventory — ${vehicleTitle(vehicle)}.`,
        ),
      };
    }

    case 'vehicle/update':
      return { ...state, vehicles: replaceById(state.vehicles, action.id, action.patch) };

    case 'vehicle/status': {
      const vehicle = getVehicle(state, action.id);
      if (!vehicle || vehicle.status === action.status) return state;

      const next: DealerState = {
        ...state,
        vehicles: replaceById(state.vehicles, action.id, { status: action.status }),
        activity: log(
          state,
          'vehicle.status',
          subject('vehicle', action.id),
          `${vehicle.code} marked ${action.status}.`,
        ),
      };

      // Releasing a manual hold hands the vehicle back to whatever its records say.
      return action.status === 'In Stock' ? syncVehicleStatus(next, action.id) : next;
    }

    // ----------------------------------------------------------- reservations

    case 'reservation/create': {
      // The availability rule lives in one place and is enforced here, so no
      // screen can create a second hold on the same vehicle by accident.
      if (!checkVehicleAvailability(state, action.input.vehicleId).available) return state;

      const { code, counters } = nextCode(state.counters, 'reservation');
      const reservation: Reservation = {
        id: action.id ?? createId('res'),
        code,
        customerId: action.input.customerId,
        vehicleId: action.input.vehicleId,
        salespersonId: action.input.salespersonId,
        status: 'Pending',
        reservedAt: action.input.reservedAt,
        expiresAt: action.input.expiresAt,
        requestedDeposit: action.input.requestedDeposit,
        notes: action.input.notes,
      };

      const vehicle = getVehicle(state, reservation.vehicleId);
      const withReservation: DealerState = {
        ...state,
        counters,
        reservations: [reservation, ...state.reservations],
        activity: log(
          state,
          'reservation.created',
          subject('reservation', reservation.id),
          `${reservation.code} created on ${vehicle?.code ?? 'a vehicle'}.`,
          [subject('vehicle', reservation.vehicleId), subject('customer', reservation.customerId)],
        ),
      };

      return syncVehicleStatus(withReservation, reservation.vehicleId);
    }

    case 'reservation/confirm': {
      const reservation = getReservation(state, action.id);
      if (!reservation || reservation.status !== 'Pending') return state;

      const confirmed: DealerState = {
        ...state,
        reservations: replaceById(state.reservations, action.id, { status: 'Confirmed' }),
        activity: log(
          state,
          'reservation.confirmed',
          subject('reservation', action.id),
          `${reservation.code} confirmed.`,
          [subject('vehicle', reservation.vehicleId), subject('customer', reservation.customerId)],
        ),
      };

      return syncVehicleStatus(confirmed, reservation.vehicleId);
    }

    case 'reservation/cancel':
    case 'reservation/expire': {
      const reservation = getReservation(state, action.id);
      if (!reservation || !ACTIVE_RESERVATION_STATUSES.includes(reservation.status)) return state;

      const status = action.type === 'reservation/cancel' ? 'Cancelled' : 'Expired';
      const reason = action.type === 'reservation/cancel' ? action.reason : undefined;

      const released: DealerState = {
        ...state,
        reservations: replaceById(state.reservations, action.id, { status }),
        activity: log(
          state,
          'reservation.cancelled',
          subject('reservation', action.id),
          reason
            ? `${reservation.code} ${status.toLowerCase()} — ${reason}`
            : `${reservation.code} ${status.toLowerCase()}.`,
          [subject('vehicle', reservation.vehicleId), subject('customer', reservation.customerId)],
        ),
      };

      // The vehicle goes back to whatever its remaining records justify.
      return syncVehicleStatus(released, reservation.vehicleId);
    }

    case 'reservation/convert': {
      const reservation = getReservation(state, action.id);
      if (!reservation) return state;

      return {
        ...state,
        reservations: replaceById(state.reservations, action.id, {
          status: 'Converted to Deal',
          dealId: action.dealId,
        }),
        activity: log(
          state,
          'reservation.converted',
          subject('reservation', action.id),
          `${reservation.code} converted to a deal.`,
          [subject('deal', action.dealId), subject('vehicle', reservation.vehicleId)],
        ),
      };
    }

    // ------------------------------------------------------------------ deals

    case 'deal/create': {
      const { code, counters } = nextCode(state.counters, 'deal');
      const deal: Deal = {
        id: action.id ?? createId('deal'),
        code,
        customerId: action.input.customerId,
        vehicleId: action.input.vehicleId,
        salespersonId: action.input.salespersonId,
        reservationId: action.input.reservationId,
        status: 'Draft',
        plan: action.input.plan,
        salePrice: action.input.salePrice,
        discount: action.input.discount,
        fees: [],
        taxRate: action.input.taxRate,
        downPayment: action.input.downPayment,
        openedAt: toDateOnly(new Date()),
        notes: action.input.notes,
      };

      let next: DealerState = {
        ...state,
        counters,
        deals: [deal, ...state.deals],
        activity: log(
          state,
          'deal.created',
          subject('deal', deal.id),
          `${deal.code} opened.`,
          [subject('vehicle', deal.vehicleId), subject('customer', deal.customerId)],
        ),
      };

      // A deal made from a reservation takes the reservation with it, deposit
      // included: money already paid has to count against what is now owed.
      if (deal.reservationId) {
        next = dealerReducer(next, { type: 'reservation/convert', id: deal.reservationId, dealId: deal.id });
        next = {
          ...next,
          payments: next.payments.map((payment) =>
            payment.reservationId === deal.reservationId ? { ...payment, dealId: deal.id } : payment,
          ),
        };
      }

      return syncVehicleStatus(next, deal.vehicleId);
    }

    case 'deal/update': {
      const updated = { ...state, deals: replaceById(state.deals, action.id, action.patch) };
      const deal = getDeal(updated, action.id);
      return deal ? syncVehicleStatus(updated, deal.vehicleId) : updated;
    }

    case 'deal/status': {
      const deal = getDeal(state, action.id);
      if (!deal || deal.status === action.status) return state;

      const next: DealerState = {
        ...state,
        deals: replaceById(state.deals, action.id, { status: action.status }),
        activity: log(
          state,
          'deal.status',
          subject('deal', action.id),
          `${deal.code} moved from ${deal.status} to ${action.status}.`,
          [subject('vehicle', deal.vehicleId), subject('customer', deal.customerId)],
        ),
      };

      return syncVehicleStatus(next, deal.vehicleId);
    }

    case 'deal/addFee': {
      const deal = getDeal(state, action.id);
      if (!deal) return state;
      const fee: DealFee = { id: createId('fee'), label: action.label, amount: action.amount };
      return { ...state, deals: replaceById(state.deals, action.id, { fees: [...deal.fees, fee] }) };
    }

    case 'deal/removeFee': {
      const deal = getDeal(state, action.id);
      if (!deal) return state;
      return {
        ...state,
        deals: replaceById(state.deals, action.id, {
          fees: deal.fees.filter((fee) => fee.id !== action.feeId),
        }),
      };
    }

    case 'deal/tradeIn':
      return { ...state, deals: replaceById(state.deals, action.id, { tradeIn: action.tradeIn }) };

    case 'deal/close': {
      const deal = getDeal(state, action.id);
      if (!deal) return state;

      // The same readiness rule the screen shows is the one enforced here, so a
      // stale button or a deep link cannot close an incomplete deal.
      if (!closeReadiness(state, deal).ready) return state;

      const today = toDateOnly(new Date());

      let next: DealerState = {
        ...state,
        deals: replaceById(state.deals, action.id, {
          status: 'Closed',
          closedAt: today,
          delivery: deal.delivery ?? {
            vehicleReady: false,
            documentsSigned: false,
            paymentConfirmed: true,
            insuranceProvided: false,
            keysHandedOver: false,
            notes: '',
          },
        }),
        vehicles: replaceById(state.vehicles, deal.vehicleId, { status: 'Sold', soldAt: today }),
        activity: log(
          state,
          'deal.closed',
          subject('deal', action.id),
          `${deal.code} closed. Vehicle marked sold.`,
          [subject('vehicle', deal.vehicleId), subject('customer', deal.customerId)],
        ),
      };

      if (deal.reservationId) {
        const reservation = getReservation(next, deal.reservationId);
        if (reservation && reservation.status !== 'Converted to Deal') {
          next = dealerReducer(next, {
            type: 'reservation/convert',
            id: deal.reservationId,
            dealId: deal.id,
          });
        }
      }

      const financing = financingForDeal(next, deal.id);
      if (financing && financing.status !== 'Completed') {
        next = {
          ...next,
          financing: replaceById(next.financing, financing.id, { status: 'Completed' }),
        };
      }

      // Delivery is the next thing anyone has to do, so it is queued, not assumed.
      return dealerReducer(next, {
        type: 'task/create',
        input: {
          kind: 'Schedule delivery',
          title: `Schedule delivery for ${deal.code}`,
          dueAt: today,
          assigneeId: deal.salespersonId,
          customerId: deal.customerId,
          vehicleId: deal.vehicleId,
          dealId: deal.id,
          notes: '',
        },
      });
    }

    case 'deal/cancel': {
      const deal = getDeal(state, action.id);
      if (!deal || deal.status === 'Closed') return state;

      const cancelled: DealerState = {
        ...state,
        deals: replaceById(state.deals, action.id, { status: 'Cancelled' }),
        activity: log(
          state,
          'deal.status',
          subject('deal', action.id),
          `${deal.code} cancelled.`,
          [subject('vehicle', deal.vehicleId), subject('customer', deal.customerId)],
        ),
      };

      return syncVehicleStatus(cancelled, deal.vehicleId);
    }

    case 'deal/delivery': {
      const deal = getDeal(state, action.id);
      if (!deal) return state;

      const delivery: Delivery = {
        vehicleReady: false,
        documentsSigned: false,
        paymentConfirmed: false,
        insuranceProvided: false,
        keysHandedOver: false,
        notes: '',
        ...deal.delivery,
        ...action.patch,
      };

      return { ...state, deals: replaceById(state.deals, action.id, { delivery }) };
    }

    case 'deal/completeDelivery': {
      const deal = getDeal(state, action.id);
      if (!deal || !deal.delivery || deal.status !== 'Closed') return state;

      const today = toDateOnly(new Date());
      const delivery: Delivery = { ...deal.delivery, completedAt: today, notes: action.notes };

      const delivered: DealerState = {
        ...state,
        deals: replaceById(state.deals, action.id, { delivery }),
        activity: log(
          state,
          'delivery.completed',
          subject('deal', action.id),
          `${deal.code} delivered to the customer.`,
          [subject('vehicle', deal.vehicleId), subject('customer', deal.customerId)],
        ),
      };

      // Every delivery earns a follow-up; that is the whole point of recording it.
      return dealerReducer(delivered, {
        type: 'task/create',
        input: {
          kind: 'Post-sale follow-up',
          title: `Post-sale follow-up for ${deal.code}`,
          dueAt: toDateOnly(new Date(Date.now() + 7 * 86_400_000)),
          assigneeId: deal.salespersonId,
          customerId: deal.customerId,
          vehicleId: deal.vehicleId,
          dealId: deal.id,
          notes: '',
        },
      });
    }

    // -------------------------------------------------------------- financing

    case 'financing/create': {
      const { code, counters } = nextCode(state.counters, 'financing');
      const application: FinancingApplication = {
        id: action.id ?? createId('fin'),
        code,
        customerId: action.input.customerId,
        dealId: action.input.dealId,
        vehicleId: action.input.vehicleId,
        status: 'Draft',
        amountRequested: action.input.amountRequested,
        downPayment: action.input.downPayment,
        termMonths: action.input.termMonths,
        lenderCategory: action.input.lenderCategory,
        financeContactId: action.input.financeContactId,
        decisionNotes: '',
        createdAt: new Date().toISOString(),
      };

      return {
        ...state,
        counters,
        financing: [application, ...state.financing],
        activity: log(
          state,
          'financing.created',
          subject('financing', application.id),
          `${application.code} opened for review.`,
          [subject('deal', application.dealId), subject('customer', application.customerId)],
        ),
      };
    }

    case 'financing/update':
      return { ...state, financing: replaceById(state.financing, action.id, action.patch) };

    case 'financing/status': {
      const application = state.financing.find((entry) => entry.id === action.id);
      if (!application || application.status === action.status) return state;

      const today = toDateOnly(new Date());
      const patch: Partial<FinancingApplication> = { status: action.status };
      if (action.notes !== undefined) patch.decisionNotes = action.notes;
      if (action.status === 'Submitted') patch.submittedAt = today;
      if (['Approved', 'Conditionally Approved', 'Declined'].includes(action.status)) {
        patch.decisionAt = today;
      }

      let next: DealerState = {
        ...state,
        financing: replaceById(state.financing, action.id, patch),
        activity: log(
          state,
          'financing.status',
          subject('financing', action.id),
          `${application.code} recorded as ${action.status}.`,
          [subject('deal', application.dealId), subject('customer', application.customerId)],
        ),
      };

      // A recorded decision moves the deal to the state that decision implies.
      // It never closes the sale — that stays a person's decision.
      const deal = getDeal(next, application.dealId);
      if (deal && deal.status !== 'Closed' && deal.status !== 'Cancelled') {
        if (action.status === 'Declined' && deal.status === 'Pending Financing') {
          next = dealerReducer(next, { type: 'deal/status', id: deal.id, status: 'Negotiation' });
        } else if (
          (action.status === 'Approved' || action.status === 'Conditionally Approved') &&
          deal.status === 'Pending Financing'
        ) {
          next = dealerReducer(next, { type: 'deal/status', id: deal.id, status: 'Pending Documents' });
        }
      }

      return next;
    }

    // --------------------------------------------------------------- payments

    case 'payment/record': {
      const amount = Math.round(action.input.amount);
      if (amount === 0) return state;

      const { code, counters } = nextCode(state.counters, 'payment');
      const payment: Payment = {
        id: createId('pay'),
        code,
        customerId: action.input.customerId,
        kind: action.input.kind,
        reservationId: action.input.reservationId,
        dealId: action.input.dealId,
        amount,
        method: action.input.method,
        receivedAt: action.input.receivedAt,
        reference: action.input.reference,
      };

      const related: ActivitySubject[] = [subject('customer', payment.customerId)];
      if (payment.dealId) related.push(subject('deal', payment.dealId));
      if (payment.reservationId) related.push(subject('reservation', payment.reservationId));

      return {
        ...state,
        counters,
        payments: [payment, ...state.payments],
        activity: log(
          state,
          'payment.recorded',
          subject('payment', payment.id),
          `${payment.code} recorded — ${payment.kind}.`,
          related,
        ),
      };
    }

    // -------------------------------------------------------------- documents

    case 'document/create': {
      const { code, counters } = nextCode(state.counters, 'document');
      const today = toDateOnly(new Date());
      const document: DocumentRecord = {
        id: action.id ?? createId('doc'),
        code,
        type: action.input.type,
        status: action.input.status,
        customerId: action.input.customerId,
        dealId: action.input.dealId,
        reservationId: action.input.reservationId,
        fileLabel: action.input.fileLabel,
        requestedAt: action.input.status === 'Requested' ? today : undefined,
        receivedAt: ['Received', 'Reviewed', 'Signed'].includes(action.input.status) ? today : undefined,
        notes: action.input.notes,
      };

      const related: ActivitySubject[] = [subject('customer', document.customerId)];
      if (document.dealId) related.push(subject('deal', document.dealId));

      return {
        ...state,
        counters,
        documents: [document, ...state.documents],
        activity: log(
          state,
          'document.updated',
          subject('document', document.id),
          `${document.type} recorded as ${document.status}.`,
          related,
        ),
      };
    }

    case 'document/status': {
      const document = state.documents.find((entry) => entry.id === action.id);
      if (!document) return state;

      const today = toDateOnly(new Date());
      const patch: Partial<DocumentRecord> = { status: action.status };
      if (action.fileLabel !== undefined) patch.fileLabel = action.fileLabel;
      if (action.status === 'Requested' && !document.requestedAt) patch.requestedAt = today;
      if (['Received', 'Reviewed', 'Signed'].includes(action.status) && !document.receivedAt) {
        patch.receivedAt = today;
      }

      const related: ActivitySubject[] = [subject('customer', document.customerId)];
      if (document.dealId) related.push(subject('deal', document.dealId));

      return {
        ...state,
        documents: replaceById(state.documents, action.id, patch),
        activity: log(
          state,
          'document.updated',
          subject('document', action.id),
          `${document.type} updated to ${action.status}.`,
          related,
        ),
      };
    }

    case 'document/delete':
      return { ...state, documents: state.documents.filter((entry) => entry.id !== action.id) };

    // ------------------------------------------------------------------ tasks

    case 'task/create': {
      const { code, counters } = nextCode(state.counters, 'task');
      const task: Task = {
        id: action.id ?? createId('task'),
        code,
        kind: action.input.kind,
        title: action.input.title,
        dueAt: action.input.dueAt,
        done: false,
        assigneeId: action.input.assigneeId,
        leadId: action.input.leadId,
        customerId: action.input.customerId,
        vehicleId: action.input.vehicleId,
        dealId: action.input.dealId,
        reservationId: action.input.reservationId,
        notes: action.input.notes,
      };

      const related: ActivitySubject[] = [];
      if (task.leadId) related.push(subject('lead', task.leadId));
      if (task.customerId) related.push(subject('customer', task.customerId));
      if (task.dealId) related.push(subject('deal', task.dealId));
      if (task.reservationId) related.push(subject('reservation', task.reservationId));

      return {
        ...state,
        counters,
        tasks: [task, ...state.tasks],
        activity: log(state, 'task.created', subject('task', task.id), `Task created: ${task.title}.`, related),
      };
    }

    case 'task/toggle': {
      const task = state.tasks.find((entry) => entry.id === action.id);
      if (!task) return state;

      const done = !task.done;
      return {
        ...state,
        tasks: replaceById(state.tasks, action.id, { done }),
        activity: done
          ? log(state, 'task.completed', subject('task', action.id), `Task completed: ${task.title}.`)
          : state.activity,
      };
    }

    case 'task/delete':
      return { ...state, tasks: state.tasks.filter((entry) => entry.id !== action.id) };

    default:
      return state;
  }
}

/** Convenience used by the deal screen: what a payment would leave outstanding. */
export function remainingAfter(state: DealerState, deal: Deal, amount: Cents): Cents {
  return dealTotals(state, deal).balance - amount;
}

/** Re-exported so forms can ask before offering a vehicle. */
export { activeReservationForVehicle, checkVehicleAvailability };
