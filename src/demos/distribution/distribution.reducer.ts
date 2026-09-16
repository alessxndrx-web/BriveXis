import { buildSeedState } from './distribution.seed';
import type { DistributionState, Product } from './distribution.types';
import { movement, record, requireThat, whole } from './distribution.utils';
import { stock } from './distribution.selectors';
import { purchasing, type PurchasingCommand } from './domain/purchasing';
import { sales, type SalesCommand } from './domain/sales';
import { finance, type FinanceCommand } from './domain/finance';
import { logistics, type LogisticsCommand } from './domain/logistics';

export type Command =
  | PurchasingCommand
  | SalesCommand
  | FinanceCommand
  | LogisticsCommand
  | { type: 'product/save'; product: Product }
  | { type: 'inventory/adjust'; productId: string; warehouseId: string; quantity: number; reason: string };
export type DistributionAction = { type: 'reset' } | (Command & { id: string; at: string });
export function distributionReducer(state: DistributionState, action: DistributionAction): DistributionState {
  if (action.type === 'reset') return buildSeedState();
  if (state.activity.some(row => row.id === action.id)) return state;
  let next = state;
  switch (action.type) {
    case 'invoice/create': case 'invoice/send': case 'invoice/void': case 'payment/post': next = finance(state, action); break;
    case 'customer/save': case 'order/save': case 'order/confirm': case 'order/cancel': case 'order/allocate': case 'order/pick': case 'order/pack': case 'shipment/post': next = sales(state, action); break;
    case 'supplier/save': case 'po/save': case 'po/status': case 'receipt/post': next = purchasing(state, action); break;
    case 'transfer/save': case 'transfer/ship': case 'transfer/receive': case 'transfer/cancel': case 'return/post': next = logistics(state, action); break;
    case 'product/save': {
      const p = action.product;
      requireThat(p.name.trim() && p.sku.trim() && p.unit.trim(), 'Name, SKU and unit are required.');
      requireThat(!state.products.some(row => row.id !== p.id && row.sku.toLowerCase() === p.sku.toLowerCase()), 'SKU is already in use.');
      whole(p.cost, 'Cost'); whole(p.price, 'Price'); whole(p.reorderPoint, 'Reorder point');
      if (p.supplierId) record(state.suppliers, p.supplierId);
      next = { ...state, products: [...state.products.filter(row => row.id !== p.id), { ...p }] };
      break;
    }
    case 'inventory/adjust': {
      record(state.products, action.productId); record(state.warehouses, action.warehouseId);
      whole(Math.abs(action.quantity), 'Quantity', 1);
      requireThat(action.reason.trim(), 'An adjustment reason is required.');
      requireThat(stock(state, action.productId, action.warehouseId).available + action.quantity >= 0, 'Adjustment would consume allocated stock or make inventory negative.');
      next = { ...state, movements: [...state.movements, movement(action.id, action.at, action.productId, action.warehouseId, action.quantity > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT', action.quantity, action.id, action.reason)] };
      break;
    }
  }
  if (next !== state) return { ...next, activity: [...next.activity, { id: action.id, at: action.at, label: action.type, href: 'inventory' }] };
  return state;
}
