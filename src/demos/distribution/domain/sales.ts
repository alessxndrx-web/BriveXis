import type { DistributionState, Partner, SalesOrder, EventLine } from '../distribution.types';
import { code, record, requireThat, validateDocument, movement, whole } from '../distribution.utils';
import { stock, shippedQuantity, lineAllocation } from '../distribution.selectors';
export type SalesCommand =
  | { type: 'customer/save'; partner: Partner }
  | { type: 'order/save'; order: SalesOrder }
  | { type: 'order/allocate' | 'order/pick' | 'order/pack'; orderId: string }
  | { type: 'shipment/post'; orderId: string; lines: EventLine[]; date: string; carrier: string; tracking: string }
  | { type: 'order/confirm' | 'order/cancel'; orderId: string };
export function sales(state: DistributionState, action: SalesCommand & { id: string; at: string }): DistributionState {
  switch (action.type) {
    case 'shipment/post': {
      if (state.shipments.some(s => s.id === action.id)) return state;
      const order = record(state.orders, action.orderId);
      requireThat(order.status === 'Confirmed', 'Only confirmed orders can ship.');
      requireThat(action.date >= order.date && action.carrier.trim(), 'Provide a carrier and valid shipment date.');
      requireThat(action.lines.length > 0 && new Set(action.lines.map(l => l.lineId)).size === action.lines.length, 'Choose unique shipment lines.');
      for (const entry of action.lines) {
        const line = record(order.lines, entry.lineId); whole(entry.quantity, 'Shipment quantity', 1);
        const allocation = lineAllocation(state, order.id, line.id);
        requireThat(allocation && entry.quantity <= allocation.packed && entry.quantity <= allocation.picked && entry.quantity <= allocation.quantity, 'Ship only allocated, picked and packed quantities.');
        requireThat(entry.quantity <= stock(state, line.productId, order.warehouseId).onHand, 'Insufficient physical inventory.');
        requireThat(entry.quantity <= line.quantity - shippedQuantity(state, order.id, line.id), 'Shipment exceeds the outstanding order quantity.');
      }
      const shipment = { id: action.id, code: code('SHP', state.shipments), orderId: order.id, warehouseId: order.warehouseId, date: action.date, lines: action.lines.map(l => ({ ...l })), carrier: action.carrier.trim(), tracking: action.tracking };
      return { ...state, shipments: [...state.shipments, shipment], allocations: state.allocations.map(a => {
        const shipped = a.orderId === order.id ? action.lines.find(l => l.lineId === a.lineId)?.quantity ?? 0 : 0;
        return shipped ? { ...a, quantity: a.quantity - shipped, picked: a.picked - shipped, packed: a.packed - shipped } : a;
      }).filter(a => a.quantity > 0), movements: [...state.movements, ...action.lines.map(l => movement(`${action.id}:${l.lineId}`, action.at, record(order.lines, l.lineId).productId, order.warehouseId, 'SHIPMENT', -l.quantity, shipment.code))] };
    }
    case 'order/allocate': {
      const order = record(state.orders, action.orderId); requireThat(order.status === 'Confirmed', 'Only confirmed orders can allocate stock.');
      const next = { ...state, allocations: state.allocations.map(a => ({ ...a })) };
      let added = 0;
      for (const line of order.lines) {
        const existing = lineAllocation(next, order.id, line.id);
        const remaining = line.quantity - shippedQuantity(state, order.id, line.id) - (existing?.quantity ?? 0);
        const quantity = Math.min(remaining, stock(next, line.productId, order.warehouseId).available);
        if (quantity <= 0) continue;
        added += quantity;
        if (existing) existing.quantity += quantity;
        else next.allocations.push({ id: `${order.id}:${line.id}`, orderId: order.id, lineId: line.id, productId: line.productId, warehouseId: order.warehouseId, quantity, picked: 0, packed: 0 });
      }
      requireThat(added > 0, 'No additional stock is available to allocate. Outstanding units remain on backorder.');
      return next;
    }
    case 'order/pick': case 'order/pack': {
      const order = record(state.orders, action.orderId); requireThat(order.status === 'Confirmed', 'Only confirmed orders can be fulfilled.');
      const allocations = state.allocations.filter(a => a.orderId === order.id);
      requireThat(allocations.some(a => action.type === 'order/pick' ? a.quantity > a.picked : a.picked > a.packed), action.type === 'order/pick' ? 'Allocate stock before picking.' : 'Pick stock before packing.');
      return { ...state, allocations: state.allocations.map(a => a.orderId !== order.id ? a : action.type === 'order/pick' ? { ...a, picked: a.quantity } : { ...a, packed: a.picked }) };
    }
    case 'customer/save': {
      const p = action.partner; requireThat(p.name.trim(), 'Customer name is required.');
      const existing = state.customers.find(row => row.id === p.id);
      return { ...state, customers: [...state.customers.filter(row => row.id !== p.id), { ...p, code: existing?.code ?? code('CUS', state.customers) }] };
    }
    case 'order/save': {
      const order = action.order; const existing = state.orders.find(row => row.id === order.id);
      requireThat(!existing || existing.status === 'Draft', 'Only draft sales orders can be edited.');
      requireThat(record(state.customers, order.customerId).active, 'Choose an active customer.'); record(state.warehouses, order.warehouseId);
      requireThat(order.date && order.requestedDate >= order.date && order.shippingAddress.trim(), 'Provide a shipping address and a requested date on or after the order date.');
      validateDocument(state, order);
      return { ...state, orders: [...state.orders.filter(row => row.id !== order.id), { ...order, lines: order.lines.map(l => ({ ...l })), code: existing?.code ?? code('SO', state.orders), status: 'Draft' }] };
    }
    case 'order/confirm': case 'order/cancel': {
      const order = record(state.orders, action.orderId);
      requireThat(action.type === 'order/confirm' ? order.status === 'Draft' : order.status !== 'Cancelled', 'Invalid sales order transition.');
      return { ...state, orders: state.orders.map(row => row.id === order.id ? { ...row, status: action.type === 'order/confirm' ? 'Confirmed' : 'Cancelled' } : row), allocations: action.type === 'order/cancel' ? state.allocations.filter(a => a.orderId !== order.id) : state.allocations };
    }
  }
}
