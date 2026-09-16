import type { DistributionState, EventLine, ReturnRecord, Transfer } from '../distribution.types';
import { code, movement, record, requireThat, whole } from '../distribution.utils';
import { shippedQuantity, stock } from '../distribution.selectors';

/**
 * Warehouse transfers and customer returns.
 *
 * Both move physical stock, so both go through the movement ledger and nothing
 * else. The two rules that matter:
 *
 *   A transfer conserves global inventory. Shipping it posts TRANSFER_OUT at
 *   the source; receiving it posts TRANSFER_IN at the destination. In between,
 *   the units belong to neither warehouse — which is the honest answer, and is
 *   what stops the same pallet being counted twice.
 *
 *   A return is its own event, never an undo. The original shipment stays
 *   posted, because it happened. Stock only comes back when the disposition
 *   says the goods are sellable; damaged goods generate no movement at all,
 *   so they can never be sold to somebody else.
 */

export type LogisticsCommand =
  | { type: 'transfer/save'; transfer: Transfer }
  | { type: 'transfer/ship'; transferId: string }
  | { type: 'transfer/receive'; transferId: string }
  | { type: 'transfer/cancel'; transferId: string }
  | {
      type: 'return/post';
      shipmentId: string;
      lines: (EventLine & { disposition: ReturnRecord['disposition']; reason: string })[];
      date: string;
    };

export function logistics(
  state: DistributionState,
  action: LogisticsCommand & { id: string; at: string },
): DistributionState {
  switch (action.type) {
    // ------------------------------------------------------------ transfers

    case 'transfer/save': {
      const transfer = action.transfer;
      const existing = state.transfers.find((row) => row.id === transfer.id);

      requireThat(!existing || existing.status === 'Draft', 'Only draft transfers can be edited.');
      requireThat(transfer.from !== transfer.to, 'Choose two different warehouses.');
      record(state.warehouses, transfer.from);
      record(state.warehouses, transfer.to);
      record(state.products, transfer.productId);
      whole(transfer.quantity, 'Quantity', 1);

      return {
        ...state,
        transfers: [
          ...state.transfers.filter((row) => row.id !== transfer.id),
          {
            ...transfer,
            status: 'Draft',
            code: existing?.code ?? code('TRF', state.transfers),
          },
        ],
      };
    }

    case 'transfer/ship': {
      const transfer = record(state.transfers, action.transferId);
      requireThat(transfer.status === 'Draft', 'Only draft transfers can be shipped.');

      // Available, not on hand: stock already promised to a customer order
      // cannot be quietly moved to another building.
      const source = stock(state, transfer.productId, transfer.from);
      requireThat(
        transfer.quantity <= source.available,
        'The source warehouse does not have that much unallocated stock.',
      );

      return {
        ...state,
        transfers: state.transfers.map((row) =>
          row.id === transfer.id ? { ...row, status: 'In Transit' } : row,
        ),
        movements: [
          ...state.movements,
          movement(
            `${action.id}:out`,
            action.at,
            transfer.productId,
            transfer.from,
            'TRANSFER_OUT',
            -transfer.quantity,
            transfer.code,
            transfer.note,
          ),
        ],
      };
    }

    case 'transfer/receive': {
      const transfer = record(state.transfers, action.transferId);
      requireThat(transfer.status === 'In Transit', 'Only transfers in transit can be received.');

      return {
        ...state,
        transfers: state.transfers.map((row) =>
          row.id === transfer.id ? { ...row, status: 'Received' } : row,
        ),
        movements: [
          ...state.movements,
          movement(
            `${action.id}:in`,
            action.at,
            transfer.productId,
            transfer.to,
            'TRANSFER_IN',
            transfer.quantity,
            transfer.code,
            transfer.note,
          ),
        ],
      };
    }

    case 'transfer/cancel': {
      const transfer = record(state.transfers, action.transferId);
      // A transfer already in transit has stock outside both warehouses;
      // cancelling it would strand those units. It has to be received first.
      requireThat(
        transfer.status === 'Draft',
        'A transfer can only be cancelled before it ships. Receive it at the destination instead.',
      );
      return {
        ...state,
        transfers: state.transfers.map((row) =>
          row.id === transfer.id ? { ...row, status: 'Cancelled' } : row,
        ),
      };
    }

    // -------------------------------------------------------------- returns

    case 'return/post': {
      if (state.returns.some((row) => row.id.startsWith(action.id))) return state;

      const shipment = record(state.shipments, action.shipmentId);
      const order = record(state.orders, shipment.orderId);
      requireThat(action.date >= shipment.date, 'A return cannot predate its shipment.');
      requireThat(action.lines.length > 0, 'Choose at least one line to return.');
      requireThat(
        new Set(action.lines.map((line) => line.lineId)).size === action.lines.length,
        'Use one return line per shipped line.',
      );

      for (const entry of action.lines) {
        const shippedLine = shipment.lines.find((line) => line.lineId === entry.lineId);
        requireThat(shippedLine, 'That line is not part of this shipment.');
        whole(entry.quantity, 'Return quantity', 1);
        requireThat(entry.reason.trim(), 'Give a reason for the return.');

        const alreadyReturned = state.returns
          .filter((row) => row.shipmentId === shipment.id && row.lineId === entry.lineId)
          .reduce((sum, row) => sum + row.quantity, 0);

        requireThat(
          entry.quantity + alreadyReturned <= shippedLine!.quantity,
          'That is more than was shipped on this line.',
        );
      }

      const records: ReturnRecord[] = action.lines.map((entry, index) => ({
        id: `${action.id}:${entry.lineId}`,
        code: code('RMA', [...state.returns, ...action.lines.slice(0, index)]),
        shipmentId: shipment.id,
        lineId: entry.lineId,
        quantity: entry.quantity,
        disposition: entry.disposition,
        reason: entry.reason.trim(),
        date: action.date,
      }));

      // Only sellable goods come back into stock. A damaged return is recorded
      // so the history is complete, but it posts no movement — so it can never
      // be allocated or shipped to the next customer.
      const restocked = action.lines.filter((entry) => entry.disposition === 'Return to Stock');

      return {
        ...state,
        returns: [...state.returns, ...records],
        movements: [
          ...state.movements,
          ...restocked.map((entry) =>
            movement(
              `${action.id}:${entry.lineId}:in`,
              action.at,
              record(order.lines, entry.lineId).productId,
              shipment.warehouseId,
              'RETURN_IN',
              entry.quantity,
              shipment.code,
              entry.reason.trim(),
            ),
          ),
        ],
      };
    }
  }
}

/** Units of a shipped line the customer has already sent back. */
export const returnedQuantity = (state: DistributionState, shipmentId: string, lineId: string) =>
  state.returns
    .filter((row) => row.shipmentId === shipmentId && row.lineId === lineId)
    .reduce((sum, row) => sum + row.quantity, 0);

/** Units still out with the customer on a shipped order line. */
export const outstandingWithCustomer = (
  state: DistributionState,
  orderId: string,
  lineId: string,
) =>
  shippedQuantity(state, orderId, lineId) -
  state.returns
    .filter((row) => row.lineId === lineId)
    .filter((row) => state.shipments.find((s) => s.id === row.shipmentId)?.orderId === orderId)
    .reduce((sum, row) => sum + row.quantity, 0);
