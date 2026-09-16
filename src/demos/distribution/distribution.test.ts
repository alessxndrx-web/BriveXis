import { describe, expect, it } from 'vitest';
import { buildSeedState } from './distribution.seed';
import { blankWorkspace } from './distribution.fixtures';
import { distributionReducer } from './distribution.reducer';
import { SCHEMA_VERSION, createMemoryRepository, isUsableState } from './distribution.storage';
import {
  invoiceBalance,
  lowStock,
  lowStockProducts,
  orderStatus,
  poStatus,
  stock,
} from './distribution.selectors';
import { totals } from './distribution.utils';

describe('Distribution foundations', () => {
  it('seeds independent workspaces and resets through the reducer', () => {
    const first = buildSeedState();
    first.warehouses.pop();
    // A second call must not see the first caller's mutation.
    expect(buildSeedState().warehouses).toHaveLength(3);
    expect(distributionReducer(first, { type: 'reset' })).toEqual(buildSeedState());
  });

  it('round trips and clears through the shared repository boundary', () => {
    const repo = createMemoryRepository();
    expect(repo.load().status).toBe('empty');
    repo.save(buildSeedState());
    expect(repo.load()).toEqual({ status: 'loaded', state: buildSeedState() });
    repo.clear();
    expect(repo.load().status).toBe('empty');
  });

  it('rejects mismatched schemas, missing collections and malformed records', () => {
    expect(isUsableState(buildSeedState())).toBe(true);
    expect(isUsableState({ ...buildSeedState(), schemaVersion: SCHEMA_VERSION - 1 })).toBe(false);
    expect(isUsableState({ ...buildSeedState(), schemaVersion: SCHEMA_VERSION + 1 })).toBe(false);
    expect(isUsableState({ ...buildSeedState(), products: [null] })).toBe(false);
    expect(isUsableState({ ...buildSeedState(), movements: undefined })).toBe(false);
    expect(isUsableState({ schemaVersion: SCHEMA_VERSION })).toBe(false);
    expect(isUsableState(null)).toBe(false);
    expect(isUsableState('{}')).toBe(false);
  });
});

describe('warehouse inventory ledger', () => {
  const twoWarehouses = () =>
    blankWorkspace([
      ['gloves', 'dallas', 35],
      ['gloves', 'austin', 40],
    ]);

  it('derives warehouse and aggregate stock from opening movements', () => {
    const state = twoWarehouses();
    expect(stock(state, 'gloves', 'dallas')).toEqual({ onHand: 35, allocated: 0, available: 35 });
    expect(stock(state, 'gloves', 'austin')).toEqual({ onHand: 40, allocated: 0, available: 40 });
    // The aggregate is the sum of the same ledger, never a separate figure.
    expect(stock(state, 'gloves').onHand).toBe(75);
    // A product with no movements at all is zero, not undefined.
    expect(stock(state, 'tape')).toEqual({ onHand: 0, allocated: 0, available: 0 });
  });

  it('flags a product at or below its reorder point', () => {
    const gloves = buildSeedState().products.find((product) => product.id === 'gloves')!;
    expect(gloves.reorderPoint).toBe(25);
    expect(lowStock(blankWorkspace([['gloves', 'dallas', 25]]), gloves)).toBe(true);
    expect(lowStock(blankWorkspace([['gloves', 'dallas', 26]]), gloves)).toBe(false);
    expect(lowStock(blankWorkspace(), gloves)).toBe(true);
  });

  it('reservations reduce availability only', () => {
    const state = twoWarehouses();
    state.allocations.push({
      id: 'a', orderId: 'o', lineId: 'l', productId: 'gloves', warehouseId: 'dallas',
      quantity: 5, picked: 0, packed: 0,
    });
    expect(stock(state, 'gloves', 'dallas')).toEqual({ onHand: 35, allocated: 5, available: 30 });
    // The other warehouse is untouched by a reservation made against Dallas.
    expect(stock(state, 'gloves', 'austin').available).toBe(40);
  });

  it('posts auditable adjustments once and refuses negative or fractional stock', () => {
    const before = twoWarehouses();
    const action = {
      type: 'inventory/adjust' as const, id: 'adj', at: '2026-09-15T10:00:00Z',
      productId: 'gloves', warehouseId: 'dallas', quantity: -5, reason: 'Cycle count',
    };
    const after = distributionReducer(before, action);

    expect(stock(after, 'gloves', 'dallas').onHand).toBe(30);
    // History is appended to, never rewritten.
    expect(after.movements.slice(0, before.movements.length)).toEqual(before.movements);
    expect(distributionReducer(after, action)).toBe(after);
    expect(() => distributionReducer(after, { ...action, id: 'bad', quantity: -31 })).toThrow();
    expect(() => distributionReducer(after, { ...action, id: 'bad', quantity: 1.5 })).toThrow();
    expect(() => distributionReducer(after, { ...action, id: 'bad', reason: '  ' })).toThrow();
  });
});

/**
 * The seed is what a first-time visitor sees, so it has to be internally
 * consistent before anything else is judged. These assertions describe
 * properties rather than figures, so tuning the sample data never breaks them.
 */
describe('seed workspace coherence', () => {
  const seed = buildSeedState();

  it('never shows negative or over-committed stock', () => {
    for (const product of seed.products) {
      for (const warehouse of seed.warehouses) {
        const position = stock(seed, product.id, warehouse.id);
        expect(position.onHand).toBeGreaterThanOrEqual(0);
        expect(position.allocated).toBeGreaterThanOrEqual(0);
        expect(position.available).toBe(position.onHand - position.allocated);
        expect(position.available).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('references only records that exist', () => {
    const has = (collection: { id: string }[], id: string) =>
      collection.some((entry) => entry.id === id);

    for (const movement of seed.movements) {
      expect(has(seed.products, movement.productId)).toBe(true);
      expect(has(seed.warehouses, movement.warehouseId)).toBe(true);
    }
    for (const po of seed.purchaseOrders) {
      expect(has(seed.suppliers, po.supplierId)).toBe(true);
      expect(has(seed.warehouses, po.warehouseId)).toBe(true);
    }
    for (const order of seed.orders) {
      expect(has(seed.customers, order.customerId)).toBe(true);
      expect(has(seed.warehouses, order.warehouseId)).toBe(true);
    }
    for (const receipt of seed.receipts) expect(has(seed.purchaseOrders, receipt.poId)).toBe(true);
    for (const shipment of seed.shipments) expect(has(seed.orders, shipment.orderId)).toBe(true);
    for (const invoice of seed.invoices) expect(has(seed.orders, invoice.orderId)).toBe(true);
    for (const payment of seed.payments) expect(has(seed.invoices, payment.invoiceId)).toBe(true);
  });

  it('gives a first-time visitor something to work on in every module', () => {
    expect(lowStockProducts(seed).length).toBeGreaterThan(0);
    expect(seed.purchaseOrders.some((po) => poStatus(seed, po) === 'Partially Received')).toBe(true);
    expect(seed.orders.some((order) => orderStatus(seed, order) === 'Partially Shipped')).toBe(true);
    expect(seed.orders.some((order) => order.status === 'Draft')).toBe(true);
    expect(seed.invoices.length).toBeGreaterThan(0);
  });

  it('never bills more than was invoiced', () => {
    for (const invoice of seed.invoices) {
      const balance = invoiceBalance(seed, invoice);
      expect(balance).toBeGreaterThanOrEqual(0);
      expect(balance).toBeLessThanOrEqual(totals(invoice).total);
    }
  });
});
