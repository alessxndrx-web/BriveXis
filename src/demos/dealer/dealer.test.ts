import { describe, expect, it } from 'vitest';
import { buildSeedState } from './dealer.seed';
import { dealerReducer, type DealerAction } from './dealer.reducer';
import { createMemoryRepository, SCHEMA_VERSION } from './dealer.storage';
import {
  ACTIVE_RESERVATION_STATUSES,
  DEAL_STATUSES,
  FINANCING_STATUSES,
  LEAD_STAGES,
  RESERVATION_STATUSES,
  VEHICLE_STATUSES,
  type DealerState,
} from './dealer.types';
import {
  activeReservationForVehicle,
  availableVehicles,
  checkVehicleAvailability,
  closeReadiness,
  customerSummary,
  dashboardMetrics,
  dealTotals,
  dealsByStatus,
  deliveryReadiness,
  documentReadiness,
  financingForDeal,
  getDeal,
  getVehicle,
  inventoryByStatus,
  isFinancingCleared,
  leadPipeline,
  searchWorkspace,
} from './dealer.selectors';
import { demoVin, dollarsToCents, isValidDemoVin, startOfDay, toDateOnly, vehicleTitle } from './dealer.utils';

/**
 * Dealer domain tests.
 *
 * The rules worth protecting here are the ones a dealership cannot get wrong:
 * money has to be exact, a vehicle can only be promised to one customer, and a
 * deal must not close while something is genuinely outstanding.
 */

/**
 * The seed is anchored to the real current day, exactly as the application
 * anchors it. A fixed date here would disagree with the timestamps the reducer
 * writes with `new Date()`, and the suite would pass or fail depending on the
 * month it was run in rather than on the behaviour it is checking.
 */
const TODAY = startOfDay(new Date());
const seed = () => buildSeedState(TODAY);

/** Applies a sequence of actions, so a test reads as the workflow it describes. */
function run(state: DealerState, ...actions: DealerAction[]): DealerState {
  return actions.reduce(dealerReducer, state);
}

const today = toDateOnly(TODAY);

const href = {
  lead: (id: string) => `/l/${id}`,
  customer: (id: string) => `/c/${id}`,
  vehicle: (id: string) => `/v/${id}`,
  reservation: (id: string) => `/r/${id}`,
  deal: (id: string) => `/d/${id}`,
  financing: (id: string) => `/f/${id}`,
};

// --------------------------------------------------------------------- seed

describe('seed data', () => {
  it('builds a coherent workspace', () => {
    const state = seed();
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(state.vehicles.length).toBeGreaterThanOrEqual(25);
    expect(state.leads.length).toBeGreaterThanOrEqual(20);
    expect(state.customers.length).toBeGreaterThanOrEqual(15);
    expect(state.reservations.length).toBeGreaterThanOrEqual(8);
    expect(state.deals.length).toBeGreaterThanOrEqual(10);
    expect(state.financing.length).toBeGreaterThanOrEqual(8);
    expect(state.payments.length).toBeGreaterThanOrEqual(15);
    expect(state.documents.length).toBeGreaterThanOrEqual(20);
    expect(state.tasks.length).toBeGreaterThanOrEqual(15);
    expect(state.salespeople.length).toBeGreaterThanOrEqual(4);
    expect(state.locations.length).toBe(2);
  });

  it('only references records that exist', () => {
    const state = seed();
    const has = (list: { id: string }[], id?: string) => !id || list.some((item) => item.id === id);

    for (const lead of state.leads) {
      expect(has(state.vehicles, lead.vehicleId), `${lead.code} vehicle`).toBe(true);
      expect(has(state.customers, lead.customerId), `${lead.code} customer`).toBe(true);
      expect(has(state.salespeople, lead.salespersonId), `${lead.code} salesperson`).toBe(true);
      expect(LEAD_STAGES).toContain(lead.stage);
    }
    for (const reservation of state.reservations) {
      expect(has(state.customers, reservation.customerId)).toBe(true);
      expect(has(state.vehicles, reservation.vehicleId)).toBe(true);
      expect(RESERVATION_STATUSES).toContain(reservation.status);
    }
    for (const deal of state.deals) {
      expect(has(state.customers, deal.customerId)).toBe(true);
      expect(has(state.vehicles, deal.vehicleId)).toBe(true);
      expect(has(state.reservations, deal.reservationId)).toBe(true);
      expect(DEAL_STATUSES).toContain(deal.status);
    }
    for (const application of state.financing) {
      expect(has(state.deals, application.dealId)).toBe(true);
      expect(FINANCING_STATUSES).toContain(application.status);
    }
    for (const payment of state.payments) {
      expect(has(state.customers, payment.customerId)).toBe(true);
      expect(has(state.deals, payment.dealId)).toBe(true);
      expect(has(state.reservations, payment.reservationId)).toBe(true);
    }
    for (const vehicle of state.vehicles) {
      expect(VEHICLE_STATUSES).toContain(vehicle.status);
      expect(isValidDemoVin(vehicle.vin), `${vehicle.code} VIN`).toBe(true);
    }
  });

  it('never leaves a sold vehicle looking available', () => {
    const state = seed();
    for (const deal of state.deals.filter((entry) => entry.status === 'Closed')) {
      const vehicle = getVehicle(state, deal.vehicleId);
      expect(vehicle?.status, `${deal.code} vehicle`).toBe('Sold');
      expect(checkVehicleAvailability(state, deal.vehicleId).available).toBe(false);
    }
    for (const vehicle of availableVehicles(state)) {
      expect(vehicle.status).toBe('In Stock');
    }
  });

  it('gives every held vehicle exactly one active reservation', () => {
    const state = seed();
    for (const vehicle of state.vehicles.filter((entry) => entry.status === 'Reserved')) {
      const active = state.reservations.filter(
        (reservation) =>
          reservation.vehicleId === vehicle.id &&
          ACTIVE_RESERVATION_STATUSES.includes(reservation.status),
      );
      expect(active, `${vehicle.code}`).toHaveLength(1);
    }
  });

  it('produces demo VINs deterministically and in the right shape', () => {
    expect(demoVin(7)).toBe(demoVin(7));
    expect(demoVin(7)).toHaveLength(17);
    expect(demoVin(7)).not.toBe(demoVin(8));
    // I, O and Q are excluded from VINs because they read as 1 and 0.
    expect(/[IOQ]/.test(demoVin(42))).toBe(false);
    expect(isValidDemoVin('NOT-A-VIN')).toBe(false);
  });
});

// ---------------------------------------------------------------- money

describe('deal arithmetic', () => {
  const baseDeal = (state: DealerState) => {
    const next = run(state, {
      type: 'deal/create',
      id: 'deal-test',
      input: {
        customerId: 'cus-11',
        vehicleId: state.vehicles.find((v) => v.status === 'In Stock')!.id,
        salespersonId: 'sp-2',
        plan: 'Cash',
        salePrice: dollarsToCents(30_000),
        discount: dollarsToCents(1_000),
        taxRate: 10,
        downPayment: 0,
        notes: '',
      },
    });
    return { state: next, deal: getDeal(next, 'deal-test')! };
  };

  it('applies the discount before tax', () => {
    const { state, deal } = baseDeal(seed());
    const totals = dealTotals(state, deal);
    expect(totals.subtotal).toBe(dollarsToCents(29_000));
    expect(totals.tax).toBe(dollarsToCents(2_900));
    expect(totals.total).toBe(dollarsToCents(31_900));
  });

  it('adds fees after tax and keeps the arithmetic in whole cents', () => {
    const start = baseDeal(seed());
    const state = run(
      start.state,
      { type: 'deal/addFee', id: 'deal-test', label: 'Dealer handling', amount: 59_900 },
      { type: 'deal/addFee', id: 'deal-test', label: 'Title', amount: 34_500 },
    );
    const totals = dealTotals(state, getDeal(state, 'deal-test')!);

    expect(totals.feesTotal).toBe(94_400);
    expect(totals.total).toBe(dollarsToCents(31_900) + 94_400);
    expect(Number.isInteger(totals.total)).toBe(true);
    expect(Number.isInteger(totals.tax)).toBe(true);
  });

  it('removes a fee again', () => {
    const start = baseDeal(seed());
    const withFee = run(start.state, {
      type: 'deal/addFee',
      id: 'deal-test',
      label: 'Dealer handling',
      amount: 59_900,
    });
    const feeId = getDeal(withFee, 'deal-test')!.fees[0].id;
    const without = run(withFee, { type: 'deal/removeFee', id: 'deal-test', feeId });
    expect(getDeal(without, 'deal-test')!.fees).toHaveLength(0);
  });

  it('rounds tax to the nearest cent rather than truncating', () => {
    const start = baseDeal(seed());
    // 29,000.00 at 8.815% is 2,556.35 exactly at the half-cent boundary.
    const state = run(start.state, {
      type: 'deal/update',
      id: 'deal-test',
      patch: { taxRate: 8.815 },
    });
    const totals = dealTotals(state, getDeal(state, 'deal-test')!);
    expect(totals.tax).toBe(255_635);
    expect(Number.isInteger(totals.tax)).toBe(true);
  });

  it('credits a trade-in net of its payoff and reduces the taxable base', () => {
    const start = baseDeal(seed());
    const state = run(start.state, {
      type: 'deal/tradeIn',
      id: 'deal-test',
      tradeIn: {
        year: 2015,
        make: 'Ford',
        model: 'Focus',
        mileage: 110_000,
        vin: demoVin(555),
        allowance: dollarsToCents(6_000),
        payoff: dollarsToCents(2_000),
      },
    });
    const totals = dealTotals(state, getDeal(state, 'deal-test')!);

    expect(totals.tradeCredit).toBe(dollarsToCents(4_000));
    expect(totals.taxableBase).toBe(dollarsToCents(25_000));
    expect(totals.tax).toBe(dollarsToCents(2_500));
    expect(totals.total).toBe(dollarsToCents(27_500));
  });

  it('never lets a trade worth less than its payoff go negative', () => {
    const start = baseDeal(seed());
    const state = run(start.state, {
      type: 'deal/tradeIn',
      id: 'deal-test',
      tradeIn: {
        year: 2012,
        make: 'Kia',
        model: 'Rio',
        mileage: 160_000,
        vin: demoVin(556),
        allowance: dollarsToCents(2_000),
        payoff: dollarsToCents(5_000),
      },
    });
    const totals = dealTotals(state, getDeal(state, 'deal-test')!);
    expect(totals.tradeCredit).toBe(0);
    expect(totals.taxableBase).toBe(dollarsToCents(29_000));
  });

  it('tracks the balance down to zero across partial payments', () => {
    const start = baseDeal(seed());
    const deal = getDeal(start.state, 'deal-test')!;
    const total = dealTotals(start.state, deal).total;

    const half = Math.floor(total / 2);
    const afterFirst = run(start.state, {
      type: 'payment/record',
      input: {
        customerId: deal.customerId,
        kind: 'Down Payment',
        amount: half,
        method: 'Card',
        receivedAt: today,
        reference: '',
        dealId: deal.id,
      },
    });
    expect(dealTotals(afterFirst, getDeal(afterFirst, 'deal-test')!).balance).toBe(total - half);

    const afterSecond = run(afterFirst, {
      type: 'payment/record',
      input: {
        customerId: deal.customerId,
        kind: 'Balance Payment',
        amount: total - half,
        method: 'ACH',
        receivedAt: today,
        reference: '',
        dealId: deal.id,
      },
    });
    const totals = dealTotals(afterSecond, getDeal(afterSecond, 'deal-test')!);
    expect(totals.paid).toBe(total);
    expect(totals.balance).toBe(0);
  });

  it('computes the financed amount only on a financed plan', () => {
    const start = baseDeal(seed());
    expect(dealTotals(start.state, getDeal(start.state, 'deal-test')!).financedAmount).toBe(0);

    const financed = run(start.state, {
      type: 'deal/update',
      id: 'deal-test',
      patch: { plan: 'Financing', downPayment: dollarsToCents(5_000) },
    });
    const totals = dealTotals(financed, getDeal(financed, 'deal-test')!);
    expect(totals.financedAmount).toBe(totals.total - dollarsToCents(5_000));
  });

  it('ignores a zero payment', () => {
    const start = baseDeal(seed());
    const after = run(start.state, {
      type: 'payment/record',
      input: {
        customerId: 'cus-11',
        kind: 'Down Payment',
        amount: 0,
        method: 'Cash',
        receivedAt: today,
        reference: '',
        dealId: 'deal-test',
      },
    });
    expect(after.payments.length).toBe(start.state.payments.length);
  });
});

// --------------------------------------------------------- vehicle lifecycle

describe('vehicle availability and reservations', () => {
  const firstAvailable = (state: DealerState) => availableVehicles(state)[0];

  it('reserves a vehicle and marks it Reserved', () => {
    const state = seed();
    const vehicle = firstAvailable(state);

    const after = run(state, {
      type: 'reservation/create',
      id: 'res-new',
      input: {
        customerId: 'cus-11',
        vehicleId: vehicle.id,
        salespersonId: 'sp-4',
        reservedAt: today,
        expiresAt: toDateOnly(new Date(TODAY.getTime() + 7 * 86_400_000)),
        requestedDeposit: 50_000,
        notes: '',
      },
    });

    expect(getVehicle(after, vehicle.id)!.status).toBe('Reserved');
    expect(activeReservationForVehicle(after, vehicle.id)?.id).toBe('res-new');
  });

  it('refuses a second active reservation on the same vehicle', () => {
    const state = seed();
    const vehicle = firstAvailable(state);

    const once = run(state, {
      type: 'reservation/create',
      id: 'res-a',
      input: {
        customerId: 'cus-11',
        vehicleId: vehicle.id,
        salespersonId: 'sp-4',
        reservedAt: today,
        expiresAt: today,
        requestedDeposit: 50_000,
        notes: '',
      },
    });

    const twice = run(once, {
      type: 'reservation/create',
      id: 'res-b',
      input: {
        customerId: 'cus-12',
        vehicleId: vehicle.id,
        salespersonId: 'sp-4',
        reservedAt: today,
        expiresAt: today,
        requestedDeposit: 50_000,
        notes: '',
      },
    });

    expect(twice.reservations.find((entry) => entry.id === 'res-b')).toBeUndefined();
    expect(twice.reservations.filter((entry) => entry.vehicleId === vehicle.id)).toHaveLength(1);

    const check = checkVehicleAvailability(twice, vehicle.id);
    expect(check.available).toBe(false);
    expect(check.reason).toContain('RES-');
  });

  it('releases the vehicle when a reservation is cancelled', () => {
    const state = seed();
    // A vehicle that also has a committed deal shows Pending Sale, which is the
    // stronger state; this test is about a plain hold.
    const reservation = state.reservations.find(
      (entry) =>
        entry.status === 'Confirmed' && getVehicle(state, entry.vehicleId)!.status === 'Reserved',
    )!;
    expect(getVehicle(state, reservation.vehicleId)!.status).toBe('Reserved');

    const after = run(state, { type: 'reservation/cancel', id: reservation.id, reason: 'Changed mind' });

    expect(after.reservations.find((entry) => entry.id === reservation.id)!.status).toBe('Cancelled');
    expect(getVehicle(after, reservation.vehicleId)!.status).toBe('In Stock');
    expect(checkVehicleAvailability(after, reservation.vehicleId).available).toBe(true);
  });

  it('releases the vehicle when a reservation expires', () => {
    const state = seed();
    const reservation = state.reservations.find((entry) => entry.status === 'Pending')!;
    const after = run(state, { type: 'reservation/expire', id: reservation.id });

    expect(after.reservations.find((entry) => entry.id === reservation.id)!.status).toBe('Expired');
    expect(getVehicle(after, reservation.vehicleId)!.status).toBe('In Stock');
  });

  it('refuses to reserve a sold vehicle', () => {
    const state = seed();
    const sold = state.vehicles.find((vehicle) => vehicle.status === 'Sold')!;

    const check = checkVehicleAvailability(state, sold.id);
    expect(check.available).toBe(false);
    expect(check.reason).toContain('sold');

    const after = run(state, {
      type: 'reservation/create',
      id: 'res-sold',
      input: {
        customerId: 'cus-11',
        vehicleId: sold.id,
        salespersonId: 'sp-4',
        reservedAt: today,
        expiresAt: today,
        requestedDeposit: 50_000,
        notes: '',
      },
    });
    expect(after.reservations.find((entry) => entry.id === 'res-sold')).toBeUndefined();
  });

  it('refuses to reserve a vehicle on a manual hold, and releases it again', () => {
    const state = seed();
    const held = state.vehicles.find((vehicle) => vehicle.status === 'Service Hold')!;
    expect(checkVehicleAvailability(state, held.id).available).toBe(false);

    const released = run(state, { type: 'vehicle/status', id: held.id, status: 'In Stock' });
    expect(getVehicle(released, held.id)!.status).toBe('In Stock');
    expect(checkVehicleAvailability(released, held.id).available).toBe(true);
  });

  it('carries the deposit onto the deal when a reservation converts', () => {
    const state = seed();
    const reservation = state.reservations.find(
      (entry) => entry.id === 'res-2' && entry.status === 'Confirmed',
    )!;
    const depositBefore = state.payments.filter(
      (payment) => payment.reservationId === reservation.id,
    );
    expect(depositBefore.length).toBeGreaterThan(0);

    const after = run(state, {
      type: 'deal/create',
      id: 'deal-from-res',
      input: {
        customerId: reservation.customerId,
        vehicleId: reservation.vehicleId,
        salespersonId: reservation.salespersonId,
        reservationId: reservation.id,
        plan: 'Cash',
        salePrice: dollarsToCents(20_000),
        discount: 0,
        taxRate: 0,
        downPayment: 0,
        notes: '',
      },
    });

    expect(after.reservations.find((entry) => entry.id === reservation.id)!.status).toBe(
      'Converted to Deal',
    );
    const totals = dealTotals(after, getDeal(after, 'deal-from-res')!);
    expect(totals.paid).toBe(depositBefore.reduce((sum, payment) => sum + payment.amount, 0));
  });
});

// ------------------------------------------------------------- financing

describe('financing', () => {
  it('records a status without deciding anything itself', () => {
    const state = seed();
    const application = state.financing.find((entry) => entry.status === 'Submitted')!;

    const reviewed = run(state, {
      type: 'financing/status',
      id: application.id,
      status: 'Under Review',
    });
    expect(reviewed.financing.find((entry) => entry.id === application.id)!.status).toBe('Under Review');

    // Nothing moved on its own: the status is exactly what was recorded.
    const approved = run(reviewed, {
      type: 'financing/status',
      id: application.id,
      status: 'Approved',
      notes: 'Approved at 60 months.',
    });
    const after = approved.financing.find((entry) => entry.id === application.id)!;
    expect(after.status).toBe('Approved');
    expect(after.decisionNotes).toBe('Approved at 60 months.');
    expect(after.decisionAt).toBe(today);
    expect(isFinancingCleared(after)).toBe(true);
  });

  it('stamps the submission date when an application is submitted', () => {
    const state = seed();
    const draft = state.financing.find((entry) => entry.status === 'Draft')!;
    const after = run(state, { type: 'financing/status', id: draft.id, status: 'Submitted' });
    expect(after.financing.find((entry) => entry.id === draft.id)!.submittedAt).toBe(today);
  });

  it('moves a financed deal forward on approval and back on a decline', () => {
    const state = seed();
    const application = state.financing.find((entry) => entry.id === 'fin-3')!;
    expect(getDeal(state, application.dealId)!.status).toBe('Pending Financing');

    const approved = run(state, {
      type: 'financing/status',
      id: application.id,
      status: 'Approved',
    });
    expect(getDeal(approved, application.dealId)!.status).toBe('Pending Documents');

    const declined = run(state, {
      type: 'financing/status',
      id: application.id,
      status: 'Declined',
    });
    expect(getDeal(declined, application.dealId)!.status).toBe('Negotiation');
  });

  it('never closes a deal by itself', () => {
    const state = seed();
    const approved = run(state, { type: 'financing/status', id: 'fin-3', status: 'Approved' });
    expect(getDeal(approved, 'deal-5')!.status).not.toBe('Closed');
    expect(getVehicle(approved, getDeal(approved, 'deal-5')!.vehicleId)!.status).not.toBe('Sold');
  });
});

// ----------------------------------------------------------- closing a deal

describe('closing a deal', () => {
  it('refuses to close while documents are outstanding', () => {
    const state = seed();
    const deal = getDeal(state, 'deal-5')!;
    const readiness = closeReadiness(state, deal);

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.join(' ')).toMatch(/document/i);

    const attempted = run(state, { type: 'deal/close', id: deal.id });
    expect(getDeal(attempted, deal.id)!.status).not.toBe('Closed');
    expect(getVehicle(attempted, deal.vehicleId)!.status).not.toBe('Sold');
  });

  it('refuses to close a cash deal that is not paid in full', () => {
    const state = seed();
    const deal = getDeal(state, 'deal-7')!;
    expect(dealTotals(state, deal).balance).toBeGreaterThan(0);
    expect(closeReadiness(state, deal).blockers.join(' ')).toMatch(/paid in full/i);
  });

  it('closes a cash deal once documents and payment are complete', () => {
    let state = seed();
    const deal = getDeal(state, 'deal-7')!;
    const balance = dealTotals(state, deal).balance;

    state = run(state, {
      type: 'payment/record',
      input: {
        customerId: deal.customerId,
        kind: 'Balance Payment',
        amount: balance,
        method: 'ACH',
        receivedAt: today,
        reference: '',
        dealId: deal.id,
      },
    });

    expect(documentReadiness(state, getDeal(state, deal.id)!).complete).toBe(true);
    expect(closeReadiness(state, getDeal(state, deal.id)!).ready).toBe(true);

    state = run(state, { type: 'deal/close', id: deal.id });

    const closed = getDeal(state, deal.id)!;
    expect(closed.status).toBe('Closed');
    expect(closed.closedAt).toBe(today);
    expect(getVehicle(state, deal.vehicleId)!.status).toBe('Sold');
    expect(getVehicle(state, deal.vehicleId)!.soldAt).toBe(today);
    // The vehicle can no longer be promised to anyone else.
    expect(checkVehicleAvailability(state, deal.vehicleId).available).toBe(false);
    // Closing queues the delivery rather than assuming it happened.
    expect(state.tasks.some((task) => task.dealId === deal.id && task.kind === 'Schedule delivery')).toBe(true);
  });

  it('requires a cleared financing decision before a financed deal closes', () => {
    let state = seed();
    const deal = getDeal(state, 'deal-6')!;

    // Satisfy the documents first so financing is the only thing left.
    for (const document of state.documents.filter((entry) => entry.dealId === deal.id)) {
      state = run(state, { type: 'document/status', id: document.id, status: 'Signed' });
    }

    const application = financingForDeal(state, deal.id)!;
    expect(isFinancingCleared(application)).toBe(true);
    expect(closeReadiness(state, getDeal(state, deal.id)!).ready).toBe(true);

    // Withdraw the application and the deal must stop being closable.
    const withdrawn = run(state, {
      type: 'financing/status',
      id: application.id,
      status: 'Withdrawn',
    });
    expect(closeReadiness(withdrawn, getDeal(withdrawn, deal.id)!).ready).toBe(false);
  });

  it('marks the financing completed when the deal closes', () => {
    let state = seed();
    const deal = getDeal(state, 'deal-6')!;
    for (const document of state.documents.filter((entry) => entry.dealId === deal.id)) {
      state = run(state, { type: 'document/status', id: document.id, status: 'Signed' });
    }
    state = run(state, { type: 'deal/close', id: deal.id });

    expect(getDeal(state, deal.id)!.status).toBe('Closed');
    expect(financingForDeal(state, deal.id)!.status).toBe('Completed');
  });

  it('cancelling a deal releases the vehicle', () => {
    const state = seed();
    const deal = getDeal(state, 'deal-10')!;
    const after = run(state, { type: 'deal/cancel', id: deal.id });

    expect(getDeal(after, deal.id)!.status).toBe('Cancelled');
    expect(getVehicle(after, deal.vehicleId)!.status).not.toBe('Pending Sale');
  });
});

// ------------------------------------------------------------------ delivery

describe('delivery', () => {
  it('completes only after the checklist, and queues a post-sale follow-up', () => {
    let state = seed();
    const deal = getDeal(state, 'deal-4')!;
    expect(deal.status).toBe('Closed');
    expect(deliveryReadiness(deal).ready).toBe(false);

    state = run(state, {
      type: 'deal/delivery',
      id: deal.id,
      patch: { keysHandedOver: true },
    });
    expect(deliveryReadiness(getDeal(state, deal.id)!).ready).toBe(true);

    const before = state.tasks.length;
    state = run(state, {
      type: 'deal/completeDelivery',
      id: deal.id,
      notes: 'Collected from the main lot.',
    });

    const delivered = getDeal(state, deal.id)!;
    expect(delivered.delivery?.completedAt).toBe(today);
    expect(state.tasks.length).toBe(before + 1);
    expect(state.tasks.some((task) => task.kind === 'Post-sale follow-up' && task.dealId === deal.id)).toBe(true);
  });

  it('will not complete delivery on a deal that is not closed', () => {
    const state = seed();
    const after = run(state, { type: 'deal/completeDelivery', id: 'deal-8', notes: '' });
    expect(getDeal(after, 'deal-8')!.delivery?.completedAt).toBeUndefined();
  });
});

// ------------------------------------------------------------------- leads

describe('leads', () => {
  it('records a stage change on the timeline', () => {
    const state = seed();
    const before = state.activity.length;
    const after = run(state, { type: 'lead/stage', id: 'lead-1', stage: 'Contacted' });

    expect(after.leads.find((lead) => lead.id === 'lead-1')!.stage).toBe('Contacted');
    expect(after.activity.length).toBe(before + 1);
  });

  it('adds a second vehicle as an additional interest, not a replacement', () => {
    const state = seed();
    const lead = state.leads.find((entry) => entry.id === 'lead-2')!;
    const original = lead.vehicleId!;
    const other = availableVehicles(state).find((vehicle) => vehicle.id !== original)!;

    const after = run(state, { type: 'lead/interest', id: lead.id, vehicleId: other.id });
    const updated = after.leads.find((entry) => entry.id === lead.id)!;

    expect(updated.vehicleId).toBe(original);
    expect(updated.alsoInterestedIn).toContain(other.id);
  });

  it('links a lead to an existing customer instead of duplicating one', () => {
    let state = seed();
    const lead = state.leads.find((entry) => entry.id === 'lead-1')!;
    const count = state.customers.length;

    state = run(state, {
      type: 'customer/create',
      id: 'cus-new',
      input: {
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        address: { line1: '1 Test St', city: 'Denver', state: 'CO', zip: '80202' },
        leadId: lead.id,
        notes: '',
      },
    });

    expect(state.customers.length).toBe(count + 1);
    expect(state.leads.find((entry) => entry.id === lead.id)!.customerId).toBe('cus-new');

    // A second conversion attempt matches the record that already exists.
    const again = run(state, { type: 'lead/convert', id: lead.id });
    expect(again.customers.length).toBe(count + 1);
  });
});

// --------------------------------------------------------------- documents

describe('documents', () => {
  it('stamps the received date the first time a document arrives', () => {
    const state = seed();
    const missing = state.documents.find((entry) => entry.status === 'Missing')!;
    const after = run(state, { type: 'document/status', id: missing.id, status: 'Received' });
    const updated = after.documents.find((entry) => entry.id === missing.id)!;

    expect(updated.status).toBe('Received');
    expect(updated.receivedAt).toBe(today);
  });

  it('counts a document as satisfied once it is received, reviewed or signed', () => {
    let state = seed();
    const deal = getDeal(state, 'deal-8')!;
    expect(documentReadiness(state, deal).complete).toBe(false);

    for (const type of documentReadiness(state, deal).outstanding) {
      state = run(state, {
        type: 'document/create',
        input: {
          type,
          status: 'Received',
          customerId: deal.customerId,
          dealId: deal.id,
          notes: '',
        },
      });
    }
    expect(documentReadiness(state, getDeal(state, deal.id)!).complete).toBe(true);
  });

  it('asks a financed deal for a financing application and a cash deal not to', () => {
    const state = seed();
    const financed = documentReadiness(state, getDeal(state, 'deal-5')!);
    const cash = documentReadiness(state, getDeal(state, 'deal-7')!);

    expect(financed.required).toContain('Financing Application');
    expect(cash.required).not.toContain('Financing Application');
  });
});

// -------------------------------------------------------------- dashboard

describe('dashboard and reports', () => {
  it('computes metrics from the workspace, not from stored totals', () => {
    const state = seed();
    const metrics = dashboardMetrics(state, TODAY);

    expect(metrics.vehiclesInStock).toBe(
      state.vehicles.filter((vehicle) => vehicle.status === 'In Stock').length,
    );
    expect(metrics.activeReservations).toBe(
      state.reservations.filter((entry) => ACTIVE_RESERVATION_STATUSES.includes(entry.status)).length,
    );
    expect(metrics.inventoryValue).toBeGreaterThan(0);
    expect(metrics.pendingDocuments).toBeGreaterThan(0);
  });

  it('moves the metrics when the workspace changes', () => {
    const state = seed();
    const before = dashboardMetrics(state, TODAY);

    const vehicle = availableVehicles(state)[0];
    const after = dashboardMetrics(
      run(state, {
        type: 'reservation/create',
        input: {
          customerId: 'cus-11',
          vehicleId: vehicle.id,
          salespersonId: 'sp-4',
          reservedAt: today,
          expiresAt: today,
          requestedDeposit: 50_000,
          notes: '',
        },
      }),
      TODAY,
    );

    expect(after.activeReservations).toBe(before.activeReservations + 1);
    expect(after.vehiclesInStock).toBe(before.vehiclesInStock - 1);
  });

  it('builds report buckets that add up to the records they describe', () => {
    const state = seed();

    const pipeline = leadPipeline(state, LEAD_STAGES);
    expect(pipeline.reduce((sum, bucket) => sum + bucket.value, 0)).toBe(state.leads.length);

    const inventory = inventoryByStatus(state, VEHICLE_STATUSES);
    expect(inventory.reduce((sum, bucket) => sum + bucket.value, 0)).toBe(state.vehicles.length);

    const deals = dealsByStatus(state, DEAL_STATUSES);
    expect(deals.reduce((sum, bucket) => sum + bucket.value, 0)).toBe(state.deals.length);
  });

  it('rolls a customer record set up into one history', () => {
    const state = seed();
    const summary = customerSummary(state, 'cus-1')!;

    expect(summary.customer.code).toBeTruthy();
    expect(summary.deals.length).toBeGreaterThan(0);
    expect(summary.payments.length).toBeGreaterThan(0);
    expect(summary.vehiclesOwned.length).toBeGreaterThan(0);
    expect(summary.totalPaid).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------------ search

describe('global search', () => {
  it('finds records by the things a dealership looks them up by', () => {
    const state = seed();
    const vehicle = state.vehicles[0];

    expect(searchWorkspace(state, vehicle.code, href).some((r) => r.group === 'Inventory')).toBe(true);
    expect(searchWorkspace(state, vehicle.vin, href).some((r) => r.group === 'Inventory')).toBe(true);
    expect(searchWorkspace(state, vehicle.model, href).some((r) => r.group === 'Inventory')).toBe(true);
    expect(searchWorkspace(state, 'DEA-7001', href).some((r) => r.group === 'Deals')).toBe(true);
    expect(searchWorkspace(state, 'RES-5001', href).some((r) => r.group === 'Reservations')).toBe(true);
    expect(searchWorkspace(state, 'Osvaldo', href).some((r) => r.group === 'Customers')).toBe(true);
  });

  it('ignores a query too short to mean anything', () => {
    expect(searchWorkspace(seed(), 'a', href)).toEqual([]);
  });
});

// ---------------------------------------------------- persistence and reset

describe('persistence and reset', () => {
  it('round-trips the workspace through the repository', () => {
    const repository = createMemoryRepository();
    expect(repository.load().status).toBe('empty');

    const state = run(seed(), { type: 'lead/stage', id: 'lead-1', stage: 'Contacted' });
    repository.save(state);

    const loaded = repository.load();
    expect(loaded.status).toBe('loaded');
    if (loaded.status === 'loaded') {
      expect(loaded.state.leads.find((lead) => lead.id === 'lead-1')!.stage).toBe('Contacted');
    }
  });

  it('reports unusable stored data instead of crashing on it', () => {
    const repository = createMemoryRepository();
    repository.save({ ...seed(), schemaVersion: 999 } as unknown as DealerState);

    const outcome = repository.load();
    expect(outcome.status).toBe('reset');
    if (outcome.status === 'reset') expect(outcome.reason).toBeTruthy();
  });

  it('restores the seed on reset', () => {
    const changed = run(
      seed(),
      { type: 'lead/stage', id: 'lead-1', stage: 'Won' },
      { type: 'reservation/cancel', id: 'res-1' },
    );
    expect(changed.leads.find((lead) => lead.id === 'lead-1')!.stage).toBe('Won');

    const reset = run(changed, { type: 'demo/reset' });
    expect(reset.leads.find((lead) => lead.id === 'lead-1')!.stage).toBe('New');
    expect(reset.reservations.find((entry) => entry.id === 'res-1')!.status).toBe('Confirmed');
    expect(reset.vehicles.length).toBe(seed().vehicles.length);
  });
});

// -------------------------------------------------------------- formatting

describe('formatting', () => {
  it('describes a vehicle the way a dealership does', () => {
    expect(vehicleTitle({ year: 2021, make: 'Toyota', model: 'RAV4', trim: 'XLE' })).toBe(
      '2021 Toyota RAV4 XLE',
    );
    expect(vehicleTitle({ year: 2021, make: 'Toyota', model: 'RAV4' })).toBe('2021 Toyota RAV4');
  });

  it('converts dollars to whole cents without float drift', () => {
    expect(dollarsToCents('1,234.56')).toBe(123_456);
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
    expect(dollarsToCents('$19,999.99')).toBe(1_999_999);
  });
});
