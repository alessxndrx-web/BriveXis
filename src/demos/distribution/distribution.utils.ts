import type { DocumentAmounts, DistributionState, Movement, MovementType } from './distribution.types';
/**
 * Money, dates, addresses and text formatting are shared with the other demos.
 * What is specific to distribution lives below: document arithmetic, the
 * whole-number guards, and the movement helper.
 */
export {
  formatMoney,
  formatMoneyWhole,
  formatDate,
  formatDateNumeric,
  formatDateTime,
  formatRelativeDay,
  formatPhone,
  formatAddress,
  formatAddressShort,
  createId,
  toDateOnly,
  dayOffset,
  timeOffset,
  startOfDay,
  daysBetween,
  parseAny,
  dollarsToCents,
  centsToInput,
  centsToDollars,
  matches,
  pluralize,
  sumCents,
} from '../shared/format';

export function requireThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function whole(value: number, label: string, min = 0) {
  requireThat(Number.isSafeInteger(value) && value >= min && value <= 1_000_000_000, `${label} must be a whole number between ${min} and 1,000,000,000.`);
}
export function record<T extends { id: string }>(rows: T[], id: string): T {
  const found = rows.find(row => row.id === id);
  requireThat(found, 'The referenced record no longer exists.');
  return found;
}
export function totals(doc: DocumentAmounts) {
  const subtotal = doc.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const tax = prorate(subtotal - doc.discount, doc.taxBps, 10_000);
  return { subtotal, discount: doc.discount, tax, freight: doc.freight, total: subtotal - doc.discount + tax + doc.freight };
}
/** Integer half-up rounding, including large intermediate products. */
export function prorate(amount: number, numerator: number, denominator: number) {
  if (![amount, numerator, denominator].every(Number.isSafeInteger) || denominator <= 0) return NaN;
  const product = BigInt(amount) * BigInt(numerator);
  return Number((product + BigInt(Math.floor(denominator / 2))) / BigInt(denominator));
}
export function validateDocument(state: DistributionState, doc: DocumentAmounts) {
  requireThat(doc.lines.length > 0, 'Add at least one product.');
  requireThat(new Set(doc.lines.map(line => line.id)).size === doc.lines.length, 'Duplicate line identifiers.');
  requireThat(new Set(doc.lines.map(line => line.productId)).size === doc.lines.length, 'Use one line per product.');
  for (const line of doc.lines) {
    requireThat(record(state.products, line.productId).active, 'Choose an active product.');
    whole(line.quantity, 'Quantity', 1); whole(line.unitPrice, 'Unit amount');
  }
  whole(doc.discount, 'Discount'); whole(doc.freight, 'Freight'); whole(doc.taxBps, 'Tax');
  const calculated = totals(doc);
  requireThat(doc.taxBps <= 10_000 && doc.discount <= calculated.subtotal, 'Check the discount and tax rate.');
  requireThat(Object.values(calculated).every(Number.isSafeInteger), 'Document total exceeds the safe limit.');
}
export function movement(id: string, at: string, productId: string, warehouseId: string, type: MovementType, quantity: number, source: string, note = ''): Movement {
  return { id, at, productId, warehouseId, type, quantity, source, note };
}
export const code = (prefix: string, rows: unknown[]) => `${prefix}-${1001 + rows.length}`;
