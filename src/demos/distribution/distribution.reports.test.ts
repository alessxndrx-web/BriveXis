import { describe, expect, it } from 'vitest';
import { buildSeedState } from './distribution.seed';
import { blankWorkspace } from './distribution.fixtures';
import { distributionReducer, type Command } from './distribution.reducer';
import { createMemoryRepository, isUsableState } from './distribution.storage';
import type { DistributionState } from './distribution.types';
import {
  backorderRows,
  dashboardMetrics,
  inventoryByCategory,
  inventoryByWarehouse,
  invoiceAging,
  movementsByType,
  paymentsByMethod,
  purchaseOrdersByStatus,
  searchWorkspace,
  topProductsByUnitsShipped,
  warehouseSummary,
} from './distribution.reports';
import {
  inventoryValue,
  outstandingReceivable,
  unallocatedQuantity,
} from './distribution.selectors';

/**
 * Dashboard figures, reports and search.
 *
 * The property that matters is that these agree with the ledger and the
 * documents rather than keeping their own tally: a report that drifts from the
 * record it summarises is worse than no report.
 */

let sequence = 0;
const run = (state: DistributionState, command: Command, at = '2026-09-15T10:00:00.000Z') =>
  distributionReducer(state, { ...command, id: `op-${(sequence += 1)}`, at } as never);

const links = {
  product: (id: string) => `/p/${id}`,
  supplier: (id: string) => `/s/${id}`,
  customer: (id: string) => `/c/${id}`,
  purchaseOrder: (id: string) => `/po/${id}`,
  order: (id: string) => `/so/${id}`,
  shipment: (id: string) => `/sh/${id}`,
  invoice: (id: string) => `/i/${id}`,
};

describe('dashboard metrics', () => {
  it('reads zero from an empty workspace instead of failing', () => {
    const metrics = dashboardMetrics(blankWorkspace());
    expect(metrics.inventoryValue).toBe(0);
    expect(metrics.openPurchaseOrders).toBe(0);
    expect(metrics.openOrders).toBe(0);
    expect(metrics.backorderedUnits).toBe(0);
    expect(metrics.outstandingReceivable).toBe(0);
    expect(metrics.paymentsThisMonth).toBe(0);
  });

  it('values inventory at cost from the ledger', () => {
    const state = blankWorkspace([
      ['gloves', 'dallas', 10],
      ['gloves', 'austin', 5],
    ]);
    const gloves = state.products.find((product) => product.id === 'gloves')!;

    expect(inventoryValue(state)).toBe(15 * gloves.cost);
    expect(inventoryValue(state, 'dallas')).toBe(10 * gloves.cost);
    expect(dashboardMetrics(state).inventoryValue).toBe(15 * gloves.cost);
  });

  it('moves with the workspace as receipts and shipments are posted', () => {
    let state = blankWorkspace([['gloves', 'dallas', 50]]);
    const before = dashboardMetrics(state);

    state = run(state, {
      type: 'po/save',
      po: {
        id: 'po-test', code: '', supplierId: 'supplier-1', warehouseId: 'dallas',
        date: '2026-09-10', expectedDate: '2026-09-20', notes: '', status: 'Draft',
        lines: [{ id: 'line-1', productId: 'gloves', quantity: 30, unitPrice: 2400 }],
        discount: 0, taxBps: 0, freight: 0,
      },
    });
    state = run(state, { type: 'po/status', poId: 'po-test', status: 'Submitted' });
    state = run(state, { type: 'po/status', poId: 'po-test', status: 'Approved' });

    const approved = dashboardMetrics(state);
    expect(approved.openPurchaseOrders).toBe(before.openPurchaseOrders + 1);
    expect(approved.inboundUnits).toBe(30);
    // Approval is paperwork: it must not have touched the value of the shelf.
    expect(approved.inventoryValue).toBe(before.inventoryValue);

    state = run(state, {
      type: 'receipt/post', poId: 'po-test', date: '2026-09-15',
      reference: 'Slip', notes: '', lines: [{ lineId: 'line-1', quantity: 30 }],
    });

    const received = dashboardMetrics(state);
    expect(received.inboundUnits).toBe(0);
    expect(received.inventoryValue).toBeGreaterThan(before.inventoryValue);
  });

  it('counts only the units the warehouse cannot cover, before and after allocating', () => {
    let state = blankWorkspace([['gloves', 'dallas', 4]]);
    state = run(state, {
      type: 'order/save',
      order: {
        id: 'so-test', code: '', customerId: 'customer-1', warehouseId: 'dallas',
        date: '2026-09-10', requestedDate: '2026-09-14', shippingAddress: 'Example dock',
        notes: '', status: 'Draft',
        lines: [{ id: 'line-1', productId: 'gloves', quantity: 10, unitPrice: 4200 }],
        discount: 0, taxBps: 0, freight: 0,
      },
    });
    state = run(state, { type: 'order/confirm', orderId: 'so-test' });

    // Ten ordered against four on the shelf is a shortage of six, and pressing
    // Allocate cannot change that: reserving the four moves them out of
    // "available" and into this order at the same rate.
    expect(dashboardMetrics(state).backorderedUnits).toBe(6);
    expect(backorderRows(state)).toHaveLength(1);
    expect(unallocatedQuantity(state, state.orders.find((o) => o.id === 'so-test')!)).toBe(10);

    state = run(state, { type: 'order/allocate', orderId: 'so-test' });
    expect(dashboardMetrics(state).backorderedUnits).toBe(6);
    expect(backorderRows(state)[0].units).toBe(6);
    expect(unallocatedQuantity(state, state.orders.find((o) => o.id === 'so-test')!)).toBe(6);

    // Receiving the missing six clears the backorder without allocating again.
    state = run(state, {
      type: 'inventory/adjust',
      productId: 'gloves',
      warehouseId: 'dallas',
      quantity: 6,
      reason: 'Cycle count',
    });
    expect(dashboardMetrics(state).backorderedUnits).toBe(0);
  });
});

describe('operational reports', () => {
  const seed = buildSeedState();

  it('splits inventory by warehouse and by category without losing units', () => {
    const byWarehouse = inventoryByWarehouse(seed);
    const byCategory = inventoryByCategory(seed);

    const totalUnits = seed.products.reduce(
      (sum, product) =>
        sum +
        seed.warehouses.reduce(
          (inner, warehouse) =>
            inner +
            seed.movements
              .filter((row) => row.productId === product.id && row.warehouseId === warehouse.id)
              .reduce((units, row) => units + row.quantity, 0),
          0,
        ),
      0,
    );

    expect(byWarehouse.reduce((sum, bucket) => sum + bucket.value, 0)).toBe(totalUnits);
    expect(byCategory.reduce((sum, bucket) => sum + bucket.value, 0)).toBe(totalUnits);
    expect(byWarehouse.reduce((sum, bucket) => sum + (bucket.amount ?? 0), 0)).toBe(
      inventoryValue(seed),
    );
  });

  it('summarises every warehouse, including empty ones', () => {
    const summary = warehouseSummary(seed);
    expect(summary).toHaveLength(seed.warehouses.length);
    for (const row of summary) {
      expect(row.units).toBeGreaterThanOrEqual(0);
      expect(row.value).toBeGreaterThanOrEqual(0);
    }
  });

  it('buckets purchase orders by their derived status', () => {
    const statuses = ['Draft', 'Submitted', 'Approved', 'Partially Received', 'Received', 'Cancelled'];
    const buckets = purchaseOrdersByStatus(seed, statuses);
    expect(buckets.reduce((sum, bucket) => sum + bucket.value, 0)).toBe(seed.purchaseOrders.length);
  });

  it('reports movement volume as absolute units per type', () => {
    const buckets = movementsByType(seed, ['SHIPMENT', 'OPENING_BALANCE']);
    const shipment = buckets.find((bucket) => bucket.label === 'SHIPMENT')!;
    // Shipments are negative in the ledger; the report shows volume, not sign.
    expect(shipment.amount).toBeGreaterThanOrEqual(0);
    expect(shipment.value).toBe(seed.movements.filter((row) => row.type === 'SHIPMENT').length);
  });

  it('ages only open invoice balances, and agrees with the receivable total', () => {
    const aging = invoiceAging(seed);
    const aged = aging.reduce((sum, bucket) => sum + (bucket.amount ?? 0), 0);
    expect(aged).toBe(outstandingReceivable(seed));
  });

  it('counts units shipped per product, not units ordered', () => {
    const top = topProductsByUnitsShipped(seed);
    const shippedUnits = seed.shipments.reduce(
      (sum, shipment) => sum + shipment.lines.reduce((inner, line) => inner + line.quantity, 0),
      0,
    );
    expect(top.reduce((sum, bucket) => sum + bucket.value, 0)).toBe(shippedUnits);
  });

  it('groups recorded payments by method', () => {
    const buckets = paymentsByMethod(seed, ['ACH', 'Check', 'Card', 'Cash', 'Wire', 'Other']);
    expect(buckets.reduce((sum, bucket) => sum + bucket.value, 0)).toBe(seed.payments.length);
    expect(buckets.reduce((sum, bucket) => sum + (bucket.amount ?? 0), 0)).toBe(
      seed.payments.reduce((sum, payment) => sum + payment.amount, 0),
    );
  });
});

describe('workspace search', () => {
  const seed = buildSeedState();

  it('ignores a query too short to mean anything', () => {
    expect(searchWorkspace(seed, '', links)).toEqual([]);
    expect(searchWorkspace(seed, 'a', links)).toEqual([]);
  });

  it('finds a product by SKU and by name', () => {
    const bySku = searchWorkspace(seed, 'SAF-100', links);
    expect(bySku[0].group).toBe('Products');
    expect(bySku[0].href).toBe('/p/gloves');

    const byName = searchWorkspace(seed, 'work gloves', links);
    expect(byName.some((result) => result.id === 'gloves')).toBe(true);
  });

  it('finds documents by their number', () => {
    const po = seed.purchaseOrders[0];
    expect(searchWorkspace(seed, po.code, links).some((result) => result.id === po.id)).toBe(true);

    const order = seed.orders[0];
    expect(
      searchWorkspace(seed, order.code, links).some((result) => result.group === 'Sales Orders'),
    ).toBe(true);
  });

  it('caps the result list', () => {
    expect(searchWorkspace(seed, 'e', links, 3).length).toBeLessThanOrEqual(3);
    expect(searchWorkspace(seed, 'Example', links, 3).length).toBeLessThanOrEqual(3);
  });
});

describe('recovering from unusable stored data', () => {
  it('reports a reset rather than loading a half-valid workspace', () => {
    const repo = createMemoryRepository();

    repo.save({ ...buildSeedState(), schemaVersion: 1 } as unknown as DistributionState);
    expect(repo.load().status).toBe('reset');

    repo.save({ ...buildSeedState(), movements: undefined } as unknown as DistributionState);
    expect(repo.load().status).toBe('reset');

    repo.save({ ...buildSeedState(), orders: [{ code: 'no id' }] } as unknown as DistributionState);
    expect(repo.load().status).toBe('reset');

    repo.save(buildSeedState());
    expect(repo.load().status).toBe('loaded');
  });

  it('survives a round trip through JSON without changing shape', () => {
    const seed = buildSeedState();
    const revived: unknown = JSON.parse(JSON.stringify(seed));
    expect(isUsableState(revived)).toBe(true);
    expect(revived).toEqual(seed);
  });
});
