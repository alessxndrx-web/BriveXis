import type { DistributionState, Product, PurchaseOrder, SalesOrder, Invoice } from './distribution.types';
import { totals } from './distribution.utils';
import { toDateOnly } from '../shared/format';

export function stock(state: DistributionState, productId: string, warehouseId?: string) {
  const match = (row: { productId: string; warehouseId: string }) => row.productId === productId && (!warehouseId || row.warehouseId === warehouseId);
  const onHand = state.movements.filter(match).reduce((sum, row) => sum + row.quantity, 0);
  const allocated = state.allocations.filter(match).reduce((sum, row) => sum + row.quantity, 0);
  return { onHand, allocated, available: onHand - allocated };
}
export const lowStock = (state: DistributionState, product: Product) => product.active && stock(state, product.id).available <= product.reorderPoint;
export const receivedQuantity = (state: DistributionState, poId: string, lineId: string) => state.receipts.filter(r => r.poId === poId).flatMap(r => r.lines).filter(l => l.lineId === lineId).reduce((sum, l) => sum + l.quantity, 0);
export function poStatus(state: DistributionState, po: PurchaseOrder) {
  if (po.status === 'Cancelled') return 'Cancelled';
  if (po.lines.every(l => receivedQuantity(state, po.id, l.id) === l.quantity)) return 'Received';
  if (po.lines.some(l => receivedQuantity(state, po.id, l.id) > 0)) return 'Partially Received';
  return po.status;
}
export const shippedQuantity = (state: DistributionState, orderId: string, lineId: string) => state.shipments.filter(s => s.orderId === orderId).flatMap(s => s.lines).filter(l => l.lineId === lineId).reduce((n, l) => n + l.quantity, 0);
export const lineAllocation = (state: DistributionState, orderId: string, lineId: string) => state.allocations.find(a => a.orderId === orderId && a.lineId === lineId);
export function orderStatus(state: DistributionState, order: SalesOrder) {
  if (order.status !== 'Confirmed') return order.status;
  if (order.lines.every(l => shippedQuantity(state, order.id, l.id) === l.quantity)) return 'Shipped';
  if (order.lines.some(l => shippedQuantity(state, order.id, l.id) > 0)) return 'Partially Shipped';
  const allocated = state.allocations.filter(a => a.orderId === order.id);
  if (allocated.some(a => a.packed > 0)) return 'Ready to Ship';
  if (allocated.some(a => a.picked > 0)) return 'Picking';
  if (order.lines.every(l => (lineAllocation(state, order.id, l.id)?.quantity ?? 0) === l.quantity)) return 'Allocated';
  return allocated.some(a => a.quantity > 0) ? 'Partially Allocated' : 'Confirmed';
}
/**
 * Units on a line that are neither shipped nor reserved — the work still to do.
 *
 * This is not the same thing as a backorder. A line can be entirely unallocated
 * simply because nobody has pressed Allocate yet, with plenty of stock on the
 * shelf waiting for it.
 */
export const unallocatedOnLine = (state: DistributionState, order: SalesOrder, lineId: string, ordered: number) =>
  Math.max(0, ordered - shippedQuantity(state, order.id, lineId) - (lineAllocation(state, order.id, lineId)?.quantity ?? 0));

export const unallocatedQuantity = (state: DistributionState, order: SalesOrder) =>
  order.status === 'Cancelled' ? 0 : order.lines.reduce((sum, l) => sum + unallocatedOnLine(state, order, l.id, l.quantity), 0);

/**
 * Units this order cannot fulfil today: the outstanding quantity that exceeds
 * what is actually available at its warehouse.
 *
 * Allocating does not change this figure, which is the point — reserving stock
 * moves units out of "available" and into this order's allocation at the same
 * rate, so the shortfall is a property of the business, not of how far along
 * the paperwork is.
 */
export const backorderQuantity = (state: DistributionState, order: SalesOrder) =>
  order.status === 'Cancelled'
    ? 0
    : order.lines.reduce(
        (sum, l) =>
          sum +
          Math.max(
            0,
            unallocatedOnLine(state, order, l.id, l.quantity) -
              stock(state, l.productId, order.warehouseId).available,
          ),
        0,
      );
export const invoicePaid = (state: DistributionState, invoiceId: string) => state.payments.filter(p => p.invoiceId === invoiceId).reduce((n, p) => n + p.amount, 0);
export const invoiceBalance = (state: DistributionState, invoice: Invoice) => totals(invoice).total - invoicePaid(state, invoice.id);
export function invoiceStatus(state: DistributionState, invoice: Invoice, today = toDateOnly(new Date())) {
  if (invoice.status === 'Void' || invoice.status === 'Draft') return invoice.status;
  if (invoiceBalance(state, invoice) === 0) return 'Paid';
  if (invoicePaid(state, invoice.id) > 0) return 'Partial';
  return invoice.dueDate < today ? 'Overdue' : 'Sent';
}

// ---------------------------------------------------------------- lookups

export const getProduct = (state: DistributionState, id?: string) =>
  id ? state.products.find((row) => row.id === id) : undefined;
export const getWarehouse = (state: DistributionState, id?: string) =>
  id ? state.warehouses.find((row) => row.id === id) : undefined;
export const getSupplier = (state: DistributionState, id?: string) =>
  id ? state.suppliers.find((row) => row.id === id) : undefined;
export const getCustomer = (state: DistributionState, id?: string) =>
  id ? state.customers.find((row) => row.id === id) : undefined;
export const getPurchaseOrder = (state: DistributionState, id?: string) =>
  id ? state.purchaseOrders.find((row) => row.id === id) : undefined;
export const getOrder = (state: DistributionState, id?: string) =>
  id ? state.orders.find((row) => row.id === id) : undefined;
export const getShipment = (state: DistributionState, id?: string) =>
  id ? state.shipments.find((row) => row.id === id) : undefined;
export const getInvoice = (state: DistributionState, id?: string) =>
  id ? state.invoices.find((row) => row.id === id) : undefined;
export const getReceipt = (state: DistributionState, id?: string) =>
  id ? state.receipts.find((row) => row.id === id) : undefined;

export const productName = (state: DistributionState, id: string) =>
  getProduct(state, id)?.name ?? 'Unknown product';
export const warehouseName = (state: DistributionState, id: string) =>
  getWarehouse(state, id)?.name ?? 'Unknown warehouse';

// -------------------------------------------------------------- inventory

/** Stock for one product in every warehouse, for the by-warehouse views. */
export const stockByWarehouse = (state: DistributionState, productId: string) =>
  state.warehouses.map((warehouse) => ({
    warehouse,
    ...stock(state, productId, warehouse.id),
  }));

/** Value of everything on hand, at cost. The only valuation this demo claims. */
export function inventoryValue(state: DistributionState, warehouseId?: string) {
  return state.products.reduce(
    (total, product) => total + stock(state, product.id, warehouseId).onHand * product.cost,
    0,
  );
}

export const lowStockProducts = (state: DistributionState) =>
  state.products.filter((product) => lowStock(state, product));

export const movementsFor = (
  state: DistributionState,
  filter: { productId?: string; warehouseId?: string } = {},
) =>
  state.movements
    .filter(
      (row) =>
        (!filter.productId || row.productId === filter.productId) &&
        (!filter.warehouseId || row.warehouseId === filter.warehouseId),
    )
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at));

// -------------------------------------------------------------- purchasing

/** Units ordered but not yet received, across every open purchase order. */
export function inboundUnits(state: DistributionState) {
  return state.purchaseOrders
    .filter((po) => po.status !== 'Cancelled' && poStatus(state, po) !== 'Received')
    .reduce(
      (total, po) =>
        total +
        po.lines.reduce(
          (sum, line) => sum + Math.max(0, line.quantity - receivedQuantity(state, po.id, line.id)),
          0,
        ),
      0,
    );
}

export const openPurchaseOrders = (state: DistributionState) =>
  state.purchaseOrders.filter((po) => {
    const status = poStatus(state, po);
    return status !== 'Received' && status !== 'Cancelled';
  });

/** Approved orders with something still outstanding — the receiving queue. */
export const awaitingReceipt = (state: DistributionState) =>
  state.purchaseOrders.filter((po) => {
    if (po.status !== 'Approved') return false;
    return po.lines.some((line) => receivedQuantity(state, po.id, line.id) < line.quantity);
  });

export const outstandingOnLine = (state: DistributionState, poId: string, lineId: string, ordered: number) =>
  ordered - receivedQuantity(state, poId, lineId);

// ------------------------------------------------------------------ sales

export const openOrders = (state: DistributionState) =>
  state.orders.filter((order) => {
    const status = orderStatus(state, order);
    return status !== 'Shipped' && status !== 'Cancelled';
  });

export const awaitingAllocation = (state: DistributionState) =>
  state.orders.filter((order) => {
    const status = orderStatus(state, order);
    return status === 'Confirmed' || status === 'Partially Allocated';
  });

export const readyToShip = (state: DistributionState) =>
  state.orders.filter((order) => orderStatus(state, order) === 'Ready to Ship');

/** Units on confirmed orders with neither stock allocated nor a shipment. */
export const backorderedUnits = (state: DistributionState) =>
  state.orders
    .filter((order) => order.status === 'Confirmed')
    .reduce((total, order) => total + Math.max(0, backorderQuantity(state, order)), 0);

export const orderAllocations = (state: DistributionState, orderId: string) =>
  state.allocations.filter((row) => row.orderId === orderId);

export const orderShipments = (state: DistributionState, orderId: string) =>
  state.shipments.filter((row) => row.orderId === orderId);

/** Orders that have shipped everything but have no active invoice yet. */
export const awaitingInvoice = (state: DistributionState) =>
  state.orders.filter(
    (order) =>
      orderStatus(state, order) === 'Shipped' &&
      !state.invoices.some((invoice) => invoice.orderId === order.id && invoice.status !== 'Void'),
  );

// ---------------------------------------------------------------- finance

export const openInvoices = (state: DistributionState) =>
  state.invoices.filter((invoice) => {
    const status = invoiceStatus(state, invoice);
    return status === 'Sent' || status === 'Partial' || status === 'Overdue';
  });

export const outstandingReceivable = (state: DistributionState) =>
  openInvoices(state).reduce((total, invoice) => total + invoiceBalance(state, invoice), 0);

export function paymentsThisMonth(state: DistributionState, now = new Date()) {
  return state.payments.filter((payment) => {
    const date = new Date(`${payment.date}T00:00:00`);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
}

export const customerInvoices = (state: DistributionState, customerId: string) =>
  state.invoices.filter((invoice) => invoice.customerId === customerId);

export const invoicePayments = (state: DistributionState, invoiceId: string) =>
  state.payments.filter((payment) => payment.invoiceId === invoiceId);
