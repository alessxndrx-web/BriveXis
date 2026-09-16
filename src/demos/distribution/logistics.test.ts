import { describe, expect, it } from 'vitest';
import { blankWorkspace } from './distribution.fixtures';
import { distributionReducer, type Command } from './distribution.reducer';
import { stock } from './distribution.selectors';
import { returnedQuantity } from './domain/logistics';
import type { DistributionState } from './distribution.types';

/**
 * Transfers and returns.
 *
 * Both of these move physical stock, so the thing worth protecting is that the
 * total never changes by accident: a transfer must conserve global inventory
 * across the whole round trip, and a return must add stock exactly once and
 * only when the goods are actually sellable.
 */

let sequence = 0;
const run = (state: DistributionState, command: Command, at = '2026-10-01T10:00:00.000Z') =>
  distributionReducer(state, { ...command, id: `op-${(sequence += 1)}`, at } as never);

const expectRejected = (state: DistributionState, command: Command, message: RegExp) =>
  expect(() => run(state, command)).toThrow(message);

/** Every unit in the workspace, across every product and warehouse. */
const globalUnits = (state: DistributionState) =>
  state.movements.reduce((sum, row) => sum + row.quantity, 0);

const seed = () =>
  blankWorkspace([
    ['gloves', 'dallas', 60],
    ['gloves', 'austin', 20],
    ['tape', 'dallas', 40],
  ]);

describe('warehouse transfers', () => {
  const draft = (state: DistributionState, quantity: number) =>
    run(state, {
      type: 'transfer/save',
      transfer: {
        id: 'transfer-test',
        code: '',
        productId: state.products[0].id,
        from: 'dallas',
        to: 'austin',
        quantity,
        status: 'Draft',
        date: '2026-10-01',
        note: 'Rebalancing stock',
      },
    });

  it('leaves inventory untouched while the transfer is a draft', () => {
    const state = seed();
    const before = stock(state, state.products[0].id, 'dallas').onHand;
    const next = draft(state, 5);

    expect(next.transfers).toHaveLength(1);
    expect(next.transfers[0].status).toBe('Draft');
    expect(next.transfers[0].code).toMatch(/^TRF-/);
    expect(stock(next, state.products[0].id, 'dallas').onHand).toBe(before);
    expect(globalUnits(next)).toBe(globalUnits(state));
  });

  it('moves stock out on shipment and in on receipt, conserving the global total', () => {
    const state = seed();
    const product = state.products[0].id;
    const startDallas = stock(state, product, 'dallas').onHand;
    const startAustin = stock(state, product, 'austin').onHand;
    const startGlobal = globalUnits(state);

    const shipped = run(draft(state, 5), { type: 'transfer/ship', transferId: 'transfer-test' });

    // In transit: gone from the source, not yet at the destination. The units
    // exist in neither building, which is the honest intermediate state.
    expect(shipped.transfers[0].status).toBe('In Transit');
    expect(stock(shipped, product, 'dallas').onHand).toBe(startDallas - 5);
    expect(stock(shipped, product, 'austin').onHand).toBe(startAustin);
    expect(globalUnits(shipped)).toBe(startGlobal - 5);

    const received = run(shipped, { type: 'transfer/receive', transferId: 'transfer-test' });

    expect(received.transfers[0].status).toBe('Received');
    expect(stock(received, product, 'dallas').onHand).toBe(startDallas - 5);
    expect(stock(received, product, 'austin').onHand).toBe(startAustin + 5);
    // The round trip conserved global inventory exactly.
    expect(globalUnits(received)).toBe(startGlobal);
  });

  it('refuses to transfer more than the source has unallocated', () => {
    const state = seed();
    const available = stock(state, state.products[0].id, 'dallas').available;
    expectRejected(draft(state, available + 1), { type: 'transfer/ship', transferId: 'transfer-test' }, /does not have that much/i);
  });

  it('refuses the same two warehouses', () => {
    const state = seed();
    expectRejected(
      state,
      {
        type: 'transfer/save',
        transfer: {
          id: 'bad', code: '', productId: state.products[0].id, from: 'dallas', to: 'dallas',
          quantity: 1, status: 'Draft', date: '2026-10-01', note: '',
        },
      },
      /two different warehouses/i,
    );
  });

  it('cancels only before shipping, so units are never stranded in transit', () => {
    const state = seed();
    const cancelled = run(draft(state, 5), { type: 'transfer/cancel', transferId: 'transfer-test' });
    expect(cancelled.transfers[0].status).toBe('Cancelled');
    expect(globalUnits(cancelled)).toBe(globalUnits(state));

    const inTransit = run(draft(state, 5), { type: 'transfer/ship', transferId: 'transfer-test' });
    expectRejected(inTransit, { type: 'transfer/cancel', transferId: 'transfer-test' }, /before it ships/i);
  });

  it('will not ship or receive the same transfer twice', () => {
    const state = seed();
    const shipped = run(draft(state, 5), { type: 'transfer/ship', transferId: 'transfer-test' });
    expectRejected(shipped, { type: 'transfer/ship', transferId: 'transfer-test' }, /draft transfers/i);

    const received = run(shipped, { type: 'transfer/receive', transferId: 'transfer-test' });
    expectRejected(received, { type: 'transfer/receive', transferId: 'transfer-test' }, /in transit/i);
  });
});

describe('customer returns', () => {
  /** Ships two units of the first product so there is something to return. */
  function shippedWorkspace() {
    let state = seed();
    const product = state.products[0];

    state = run(state, {
      type: 'order/save',
      order: {
        id: 'order-test', code: '', customerId: state.customers[0].id, warehouseId: 'dallas',
        date: '2026-10-01', requestedDate: '2026-10-05', shippingAddress: '1 Example Dock, Dallas, TX',
        notes: '', status: 'Draft', lines: [{ id: 'line-1', productId: product.id, quantity: 2, unitPrice: product.price }],
        discount: 0, taxBps: 0, freight: 0,
      },
    });
    state = run(state, { type: 'order/confirm', orderId: 'order-test' });
    state = run(state, { type: 'order/allocate', orderId: 'order-test' });
    state = run(state, { type: 'order/pick', orderId: 'order-test' });
    state = run(state, { type: 'order/pack', orderId: 'order-test' });
    state = run(state, {
      type: 'shipment/post', orderId: 'order-test', lines: [{ lineId: 'line-1', quantity: 2 }],
      date: '2026-10-02', carrier: 'Regional Freight', tracking: '',
    });

    const shipment = state.shipments.find((entry) => entry.orderId === 'order-test')!;
    return { state, product, shipmentId: shipment.id };
  }

  it('adds sellable stock back exactly once without undoing the shipment', () => {
    const { state, product, shipmentId } = shippedWorkspace();
    const afterShipping = stock(state, product.id, 'dallas').onHand;
    const shipmentCount = state.shipments.length;

    const returned = run(state, {
      type: 'return/post', shipmentId, date: '2026-10-03',
      lines: [{ lineId: 'line-1', quantity: 1, disposition: 'Return to Stock', reason: 'Wrong size ordered' }],
    });

    expect(stock(returned, product.id, 'dallas').onHand).toBe(afterShipping + 1);
    expect(returned.movements.filter((row) => row.type === 'RETURN_IN')).toHaveLength(1);
    // The shipment stays posted: it happened, and a return is its own event.
    expect(returned.shipments).toHaveLength(shipmentCount);
    expect(returned.movements.filter((row) => row.type === 'SHIPMENT')).toHaveLength(1);
    expect(returnedQuantity(returned, shipmentId, 'line-1')).toBe(1);
  });

  it('records a damaged return without making it sellable again', () => {
    const { state, product, shipmentId } = shippedWorkspace();
    const afterShipping = stock(state, product.id, 'dallas');

    const returned = run(state, {
      type: 'return/post', shipmentId, date: '2026-10-03',
      lines: [{ lineId: 'line-1', quantity: 1, disposition: 'Damaged', reason: 'Crushed in transit' }],
    });

    expect(returned.returns).toHaveLength(1);
    expect(returned.returns[0].disposition).toBe('Damaged');
    // Recorded, but no movement — so it can never be allocated or shipped.
    expect(returned.movements.filter((row) => row.type === 'RETURN_IN')).toHaveLength(0);
    expect(stock(returned, product.id, 'dallas').onHand).toBe(afterShipping.onHand);
    expect(stock(returned, product.id, 'dallas').available).toBe(afterShipping.available);
  });

  it('refuses to take back more than was shipped, across several returns', () => {
    const { state, shipmentId } = shippedWorkspace();

    const once = run(state, {
      type: 'return/post', shipmentId, date: '2026-10-03',
      lines: [{ lineId: 'line-1', quantity: 2, disposition: 'Return to Stock', reason: 'Order cancelled' }],
    });
    expect(returnedQuantity(once, shipmentId, 'line-1')).toBe(2);

    expectRejected(
      once,
      {
        type: 'return/post', shipmentId, date: '2026-10-04',
        lines: [{ lineId: 'line-1', quantity: 1, disposition: 'Return to Stock', reason: 'Another one' }],
      },
      /more than was shipped/i,
    );
  });

  it('requires a reason and refuses a return dated before its shipment', () => {
    const { state, shipmentId } = shippedWorkspace();

    expectRejected(
      state,
      {
        type: 'return/post', shipmentId, date: '2026-10-03',
        lines: [{ lineId: 'line-1', quantity: 1, disposition: 'Return to Stock', reason: '   ' }],
      },
      /reason/i,
    );

    expectRejected(
      state,
      {
        type: 'return/post', shipmentId, date: '2026-09-01',
        lines: [{ lineId: 'line-1', quantity: 1, disposition: 'Return to Stock', reason: 'Too early' }],
      },
      /predate/i,
    );
  });

  it('is idempotent: replaying the same return posts it once', () => {
    const { state, product, shipmentId } = shippedWorkspace();
    const command = {
      type: 'return/post' as const, shipmentId, date: '2026-10-03',
      lines: [{ lineId: 'line-1', quantity: 1, disposition: 'Return to Stock' as const, reason: 'Duplicate guard' }],
    };

    const action = { ...command, id: 'return-once', at: '2026-10-03T09:00:00.000Z' };
    const once = distributionReducer(state, action);
    const twice = distributionReducer(once, action);

    expect(twice.returns).toHaveLength(1);
    expect(twice.movements.filter((row) => row.type === 'RETURN_IN')).toHaveLength(1);
    expect(stock(twice, product.id, 'dallas').onHand).toBe(stock(once, product.id, 'dallas').onHand);
  });
});
