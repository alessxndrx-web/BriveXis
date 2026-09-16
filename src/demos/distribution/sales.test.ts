import { expect, it } from 'vitest';
import { blankWorkspace } from './distribution.fixtures';
import { distributionReducer, type Command } from './distribution.reducer';
import { totals } from './distribution.utils';
import type { DistributionState, SalesOrder } from './distribution.types';
import { stock, orderStatus, backorderQuantity, invoiceBalance, invoiceStatus } from './distribution.selectors';
export const order: SalesOrder = { id: 'test-order', code: '', customerId: 'customer-1', warehouseId: 'dallas', date: '2026-09-15', requestedDate: '2026-09-16', shippingAddress: 'Fictional receiving dock', notes: '', status: 'Draft', lines: [{ id: 'line', productId: 'gloves', quantity: 10, unitPrice: 4200 }], discount: 100, taxBps: 825, freight: 500 };
const warehouseWithGloves = () => blankWorkspace([['gloves', 'dallas', 35]]);
let seq = 0;
export const runSales = (state: DistributionState, command: Command, id = `sales-${++seq}`) => distributionReducer(state, { ...command, id, at: '2026-09-15T10:00:00Z' });
export function confirmedOrder() { return runSales(runSales(warehouseWithGloves(), { type: 'order/save', order }), { type: 'order/confirm', orderId: order.id }); }
it('calculates cents, discount before tax and freight deterministically', () => {
  expect(totals(order)).toEqual({ subtotal: 42000, discount: 100, tax: 3457, freight: 500, total: 45857 });
});
it('allocates available stock only, picks and packs without physical movement, and releases on cancellation', () => {
  let s = confirmedOrder();
  s = runSales(s, { type: 'inventory/adjust', productId: 'gloves', warehouseId: 'dallas', quantity: -29, reason: 'Prepare six available units' });
  const movements = s.movements;
  s = runSales(s, { type: 'order/allocate', orderId: order.id });
  expect(stock(s, 'gloves', 'dallas')).toEqual({ onHand: 6, allocated: 6, available: 0 });
  expect(orderStatus(s, s.orders[0])).toBe('Partially Allocated');
  expect(backorderQuantity(s, s.orders[0])).toBe(4);
  expect(() => runSales(s, { type: 'order/allocate', orderId: order.id })).toThrow('No additional');
  expect(() => runSales(s, { type: 'order/pack', orderId: order.id })).toThrow('Pick');
  s = runSales(s, { type: 'order/pick', orderId: order.id });
  s = runSales(s, { type: 'order/pack', orderId: order.id });
  expect(s.movements).toEqual(movements);
  expect(s.allocations[0].packed).toBe(6);
  s = runSales(s, { type: 'order/cancel', orderId: order.id });
  expect(stock(s, 'gloves', 'dallas')).toEqual({ onHand: 6, allocated: 0, available: 6 });
});
it('draft and confirmation leave physical stock unchanged and confirmed lines cannot be edited', () => {
  const state = confirmedOrder();
  expect(state.movements).toEqual(warehouseWithGloves().movements);
  expect(state.allocations).toEqual([]);
  expect(() => runSales(state, { type: 'order/save', order })).toThrow('Only draft');
  expect(runSales(state, { type: 'order/cancel', orderId: order.id }).movements).toEqual(state.movements);
});
export function packedOrder() { let s = confirmedOrder(); for (const type of ['order/allocate', 'order/pick', 'order/pack'] as const) s = runSales(s, { type, orderId: order.id }); return s; }
it('ships partially and fully exactly once while preserving the remaining allocation', () => {
  let s = packedOrder();
  const shipment = { type: 'shipment/post' as const, orderId: order.id, date: '2026-09-15', carrier: 'Demo carrier', tracking: '', lines: [{ lineId: 'line', quantity: 6 }] };
  expect(() => runSales(confirmedOrder(), shipment)).toThrow();
  expect(() => runSales(s, { ...shipment, lines: [{ lineId: 'line', quantity: 11 }] })).toThrow();
  s = runSales(s, shipment, 'shipment-1');
  expect(stock(s, 'gloves', 'dallas')).toEqual({ onHand: 29, allocated: 4, available: 25 });
  expect(orderStatus(s, s.orders[0])).toBe('Partially Shipped');
  expect(s.allocations[0].packed).toBe(4);
  expect(runSales(s, shipment, 'shipment-1')).toBe(s);
  const cancelled = runSales(s, { type: 'order/cancel', orderId: order.id });
  expect(stock(cancelled, 'gloves', 'dallas').onHand).toBe(29);
  expect(cancelled.allocations).toEqual([]);
  expect(() => runSales(cancelled, shipment)).toThrow();
  s = runSales(s, { ...shipment, lines: [{ lineId: 'line', quantity: 4 }] });
  expect(orderStatus(s, s.orders[0])).toBe('Shipped');
  expect(stock(s, 'gloves', 'dallas')).toEqual({ onHand: 25, allocated: 0, available: 25 });
  expect(s.movements.filter(m => m.type === 'SHIPMENT')).toHaveLength(2);
});
it('completes a six-unit shipment then replenishes and ships the four-unit backorder', () => {
  let s = runSales(confirmedOrder(), { type: 'inventory/adjust', productId: 'gloves', warehouseId: 'dallas', quantity: -29, reason: 'Cycle count' });
  const shipment = { type: 'shipment/post' as const, orderId: order.id, date: '2026-09-15', carrier: 'Demo', tracking: '', lines: [{ lineId: 'line', quantity: 6 }] };
  for (const type of ['order/allocate', 'order/pick', 'order/pack'] as const) s = runSales(s, { type, orderId: order.id });
  s = runSales(s, shipment);
  expect(backorderQuantity(s, s.orders[0])).toBe(4);
  expect(stock(s, 'gloves', 'dallas').onHand).toBe(0);
  s = runSales(s, { type: 'inventory/adjust', productId: 'gloves', warehouseId: 'dallas', quantity: 4, reason: 'Replenishment' });
  for (const type of ['order/allocate', 'order/pick', 'order/pack'] as const) s = runSales(s, { type, orderId: order.id });
  s = runSales(s, { ...shipment, lines: [{ lineId: 'line', quantity: 4 }] });
  expect(orderStatus(s, s.orders[0])).toBe('Shipped');
  expect(stock(s, 'gloves', 'dallas').onHand).toBe(0);
});
export function shippedOrder() { return runSales(packedOrder(), { type: 'shipment/post', orderId: order.id, date: '2026-09-15', carrier: 'Demo', tracking: '', lines: [{ lineId: 'line', quantity: 10 }] }); }
it('invoices shipped units, reconciles partial/full payments and rejects invalid payments', () => {
  expect(() => runSales(confirmedOrder(), { type: 'invoice/create', orderId: order.id, date: '2026-09-15', dueDate: '2026-10-15' })).toThrow();
  let s = runSales(shippedOrder(), { type: 'invoice/create', orderId: order.id, date: '2026-09-15', dueDate: '2026-10-15' }, 'invoice-1');
  const invoice = s.invoices[0];
  expect(totals(invoice).total).toBe(45857);
  expect(invoiceBalance(s, invoice)).toBe(45857);
  expect(orderStatus(s, s.orders[0])).toBe('Shipped');
  expect(invoiceStatus(s, invoice)).toBe('Draft');
  const payment = { type: 'payment/post' as const, invoiceId: invoice.id, date: '2026-09-15', amount: 10000, method: 'ACH' as const, reference: '' };
  expect(() => runSales(s, payment)).toThrow();
  s = runSales(s, { type: 'invoice/send', invoiceId: invoice.id });
  for (const amount of [-1, 0, 45858]) expect(() => runSales(s, { ...payment, amount })).toThrow();
  const ordersBefore = s.orders; const movementsBefore = s.movements;
  s = runSales(s, payment, 'payment-1');
  expect(runSales(s, payment, 'payment-1')).toBe(s);
  expect(invoiceStatus(s, s.invoices[0])).toBe('Partial');
  expect(invoiceBalance(s, invoice)).toBe(35857);
  s = runSales(s, { ...payment, amount: 35857 });
  expect(invoiceStatus(s, s.invoices[0])).toBe('Paid');
  expect(invoiceBalance(s, invoice)).toBe(0);
  expect(s.orders).toEqual(ordersBefore); expect(s.movements).toEqual(movementsBefore);
  expect(() => runSales(s, payment)).toThrow();
  expect(() => runSales(s, { type: 'invoice/void', invoiceId: invoice.id })).toThrow();
});
it('invoices only six shipped units after cancelling the remaining four; paid never changes fulfillment', () => {
  let s = runSales(packedOrder(), { type: 'shipment/post', orderId: order.id, date: '2026-09-15', carrier: 'Demo', tracking: '', lines: [{ lineId: 'line', quantity: 6 }] });
  s = runSales(s, { type: 'order/cancel', orderId: order.id });
  s = runSales(s, { type: 'invoice/create', orderId: order.id, date: '2026-09-15', dueDate: '2026-10-15' }, 'invoice-partial');
  const invoice = s.invoices[0];
  expect(invoice.lines[0].quantity).toBe(6); expect(invoice.discount).toBe(60); expect(invoice.freight).toBe(300);
  s = runSales(s, { type: 'invoice/send', invoiceId: invoice.id });
  s = runSales(s, { type: 'payment/post', invoiceId: invoice.id, date: '2026-09-15', amount: totals(invoice).total, method: 'Check', reference: '' });
  expect(invoiceStatus(s, s.invoices[0])).toBe('Paid');
  expect(orderStatus(s, s.orders[0])).toBe('Cancelled');
  expect(s.shipments[0].lines[0].quantity).toBe(6);
});
