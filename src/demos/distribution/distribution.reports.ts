import type { DistributionState } from './distribution.types';
import { matches, toDateOnly, totals } from './distribution.utils';
import {
  backorderQuantity,
  getCustomer,
  getOrder,
  getSupplier,
  inventoryValue,
  invoiceBalance,
  invoiceStatus,
  lowStockProducts,
  movementsFor,
  openInvoices,
  openOrders,
  openPurchaseOrders,
  orderStatus,
  poStatus,
  stock,
  awaitingAllocation,
  readyToShip,
  inboundUnits,
  backorderedUnits,
  outstandingReceivable,
  paymentsThisMonth,
} from './distribution.selectors';

/**
 * Dashboard, reporting and search.
 *
 * Every figure here is computed from the workspace as it stands — nothing is
 * stored and nothing is a projection. Posting a receipt or a shipment moves
 * these numbers immediately, because they read through the same selectors the
 * detail screens use.
 *
 * There are no targets, growth rates or benchmarks, and no accounting
 * statements: this product tracks operations, not the general ledger.
 */

// -------------------------------------------------------------- dashboard

export interface DashboardMetrics {
  inventoryValue: number;
  lowStockCount: number;
  openPurchaseOrders: number;
  inboundUnits: number;
  openOrders: number;
  awaitingAllocation: number;
  readyToShip: number;
  backorderedUnits: number;
  outstandingReceivable: number;
  paymentsThisMonth: number;
  paymentsThisMonthCount: number;
}

export function dashboardMetrics(state: DistributionState, now = new Date()): DashboardMetrics {
  const received = paymentsThisMonth(state, now);
  return {
    inventoryValue: inventoryValue(state),
    lowStockCount: lowStockProducts(state).length,
    openPurchaseOrders: openPurchaseOrders(state).length,
    inboundUnits: inboundUnits(state),
    openOrders: openOrders(state).length,
    awaitingAllocation: awaitingAllocation(state).length,
    readyToShip: readyToShip(state).length,
    backorderedUnits: backorderedUnits(state),
    outstandingReceivable: outstandingReceivable(state),
    paymentsThisMonth: received.reduce((sum, payment) => sum + payment.amount, 0),
    paymentsThisMonthCount: received.length,
  };
}

export const recentMovements = (state: DistributionState, limit = 10) =>
  movementsFor(state).slice(0, limit);

export const recentReceipts = (state: DistributionState, limit = 5) =>
  state.receipts.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);

export const recentShipments = (state: DistributionState, limit = 5) =>
  state.shipments.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);

/** Stock, value and low-stock count per warehouse. */
export const warehouseSummary = (state: DistributionState) =>
  state.warehouses.map((warehouse) => ({
    warehouse,
    units: state.products.reduce(
      (sum, product) => sum + stock(state, product.id, warehouse.id).onHand,
      0,
    ),
    value: inventoryValue(state, warehouse.id),
    lowStock: state.products.filter(
      (product) =>
        product.active && stock(state, product.id, warehouse.id).available <= product.reorderPoint,
    ).length,
  }));

// ---------------------------------------------------------------- reports

export interface Bucket {
  label: string;
  value: number;
  amount?: number;
}

function bucketize<T>(
  items: T[],
  labels: readonly string[],
  key: (item: T) => string,
  amount?: (item: T) => number,
): Bucket[] {
  return labels.map((label) => {
    const matching = items.filter((item) => key(item) === label);
    return {
      label,
      value: matching.length,
      amount: amount ? matching.reduce((sum, item) => sum + amount(item), 0) : undefined,
    };
  });
}

export const inventoryByWarehouse = (state: DistributionState): Bucket[] =>
  warehouseSummary(state).map((row) => ({
    label: row.warehouse.name,
    value: row.units,
    amount: row.value,
  }));

export const inventoryByCategory = (state: DistributionState): Bucket[] => {
  const categories = Array.from(new Set(state.products.map((product) => product.category))).sort();
  return categories.map((category) => {
    const products = state.products.filter((product) => product.category === category);
    return {
      label: category,
      value: products.reduce((sum, product) => sum + stock(state, product.id).onHand, 0),
      amount: products.reduce(
        (sum, product) => sum + stock(state, product.id).onHand * product.cost,
        0,
      ),
    };
  });
};

export const purchaseOrdersByStatus = (state: DistributionState, statuses: readonly string[]): Bucket[] =>
  bucketize(state.purchaseOrders, statuses, (po) => poStatus(state, po), (po) => totals(po).total);

export const salesOrdersByStatus = (state: DistributionState, statuses: readonly string[]): Bucket[] =>
  bucketize(state.orders, statuses, (order) => orderStatus(state, order), (order) => totals(order).total);

export const purchasingBySupplier = (state: DistributionState): Bucket[] =>
  state.suppliers
    .map((supplier) => {
      const orders = state.purchaseOrders.filter((po) => po.supplierId === supplier.id);
      return {
        label: supplier.name,
        value: orders.length,
        amount: orders.reduce((sum, po) => sum + totals(po).total, 0),
      };
    })
    .filter((bucket) => bucket.value > 0);

export const movementsByType = (state: DistributionState, types: readonly string[]): Bucket[] =>
  bucketize(state.movements, types, (row) => row.type, (row) => Math.abs(row.quantity));

export function invoiceAging(state: DistributionState, today = toDateOnly(new Date())): Bucket[] {
  const bands = [
    { label: 'Not yet due', min: -100_000, max: 0 },
    { label: '1-30 days', min: 1, max: 30 },
    { label: '31-60 days', min: 31, max: 60 },
    { label: '60+ days', min: 61, max: 100_000 },
  ];

  const open = openInvoices(state);
  const daysLate = (due: string) =>
    Math.round(
      (new Date(`${today}T00:00:00`).getTime() - new Date(`${due}T00:00:00`).getTime()) / 86_400_000,
    );

  return bands.map((band) => {
    const matching = open.filter((invoice) => {
      const late = daysLate(invoice.dueDate);
      return late >= band.min && late <= band.max;
    });
    return {
      label: band.label,
      value: matching.length,
      amount: matching.reduce((sum, invoice) => sum + invoiceBalance(state, invoice), 0),
    };
  });
}

/** Units actually shipped per product — the only "top products" claim made. */
export const topProductsByUnitsShipped = (state: DistributionState, limit = 8): Bucket[] =>
  state.products
    .map((product) => {
      const units = state.shipments.reduce((total, shipment) => {
        const order = getOrder(state, shipment.orderId);
        if (!order) return total;
        return (
          total +
          shipment.lines.reduce((sum, line) => {
            const ordered = order.lines.find((entry) => entry.id === line.lineId);
            return ordered?.productId === product.id ? sum + line.quantity : sum;
          }, 0)
        );
      }, 0);
      return { label: `${product.sku} - ${product.name}`, value: units };
    })
    .filter((bucket) => bucket.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);

/** Confirmed orders with units neither allocated nor shipped. */
export const backorderRows = (state: DistributionState) =>
  state.orders
    .filter((order) => order.status === 'Confirmed')
    .map((order) => ({ order, units: backorderQuantity(state, order) }))
    .filter((row) => row.units > 0);

export const paymentsByMethod = (state: DistributionState, methods: readonly string[]): Bucket[] =>
  bucketize(state.payments, methods, (payment) => payment.method, (payment) => payment.amount).filter(
    (bucket) => bucket.value > 0,
  );

// ----------------------------------------------------------------- search

export type SearchGroup =
  | 'Products'
  | 'Suppliers'
  | 'Customers'
  | 'Purchase Orders'
  | 'Sales Orders'
  | 'Shipments'
  | 'Invoices';

export interface SearchResult {
  id: string;
  label: string;
  meta: string;
  group: SearchGroup;
  href: string;
}

export type SearchLinks = Record<
  'product' | 'supplier' | 'customer' | 'purchaseOrder' | 'order' | 'shipment' | 'invoice',
  (id: string) => string
>;

/**
 * Global search across the records a distributor looks things up by: a SKU, a
 * product name, a trading partner, or any document number.
 */
export function searchWorkspace(
  state: DistributionState,
  query: string,
  href: SearchLinks,
  limit = 8,
): SearchResult[] {
  const needle = query.trim();
  if (needle.length < 2) return [];

  const results: SearchResult[] = [];

  for (const product of state.products) {
    if (matches(needle, product.sku, product.name, product.brand, product.category)) {
      results.push({
        id: product.id,
        label: `${product.sku} - ${product.name}`,
        meta: `${stock(state, product.id).available} available`,
        group: 'Products',
        href: href.product(product.id),
      });
    }
  }

  for (const supplier of state.suppliers) {
    if (matches(needle, supplier.name, supplier.code, supplier.contact)) {
      results.push({
        id: supplier.id,
        label: supplier.name,
        meta: supplier.code,
        group: 'Suppliers',
        href: href.supplier(supplier.id),
      });
    }
  }

  for (const customer of state.customers) {
    if (matches(needle, customer.name, customer.code, customer.contact)) {
      results.push({
        id: customer.id,
        label: customer.name,
        meta: customer.code,
        group: 'Customers',
        href: href.customer(customer.id),
      });
    }
  }

  for (const po of state.purchaseOrders) {
    if (matches(needle, po.code, getSupplier(state, po.supplierId)?.name)) {
      results.push({
        id: po.id,
        label: po.code,
        meta: `${getSupplier(state, po.supplierId)?.name ?? ''} - ${poStatus(state, po)}`,
        group: 'Purchase Orders',
        href: href.purchaseOrder(po.id),
      });
    }
  }

  for (const order of state.orders) {
    if (matches(needle, order.code, getCustomer(state, order.customerId)?.name)) {
      results.push({
        id: order.id,
        label: order.code,
        meta: `${getCustomer(state, order.customerId)?.name ?? ''} - ${orderStatus(state, order)}`,
        group: 'Sales Orders',
        href: href.order(order.id),
      });
    }
  }

  for (const shipment of state.shipments) {
    if (matches(needle, shipment.code, shipment.tracking, shipment.carrier)) {
      results.push({
        id: shipment.id,
        label: shipment.code,
        meta: shipment.carrier,
        group: 'Shipments',
        href: href.shipment(shipment.id),
      });
    }
  }

  for (const invoice of state.invoices) {
    if (matches(needle, invoice.code, getCustomer(state, invoice.customerId)?.name)) {
      results.push({
        id: invoice.id,
        label: invoice.code,
        meta: invoiceStatus(state, invoice),
        group: 'Invoices',
        href: href.invoice(invoice.id),
      });
    }
  }

  return results.slice(0, limit);
}
