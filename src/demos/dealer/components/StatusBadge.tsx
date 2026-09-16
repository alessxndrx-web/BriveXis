import type {
  DealStatus,
  DocumentStatus,
  FinancingStatus,
  LeadStage,
  PaymentKind,
  ReservationStatus,
  VehicleStatus,
} from '../dealer.types';
import { Badge, type BadgeTone } from '../../shared/ui/AppUI';

/**
 * Status badges.
 *
 * Every badge shows its status as words. Colour reinforces the reading and is
 * never the only carrier of it, which is what keeps the workspace usable for
 * someone who cannot distinguish copper from red.
 */

const VEHICLE_TONES: Record<VehicleStatus, BadgeTone> = {
  'In Stock': 'success',
  Reserved: 'active',
  'Pending Sale': 'info',
  Sold: 'neutral',
  'Service Hold': 'warning',
  Unavailable: 'danger',
};

const LEAD_TONES: Record<LeadStage, BadgeTone> = {
  New: 'info',
  Contacted: 'neutral',
  Appointment: 'active',
  'Vehicle Selected': 'active',
  Reservation: 'active',
  Negotiation: 'warning',
  Won: 'success',
  Lost: 'danger',
};

const RESERVATION_TONES: Record<ReservationStatus, BadgeTone> = {
  Pending: 'warning',
  Confirmed: 'active',
  Expired: 'danger',
  Cancelled: 'neutral',
  'Converted to Deal': 'success',
};

const DEAL_TONES: Record<DealStatus, BadgeTone> = {
  Draft: 'neutral',
  Negotiation: 'warning',
  'Pending Documents': 'warning',
  'Pending Financing': 'info',
  'Ready to Close': 'active',
  Closed: 'success',
  Cancelled: 'danger',
};

const FINANCING_TONES: Record<FinancingStatus, BadgeTone> = {
  Draft: 'neutral',
  'Documents Needed': 'warning',
  'Ready to Submit': 'info',
  Submitted: 'info',
  'Under Review': 'active',
  Approved: 'success',
  'Conditionally Approved': 'success',
  Declined: 'danger',
  Withdrawn: 'neutral',
  Completed: 'success',
};

const DOCUMENT_TONES: Record<DocumentStatus, BadgeTone> = {
  Missing: 'danger',
  Requested: 'warning',
  Received: 'info',
  Reviewed: 'active',
  Signed: 'success',
  'Not Applicable': 'neutral',
};

const PAYMENT_TONES: Record<PaymentKind, BadgeTone> = {
  'Reservation Deposit': 'info',
  'Down Payment': 'active',
  'Balance Payment': 'success',
  Refund: 'warning',
};

export const VehicleStatusBadge = ({ status }: { status: VehicleStatus }) => (
  <Badge tone={VEHICLE_TONES[status]}>{status}</Badge>
);

export const LeadStageBadge = ({ stage }: { stage: LeadStage }) => (
  <Badge tone={LEAD_TONES[stage]}>{stage}</Badge>
);

export const ReservationStatusBadge = ({ status }: { status: ReservationStatus }) => (
  <Badge tone={RESERVATION_TONES[status]}>{status}</Badge>
);

export const DealStatusBadge = ({ status }: { status: DealStatus }) => (
  <Badge tone={DEAL_TONES[status]}>{status}</Badge>
);

export const FinancingStatusBadge = ({ status }: { status: FinancingStatus }) => (
  <Badge tone={FINANCING_TONES[status]}>{status}</Badge>
);

export const DocumentStatusBadge = ({ status }: { status: DocumentStatus }) => (
  <Badge tone={DOCUMENT_TONES[status]}>{status}</Badge>
);

export const PaymentKindBadge = ({ kind }: { kind: PaymentKind }) => (
  <Badge tone={PAYMENT_TONES[kind]}>{kind}</Badge>
);

/** Left border accent used on list rows, matching the vehicle status. */
export const vehicleAccent: Record<VehicleStatus, string> = {
  'In Stock': 'border-l-app-success',
  Reserved: 'border-l-copper',
  'Pending Sale': 'border-l-app-info',
  Sold: 'border-l-app-border',
  'Service Hold': 'border-l-app-warning',
  Unavailable: 'border-l-app-danger',
};
