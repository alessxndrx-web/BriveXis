import type { Address, Cents, DateOnly, Timestamp } from '../shared/types';

export type { Address, Cents, DateOnly, Timestamp };

/**
 * Distribution Operations — domain model.
 *
 * The scarce thing here is physical stock, and the one rule the whole model is
 * built around is that there is a single source of truth for it: the signed
 * movement ledger. Nothing stores an on-hand quantity. Warehouse stock is the
 * sum of that warehouse's movements; product stock is the sum across
 * warehouses. Two numbers that are derived from the same ledger cannot drift
 * apart, which is what a distributor cannot afford.
 *
 * Money is whole cents and tax is integer basis points, rounded once per
 * document. Dates are ISO strings so a workspace round-trips through browser
 * storage unchanged.
 */

export interface Product {
  id: string; sku: string; name: string; description: string; category: string;
  brand: string; unit: string; cost: Cents; price: Cents; reorderPoint: number;
  supplierId: string; active: boolean;
}
export interface Warehouse {
  id: string;
  name: string;
  /** Short code used on labels and transfer paperwork, e.g. DAL. */
  short: string;
  address: Address;
}

/** Suppliers and customers share a shape; only the direction of trade differs. */
export interface Partner {
  id: string;
  code: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: Address;
  /** Where goods go. Empty for a supplier, and for a customer who ships to billing. */
  shippingAddress?: Address;
  /** Informational only. This demo has no accounts payable or receivable ageing engine. */
  terms: string;
  leadDays: number;
  active: boolean;
}
export const MOVEMENT_TYPES = [
  'OPENING_BALANCE',
  'RECEIPT',
  'SHIPMENT',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'RETURN_IN',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
] as const;

export type MovementType = (typeof MOVEMENT_TYPES)[number];
/** Signed quantities throughout. Ledger is the only physical stock source. */
export interface Movement {
  id: string; productId: string; warehouseId: string; type: MovementType; quantity: number;
  at: Timestamp; source: string; note: string;
}
export interface Line { id: string; productId: string; quantity: number; unitPrice: Cents }
export interface DocumentAmounts { lines: Line[]; discount: Cents; taxBps: number; freight: Cents }
export interface PurchaseOrder extends DocumentAmounts {
  id: string; code: string; supplierId: string; warehouseId: string; date: DateOnly;
  expectedDate: DateOnly; notes: string; status: 'Draft' | 'Submitted' | 'Approved' | 'Cancelled';
}
export interface EventLine { lineId: string; quantity: number }
export interface Receipt {
  id: string; code: string; poId: string; warehouseId: string; date: DateOnly;
  lines: EventLine[]; reference: string; notes: string;
}
export interface SalesOrder extends DocumentAmounts {
  id: string; code: string; customerId: string; warehouseId: string; date: DateOnly;
  requestedDate: DateOnly; shippingAddress: string; notes: string; status: 'Draft' | 'Confirmed' | 'Cancelled';
}
export interface Allocation {
  id: string; orderId: string; lineId: string; productId: string; warehouseId: string;
  quantity: number; picked: number; packed: number;
}
export interface Shipment {
  id: string; code: string; orderId: string; warehouseId: string; date: DateOnly;
  lines: EventLine[]; carrier: string; tracking: string;
}
export interface Invoice extends DocumentAmounts {
  id: string; code: string; orderId: string; customerId: string; date: DateOnly;
  dueDate: DateOnly; status: 'Draft' | 'Sent' | 'Void';
}
export type PaymentMethod = 'ACH' | 'Check' | 'Card' | 'Cash' | 'Wire' | 'Other';
export interface Payment { id: string; code: string; invoiceId: string; customerId: string; date: DateOnly; amount: Cents; method: PaymentMethod; reference: string }
export interface Transfer { id: string; code: string; productId: string; from: string; to: string; quantity: number; status: 'Draft' | 'In Transit' | 'Received' | 'Cancelled'; date: DateOnly; note: string }
export interface ReturnRecord { id: string; code: string; shipmentId: string; lineId: string; quantity: number; disposition: 'Return to Stock' | 'Damaged'; reason: string; date: DateOnly }
export interface Activity { id: string; at: Timestamp; label: string; href: string }
export interface DistributionSettings {
  companyName: string;
  legalLine: string;
  address: Address;
  phone: string;
  email: string;
  /** Applied to new sales orders. Integer basis points: 825 = 8.25%. */
  defaultTaxBps: number;
  /** Days added to an invoice date to get its due date. */
  paymentTermsDays: number;
}

export interface DistributionState {
  schemaVersion: 2;
  settings: DistributionSettings; products: Product[]; warehouses: Warehouse[]; suppliers: Partner[]; customers: Partner[];
  movements: Movement[]; purchaseOrders: PurchaseOrder[]; receipts: Receipt[]; orders: SalesOrder[];
  allocations: Allocation[]; shipments: Shipment[]; invoices: Invoice[]; payments: Payment[];
  transfers: Transfer[]; returns: ReturnRecord[]; activity: Activity[];
}
