import type { DistributionState, Partner, PurchaseOrder, EventLine } from '../distribution.types';
import { code, record, requireThat, validateDocument, whole, movement } from '../distribution.utils';
import { receivedQuantity } from '../distribution.selectors';
export type PurchasingCommand =
  | { type: 'supplier/save'; partner: Partner }
  | { type: 'po/save'; po: PurchaseOrder }
  | { type: 'receipt/post'; poId: string; lines: EventLine[]; date: string; reference: string; notes: string }
  | { type: 'po/status'; poId: string; status: 'Submitted' | 'Approved' | 'Cancelled' };
export function purchasing(state: DistributionState, action: PurchasingCommand & { id: string; at: string }): DistributionState {
  switch (action.type) {
    case 'receipt/post': {
      if (state.receipts.some(r => r.id === action.id)) return state;
      const po = record(state.purchaseOrders, action.poId);
      requireThat(po.status === 'Approved', 'Only approved purchase orders can receive goods.');
      requireThat(action.date >= po.date, 'Receipt date must be on or after the order date.');
      requireThat(action.lines.length > 0 && new Set(action.lines.map(l => l.lineId)).size === action.lines.length, 'Choose unique receipt lines.');
      for (const entry of action.lines) {
        const line = record(po.lines, entry.lineId); whole(entry.quantity, 'Received quantity', 1);
        requireThat(entry.quantity <= line.quantity - receivedQuantity(state, po.id, line.id), 'Receipt exceeds the remaining ordered quantity.');
      }
      const receipt = { id: action.id, code: code('RCV', state.receipts), poId: po.id, warehouseId: po.warehouseId, date: action.date, lines: action.lines.map(l => ({ ...l })), reference: action.reference, notes: action.notes };
      return { ...state, receipts: [...state.receipts, receipt], movements: [...state.movements, ...action.lines.map(l => movement(`${action.id}:${l.lineId}`, action.at, record(po.lines, l.lineId).productId, po.warehouseId, 'RECEIPT', l.quantity, receipt.code, action.notes))] };
    }
    case 'supplier/save': {
      const p = action.partner;
      requireThat(p.name.trim(), 'Company name is required.'); whole(p.leadDays, 'Lead time');
      const existing = state.suppliers.find(row => row.id === p.id);
      return { ...state, suppliers: [...state.suppliers.filter(row => row.id !== p.id), { ...p, code: existing?.code ?? code('SUP', state.suppliers) }] };
    }
    case 'po/save': {
      const p = action.po; const existing = state.purchaseOrders.find(row => row.id === p.id);
      requireThat(!existing || existing.status === 'Draft', 'Only draft purchase orders can be edited.');
      requireThat(record(state.suppliers, p.supplierId).active, 'Choose an active supplier.'); record(state.warehouses, p.warehouseId);
      requireThat(p.date && p.expectedDate && p.expectedDate >= p.date, 'Expected date must be on or after the order date.');
      validateDocument(state, p);
      return { ...state, purchaseOrders: [...state.purchaseOrders.filter(row => row.id !== p.id), { ...p, lines: p.lines.map(l => ({ ...l })), status: 'Draft', code: existing?.code ?? code('PO', state.purchaseOrders) }] };
    }
    case 'po/status': {
      const po = record(state.purchaseOrders, action.poId);
      requireThat(action.status === 'Submitted' ? po.status === 'Draft' : action.status === 'Approved' ? po.status === 'Submitted' : po.status !== 'Cancelled', 'Invalid purchase order transition.');
      return { ...state, purchaseOrders: state.purchaseOrders.map(row => row.id === po.id ? { ...row, status: action.status } : row) };
    }
  }
}
