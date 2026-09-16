import type { DistributionState, PaymentMethod } from '../distribution.types';
import { code, record, requireThat, totals, whole, prorate } from '../distribution.utils';
import { invoiceBalance, invoicePaid, orderStatus, shippedQuantity } from '../distribution.selectors';
export const PAYMENT_METHODS: PaymentMethod[] = ['ACH', 'Check', 'Card', 'Cash', 'Wire', 'Other'];
export type FinanceCommand =
  | { type: 'invoice/create'; orderId: string; date: string; dueDate: string }
  | { type: 'invoice/send' | 'invoice/void'; invoiceId: string }
  | { type: 'payment/post'; invoiceId: string; date: string; amount: number; method: PaymentMethod; reference: string };
export function finance(state: DistributionState, action: FinanceCommand & { id: string; at: string }): DistributionState {
  switch (action.type) {
    case 'invoice/create': {
      const order = record(state.orders, action.orderId);
      requireThat(orderStatus(state, order) === 'Shipped' || order.status === 'Cancelled', 'Invoice after all quantities ship or after the unshipped remainder is cancelled.');
      requireThat(!state.invoices.some(i => i.orderId === order.id && i.status !== 'Void'), 'This order already has an active invoice.');
      const lines = order.lines.map(l => ({ ...l, quantity: shippedQuantity(state, order.id, l.id) })).filter(l => l.quantity > 0);
      requireThat(lines.length > 0, 'There are no shipped quantities to invoice.');
      const latestShipDate = state.shipments.filter(s => s.orderId === order.id).map(s => s.date).sort().at(-1)!;
      requireThat(action.date >= latestShipDate && action.dueDate >= action.date, 'Invoice date must follow shipment; due date must follow invoice date.');
      const shippedSubtotal = lines.reduce((n, l) => n + l.quantity * l.unitPrice, 0);
      const originalSubtotal = totals(order).subtotal;
      // One operational invoice per completed/cancelled order, for shipped units only.
      const ratio = (amount: number) => originalSubtotal ? prorate(amount, shippedSubtotal, originalSubtotal) : amount;
      const invoice = { id: action.id, code: code('INV', state.invoices), orderId: order.id, customerId: order.customerId, date: action.date, dueDate: action.dueDate, status: 'Draft' as const, lines, discount: ratio(order.discount), taxBps: order.taxBps, freight: ratio(order.freight) };
      return { ...state, invoices: [...state.invoices, invoice] };
    }
    case 'invoice/send': case 'invoice/void': {
      const invoice = record(state.invoices, action.invoiceId);
      requireThat(action.type === 'invoice/send' ? invoice.status === 'Draft' : invoice.status !== 'Void' && invoicePaid(state, invoice.id) === 0, 'This invoice cannot make that transition. Paid invoices cannot be voided.');
      return { ...state, invoices: state.invoices.map(i => i.id === invoice.id ? { ...i, status: action.type === 'invoice/send' ? 'Sent' : 'Void' } : i) };
    }
    case 'payment/post': {
      const invoice = record(state.invoices, action.invoiceId);
      requireThat(invoice.status === 'Sent', 'Record payments only against sent, non-void invoices.');
      whole(action.amount, 'Payment amount', 1);
      requireThat(action.amount <= invoiceBalance(state, invoice), 'Payment exceeds the invoice balance.');
      requireThat(PAYMENT_METHODS.includes(action.method), 'Choose a valid payment method.');
      requireThat(action.date >= invoice.date, 'Payment date must be on or after the invoice date.');
      return { ...state, payments: [...state.payments, { id: action.id, code: code('PAY', state.payments), invoiceId: invoice.id, customerId: invoice.customerId, date: action.date, amount: action.amount, method: action.method, reference: action.reference }] };
    }
  }
}
