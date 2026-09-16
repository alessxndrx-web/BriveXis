import { useMemo, useState } from 'react';
import { Plus, Printer } from 'lucide-react';
import { useDealer, useWorkspace } from '../DealerProvider';
import { useRouter } from '../../../lib/router';
import { paths } from '../dealer.routes';
import type { Reservation } from '../dealer.types';
import { RESERVATION_STATUSES } from '../dealer.types';
import {
  activityFor,
  depositPaid,
  documentsForReservation,
  getCustomer,
  getDeal,
  getVehicle,
  salespersonName,
} from '../dealer.selectors';
import { formatDate, formatMoney, formatRelativeDay, matches, vehicleTitle } from '../dealer.utils';
import { track } from '../../../lib/analytics';
import {
  Button,
  Detail,
  EmptyState,
  InlineField,
  LinkButton,
  PageHeader,
  Panel,
  PanelHeader,
  Select,
  TextInput,
  Toolbar,
} from '../../shared/ui/AppUI';
import { CellMeta, CodeCell, DataTable, type Column } from '../../shared/ui/DataTable';
import { DocumentStatusBadge, ReservationStatusBadge } from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import {
  CancelReservationDialog,
  ReservationDepositForm,
  ReservationForm,
  isExpired,
} from '../forms/ReservationForms';
import { DealForm } from '../forms/DealForms';
import { DocumentForm } from '../forms/WorkspaceForms';

/**
 * Reservations.
 *
 * A hold is the promise that takes a vehicle off the market, so this screen is
 * mostly about the two things that end one: a deposit that confirms it, and an
 * expiry that releases it.
 */

const ALL = 'all';

export function ReservationsPage() {
  const state = useWorkspace();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>(ALL);
  const [formOpen, setFormOpen] = useState(false);

  const rows = useMemo(
    () =>
      state.reservations.filter((reservation) => {
        if (status !== ALL && reservation.status !== status) return false;
        const customer = getCustomer(state, reservation.customerId);
        const vehicle = getVehicle(state, reservation.vehicleId);
        return matches(
          query,
          reservation.code,
          customer?.name,
          vehicle?.code,
          vehicle ? vehicleTitle(vehicle) : undefined,
        );
      }),
    [state, query, status],
  );

  const columns: Column<Reservation>[] = [
    {
      key: 'reservation',
      header: 'Reservation',
      sortValue: (reservation) => reservation.code,
      cell: (reservation) => {
        const customer = getCustomer(state, reservation.customerId);
        return (
          <>
            <span className="font-medium text-charcoal">{customer?.name ?? 'Unknown'}</span>
            <CellMeta>
              <CodeCell>{reservation.code}</CodeCell>
            </CellMeta>
          </>
        );
      },
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      hideBelow: 'md',
      sortValue: (reservation) => getVehicle(state, reservation.vehicleId)?.code ?? '',
      cell: (reservation) => {
        const vehicle = getVehicle(state, reservation.vehicleId);
        return vehicle ? (
          <>
            <span className="text-charcoal">{vehicleTitle(vehicle)}</span>
            <CellMeta>{vehicle.code}</CellMeta>
          </>
        ) : (
          <span className="text-muted">—</span>
        );
      },
    },
    {
      key: 'deposit',
      header: 'Deposit',
      width: 'w-32',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (reservation) => depositPaid(state, reservation.id),
      cell: (reservation) => {
        const paid = depositPaid(state, reservation.id);
        return (
          <>
            <span className="tabular-nums text-charcoal">{formatMoney(paid)}</span>
            <CellMeta>of {formatMoney(reservation.requestedDeposit)}</CellMeta>
          </>
        );
      },
    },
    {
      key: 'expires',
      header: 'Expires',
      width: 'w-32',
      sortValue: (reservation) => reservation.expiresAt,
      cell: (reservation) => (
        <span className={isExpired(reservation) ? 'text-app-danger' : 'text-muted'}>
          {formatRelativeDay(reservation.expiresAt)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 'w-40',
      sortValue: (reservation) => reservation.status,
      cell: (reservation) => <ReservationStatusBadge status={reservation.status} />,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reservations"
        description="A confirmed hold takes a vehicle out of available inventory."
        actions={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <Plus size={14} aria-hidden="true" />
            New reservation
          </Button>
        }
      />

      <Panel>
        <Toolbar>
          <div className="w-full sm:w-64">
            <label htmlFor="reservation-search" className="sr-only">
              Search reservations
            </label>
            <TextInput
              id="reservation-search"
              type="search"
              placeholder="Reservation, customer, vehicle…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <InlineField label="Status" htmlFor="reservation-status">
            <Select
              id="reservation-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All</option>
              {RESERVATION_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </InlineField>

          {(query || status !== ALL) && (
            <Button
              size="sm"
              onClick={() => {
                setQuery('');
                setStatus(ALL);
              }}
            >
              Clear filters
            </Button>
          )}

          <span className="ml-auto text-[0.75rem] text-muted tabular-nums">
            {rows.length} of {state.reservations.length}
          </span>
        </Toolbar>

        <DataTable
          caption="Reservations"
          columns={columns}
          rows={rows}
          rowKey={(reservation) => reservation.id}
          rowHref={(reservation) => paths.reservation(reservation.id)}
          defaultSort={{ key: 'expires', direction: 'asc' }}
          empty={
            <EmptyState
              title="No reservations match these filters."
              action={
                <Button
                  onClick={() => {
                    setQuery('');
                    setStatus(ALL);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          }
        />
      </Panel>

      <ReservationForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

// ---------------------------------------------------- reservation detail

export function ReservationDetail({ reservationId }: { reservationId: string }) {
  const state = useWorkspace();
  const { dispatch, notify } = useDealer();
  const { navigate } = useRouter();
  const [depositOpen, setDepositOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);

  const reservation = state.reservations.find((entry) => entry.id === reservationId);

  if (!reservation) {
    return (
      <EmptyState
        title="That reservation is not in this workspace"
        action={<LinkButton href={paths.module('reservations')}>Back to reservations</LinkButton>}
      />
    );
  }

  const customer = getCustomer(state, reservation.customerId);
  const vehicle = getVehicle(state, reservation.vehicleId);
  const deal = getDeal(state, reservation.dealId);
  const paid = depositPaid(state, reservation.id);
  const outstanding = Math.max(0, reservation.requestedDeposit - paid);
  const documents = documentsForReservation(state, reservation.id);
  const events = activityFor(state, { kind: 'reservation', id: reservation.id });
  const active = reservation.status === 'Pending' || reservation.status === 'Confirmed';

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <a href={paths.module('reservations')} className="hover:text-copper transition-colors">
            Reservations
          </a>
        }
        title={`${reservation.code} — ${customer?.name ?? 'Unknown customer'}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ReservationStatusBadge status={reservation.status} />
            <span className="text-muted">
              {vehicle ? `${vehicle.code} · ${vehicleTitle(vehicle)}` : 'No vehicle'} ·{' '}
              {salespersonName(state, reservation.salespersonId)}
            </span>
          </span>
        }
        actions={
          <>
            <LinkButton href={paths.reservationPrint(reservation.id)}>
              <Printer size={14} aria-hidden="true" />
              Receipt
            </LinkButton>
            <Button onClick={() => setDocumentOpen(true)}>Add document</Button>
            {active && outstanding > 0 && (
              <Button onClick={() => setDepositOpen(true)}>Record deposit</Button>
            )}
            {reservation.status === 'Pending' && (
              <Button
                variant="primary"
                onClick={() => {
                  dispatch({ type: 'reservation/confirm', id: reservation.id });
                  track('reservation_confirmed');
                  notify(`${reservation.code} confirmed. The vehicle is held.`, 'success');
                }}
              >
                Confirm reservation
              </Button>
            )}
            {reservation.status === 'Confirmed' && !deal && (
              <Button variant="primary" onClick={() => setDealOpen(true)}>
                Create deal
              </Button>
            )}
            {deal && (
              <LinkButton variant="primary" href={paths.deal(deal.id)}>
                View {deal.code}
              </LinkButton>
            )}
            {active && (
              <Button variant="danger" onClick={() => setCancelOpen(true)}>
                Cancel
              </Button>
            )}
          </>
        }
      />

      {isExpired(reservation) && (
        <p className="border border-app-danger/40 bg-app-danger/[0.06] rounded-[3px] px-3.5 py-2.5 text-[0.8125rem] text-charcoal">
          This hold ran out on {formatDate(reservation.expiresAt)}. Confirm with the customer or
          release the vehicle.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          <Panel>
            <PanelHeader title="Reservation" as="h2" />
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Detail label="Customer">
                {customer ? (
                  <a href={paths.customer(customer.id)} className="hover:text-copper transition-colors">
                    {customer.name}
                  </a>
                ) : (
                  '—'
                )}
              </Detail>
              <Detail label="Vehicle">
                {vehicle ? (
                  <a href={paths.vehicle(vehicle.id)} className="hover:text-copper transition-colors">
                    {vehicleTitle(vehicle)}
                  </a>
                ) : (
                  '—'
                )}
              </Detail>
              <Detail label="List price">
                <span className="tabular-nums">{vehicle ? formatMoney(vehicle.listPrice) : '—'}</span>
              </Detail>
              <Detail label="Reserved on">{formatDate(reservation.reservedAt)}</Detail>
              <Detail label="Expires">{formatDate(reservation.expiresAt)}</Detail>
              <Detail label="Salesperson">{salespersonName(state, reservation.salespersonId)}</Detail>
              <Detail label="Deposit requested">
                <span className="tabular-nums">{formatMoney(reservation.requestedDeposit)}</span>
              </Detail>
              <Detail label="Deposit recorded">
                <span className="tabular-nums">{formatMoney(paid)}</span>
              </Detail>
              <Detail label="Outstanding">
                <span className="tabular-nums">{formatMoney(outstanding)}</span>
              </Detail>
              {reservation.notes && (
                <div className="col-span-2 sm:col-span-3">
                  <Detail label="Notes">{reservation.notes}</Detail>
                </div>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Documents"
              as="h2"
              meta={documents.length > 0 ? `${documents.length}` : undefined}
            />
            {documents.length === 0 ? (
              <EmptyState
                title="No documents on this reservation"
                description="A deposit receipt is usually the first one."
                action={<Button onClick={() => setDocumentOpen(true)}>Add document</Button>}
              />
            ) : (
              <ul>
                {documents.map((document) => (
                  <li
                    key={document.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-app-border last:border-b-0 px-4 py-2.5"
                  >
                    <span className="text-[0.875rem] text-charcoal">
                      {document.type}
                      {document.fileLabel && (
                        <span className="ml-2 text-[0.75rem] text-muted">{document.fileLabel}</span>
                      )}
                    </span>
                    <DocumentStatusBadge status={document.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Activity" as="h2" />
            <div className="p-4">
              <Timeline events={events} />
            </div>
          </Panel>
        </div>

        <Panel>
          <PanelHeader title="Deposit" as="h3" />
          <div className="p-4 space-y-2">
            <p className="font-heading font-semibold text-[1.375rem] tabular-nums text-charcoal">
              {formatMoney(paid)}
            </p>
            <p className="text-[0.8125rem] text-muted">
              of {formatMoney(reservation.requestedDeposit)} requested
            </p>
            {outstanding > 0 && active && (
              <Button variant="primary" size="sm" onClick={() => setDepositOpen(true)}>
                Record deposit
              </Button>
            )}
            <p className="pt-2 text-[0.75rem] text-muted">
              Demo only — no real transaction is processed.
            </p>
          </div>
        </Panel>
      </div>

      <ReservationDepositForm
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        reservation={reservation}
      />
      <CancelReservationDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        reservationId={reservation.id}
      />
      <DealForm
        open={dealOpen}
        onClose={() => setDealOpen(false)}
        reservationId={reservation.id}
        onCreated={(id) => navigate(paths.deal(id))}
      />
      <DocumentForm
        open={documentOpen}
        onClose={() => setDocumentOpen(false)}
        customerId={reservation.customerId}
        reservationId={reservation.id}
        type="Reservation Receipt"
      />
    </div>
  );
}
