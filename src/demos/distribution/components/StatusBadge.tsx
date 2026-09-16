import type { MovementType } from '../distribution.types';
import { Badge, type BadgeTone } from '../../shared/ui/AppUI';

/**
 * Status badges.
 *
 * Every badge spells its status out. Colour reinforces the reading and is never
 * the only carrier of it, which keeps the workspace usable for somebody who
 * cannot distinguish copper from red.
 */

const PO_TONES: Record<string, BadgeTone> = {
  Draft: 'neutral',
  Submitted: 'info',
  Approved: 'active',
  'Partially Received': 'warning',
  Received: 'success',
  Cancelled: 'danger',
};

const ORDER_TONES: Record<string, BadgeTone> = {
  Draft: 'neutral',
  Confirmed: 'info',
  'Partially Allocated': 'warning',
  Allocated: 'active',
  Picking: 'active',
  'Ready to Ship': 'active',
  'Partially Shipped': 'warning',
  Shipped: 'success',
  Cancelled: 'danger',
};

const INVOICE_TONES: Record<string, BadgeTone> = {
  Draft: 'neutral',
  Sent: 'info',
  Partial: 'warning',
  Paid: 'success',
  Overdue: 'danger',
  Void: 'neutral',
};

const TRANSFER_TONES: Record<string, BadgeTone> = {
  Draft: 'neutral',
  'In Transit': 'warning',
  Received: 'success',
  Cancelled: 'danger',
};

const MOVEMENT_TONES: Record<MovementType, BadgeTone> = {
  OPENING_BALANCE: 'neutral',
  RECEIPT: 'success',
  SHIPMENT: 'info',
  TRANSFER_OUT: 'warning',
  TRANSFER_IN: 'active',
  RETURN_IN: 'success',
  ADJUSTMENT_IN: 'active',
  ADJUSTMENT_OUT: 'warning',
};

export const PurchaseOrderStatusBadge = ({ status }: { status: string }) => (
  <Badge tone={PO_TONES[status] ?? 'neutral'}>{status}</Badge>
);

export const OrderStatusBadge = ({ status }: { status: string }) => (
  <Badge tone={ORDER_TONES[status] ?? 'neutral'}>{status}</Badge>
);

export const InvoiceStatusBadge = ({ status }: { status: string }) => (
  <Badge tone={INVOICE_TONES[status] ?? 'neutral'}>{status}</Badge>
);

export const TransferStatusBadge = ({ status }: { status: string }) => (
  <Badge tone={TRANSFER_TONES[status] ?? 'neutral'}>{status}</Badge>
);

/** Movement type, shown as words rather than the enum spelling. */
export const MovementBadge = ({ type }: { type: MovementType }) => (
  <Badge tone={MOVEMENT_TONES[type]}>{movementLabel(type)}</Badge>
);

export const movementLabel = (type: MovementType) =>
  type
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** Stock level, described in words as well as colour. */
export function StockBadge({
  available,
  reorderPoint,
  active,
}: {
  available: number;
  reorderPoint: number;
  active: boolean;
}) {
  if (!active) return <Badge tone="neutral">Inactive</Badge>;
  if (available <= 0) return <Badge tone="danger">Out of stock</Badge>;
  if (available <= reorderPoint) return <Badge tone="warning">Low stock</Badge>;
  return <Badge tone="success">In stock</Badge>;
}
