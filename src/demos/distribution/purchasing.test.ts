import { expect, it } from 'vitest';
import { blankWorkspace } from './distribution.fixtures';
import { distributionReducer, type Command } from './distribution.reducer';
import type { DistributionState, PurchaseOrder } from './distribution.types';
import { poStatus, receivedQuantity, stock } from './distribution.selectors';
export const po: PurchaseOrder = { id: 'test-po', code: '', supplierId: 'supplier-1', warehouseId: 'dallas', date: '2026-09-15', expectedDate: '2026-09-16', notes: '', status: 'Draft', lines: [{ id: 'line-1', productId: 'gloves', quantity: 100, unitPrice: 2400 }], discount: 0, taxBps: 0, freight: 0 };
const warehouseWithGloves = () => blankWorkspace([['gloves', 'dallas', 35]]);
let sequence = 0;
export const run = (state: DistributionState, command: Command, id = `test-${++sequence}`) => distributionReducer(state, { ...command, id, at: '2026-09-15T10:00:00Z' });
export function approvedPO() { let s = run(warehouseWithGloves(), { type: 'po/save', po }); s = run(s, { type: 'po/status', poId: po.id, status: 'Submitted' }); return run(s, { type: 'po/status', poId: po.id, status: 'Approved' }); }
it('draft, submitted and approved purchase orders never change inventory', () => {
  const seed = warehouseWithGloves(); const approved = approvedPO();
  expect(approved.movements).toEqual(seed.movements);
  expect(approved.purchaseOrders[0].status).toBe('Approved');
  expect(() => run(approved, { type: 'po/save', po })).toThrow('Only draft');
  expect(() => run(seed, { type: 'po/save', po: { ...po, lines: [] } })).toThrow();
});
it('receives 60 + 40 exactly once, preserving inventory history on cancellation', () => {
  const start = approvedPO();
  const receipt = { type: 'receipt/post' as const, poId: po.id, date: '2026-09-15', reference: 'Slip', notes: '', lines: [{ lineId: 'line-1', quantity: 60 }] };
  const partial = run(start, receipt, 'receipt-1');
  expect(poStatus(partial, partial.purchaseOrders[0])).toBe('Partially Received');
  expect(stock(partial, 'gloves', 'dallas').onHand).toBe(95);
  expect(partial.movements).toHaveLength(start.movements.length + 1);
  expect(run(partial, receipt, 'receipt-1')).toBe(partial);
  expect(() => run(partial, receipt)).toThrow('exceeds');
  const cancelled = run(partial, { type: 'po/status', poId: po.id, status: 'Cancelled' });
  expect(cancelled.movements).toEqual(partial.movements);
  expect(() => run(cancelled, receipt)).toThrow();
  const full = run(partial, { ...receipt, lines: [{ lineId: 'line-1', quantity: 40 }] });
  expect(poStatus(full, full.purchaseOrders[0])).toBe('Received');
  expect(receivedQuantity(full, po.id, 'line-1')).toBe(100);
  expect(stock(full, 'gloves', 'dallas').onHand).toBe(135);
  expect(full.movements).toHaveLength(start.movements.length + 2);
  expect(() => run(full, receipt)).toThrow();
});
