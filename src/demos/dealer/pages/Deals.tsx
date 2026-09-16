import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Plus, Printer, Trash2 } from 'lucide-react';
import { useDealer, useWorkspace } from '../DealerProvider';
import { useRouter } from '../../../lib/router';
import { paths } from '../dealer.routes';
import type { Deal } from '../dealer.types';
import { DEAL_STATUSES, DELIVERY_CHECKS } from '../dealer.types';
import {
  activityFor,
  canCloseDeals,
  closeReadiness,
  dealPayments,
  dealTotals,
  deliveryReadiness,
  documentReadiness,
  documentsForDeal,
  financingForDeal,
  getCustomer,
  getReservation,
  getVehicle,
  isDelivered,
  salespersonName,
  tasksFor,
} from '../dealer.selectors';
import { formatDate, formatMoney, matches, vehicleTitle } from '../dealer.utils';
import {
  Button,
  Detail,
  EmptyState,
  IconButton,
  InlineField,
  LinkButton,
  PageHeader,
  Panel,
  PanelHeader,
  Select,
  Tabs,
  TextInput,
  Toolbar,
} from '../../shared/ui/AppUI';
import { CellMeta, CodeCell, DataTable, type Column } from '../../shared/ui/DataTable';
import {
  DealStatusBadge,
  DocumentStatusBadge,
  FinancingStatusBadge,
  PaymentKindBadge,
} from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import {
  CancelDealDialog,
  CloseDealDialog,
  DealFeeForm,
  DealForm,
  DealPricingForm,
  DeliveryForm,
  TradeInForm,
} from '../forms/DealForms';
import { FinancingForm, PaymentForm } from '../forms/FinanceForms';
import { DocumentForm } from '../forms/WorkspaceForms';

/**
 * Deals.
 *
 * This is where the money, the paperwork and the vehicle meet. Everything a
 * deal is blocked by is stated explicitly rather than left for the visitor to
 * work out from a disabled button.
 */

const ALL = 'all';

/** Statuses a deal can be moved between by hand while it is still open. */
const WORKING_STATUSES = DEAL_STATUSES.filter(
  (status) => status !== 'Closed' && status !== 'Cancelled',
);

export function DealsPage() {
  const state = useWorkspace();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>(ALL);
  const [formOpen, setFormOpen] = useState(false);

  const rows = useMemo(
    () =>
      state.deals.filter((deal) => {
        if (status !== ALL && deal.status !== status) return false;
        const customer = getCustomer(state, deal.customerId);
        const vehicle = getVehicle(state, deal.vehicleId);
        return matches(query, deal.code, customer?.name, vehicle?.code, vehicle ? vehicleTitle(vehicle) : undefined);
      }),
    [state, query, status],
  );

  const columns: Column<Deal>[] = [
    {
      key: 'deal',
      header: 'Deal',
      sortValue: (deal) => deal.code,
      cell: (deal) => {
        const customer = getCustomer(state, deal.customerId);
        return (
          <>
            <span className="font-medium text-charcoal">{customer?.name ?? 'Unknown'}</span>
            <CellMeta>
              <CodeCell>{deal.code}</CodeCell> · {deal.plan}
            </CellMeta>
          </>
        );
      },
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      hideBelow: 'md',
      sortValue: (deal) => getVehicle(state, deal.vehicleId)?.code ?? '',
      cell: (deal) => {
        const vehicle = getVehicle(state, deal.vehicleId);
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
      key: 'total',
      header: 'Total',
      width: 'w-32',
      align: 'right',
      sortValue: (deal) => dealTotals(state, deal).total,
      cell: (deal) => (
        <span className="tabular-nums text-charcoal">{formatMoney(dealTotals(state, deal).total)}</span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      width: 'w-32',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (deal) => dealTotals(state, deal).balance,
      cell: (deal) => {
        const balance = dealTotals(state, deal).balance;
        return (
          <span className={`tabular-nums ${balance > 0 ? 'text-charcoal' : 'text-muted'}`}>
            {formatMoney(balance)}
          </span>
        );
      },
    },
    {
      key: 'opened',
      header: 'Opened',
      width: 'w-28',
      hideBelow: 'lg',
      sortValue: (deal) => deal.openedAt,
      cell: (deal) => <span className="text-muted">{formatDate(deal.openedAt)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: 'w-40',
      sortValue: (deal) => deal.status,
      cell: (deal) => <DealStatusBadge status={deal.status} />,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Deals"
        description={`${state.deals.length} deals, open and closed.`}
        actions={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <Plus size={14} aria-hidden="true" />
            New deal
          </Button>
        }
      />

      <Panel>
        <Toolbar>
          <div className="w-full sm:w-64">
            <label htmlFor="deal-search" className="sr-only">
              Search deals
            </label>
            <TextInput
              id="deal-search"
              type="search"
              placeholder="Deal number, customer, vehicle…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <InlineField label="Status" htmlFor="deal-status">
            <Select
              id="deal-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All</option>
              {DEAL_STATUSES.map((option) => (
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
            {rows.length} of {state.deals.length}
          </span>
        </Toolbar>

        <DataTable
          caption="Deals"
          columns={columns}
          rows={rows}
          rowKey={(deal) => deal.id}
          rowHref={(deal) => paths.deal(deal.id)}
          defaultSort={{ key: 'opened', direction: 'desc' }}
          empty={
            <EmptyState
              title="No deals match these filters."
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

      <DealForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

// --------------------------------------------------------------- deal detail

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'documents', label: 'Documents' },
  { id: 'financial', label: 'Financial' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'activity', label: 'Activity' },
];

export function DealDetail({ dealId }: { dealId: string }) {
  const state = useWorkspace();
  const { role, dispatch } = useDealer();
  const { navigate } = useRouter();
  const [tab, setTab] = useState('overview');
  const [pricingOpen, setPricingOpen] = useState(false);
  const [feeOpen, setFeeOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [financingOpen, setFinancingOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);

  const deal = state.deals.find((entry) => entry.id === dealId);

  if (!deal) {
    return (
      <EmptyState
        title="That deal is not in this workspace"
        action={<LinkButton href={paths.module('deals')}>Back to deals</LinkButton>}
      />
    );
  }

  const customer = getCustomer(state, deal.customerId);
  const vehicle = getVehicle(state, deal.vehicleId);
  const reservation = getReservation(state, deal.reservationId);
  const totals = dealTotals(state, deal);
  const readiness = closeReadiness(state, deal);
  const documents = documentsForDeal(state, deal.id);
  const docReadiness = documentReadiness(state, deal);
  const financing = financingForDeal(state, deal.id);
  const payments = dealPayments(state, deal.id);
  const events = activityFor(state, { kind: 'deal', id: deal.id });
  const tasks = tasksFor(state, { dealId: deal.id });
  const delivery = deliveryReadiness(deal);
  const editable = deal.status !== 'Closed' && deal.status !== 'Cancelled';
  const mayClose = canCloseDeals(role);

  const tabs = TABS.map((entry) => {
    if (entry.id === 'documents') return { ...entry, count: documents.length };
    if (entry.id === 'financial') return { ...entry, count: payments.length };
    return entry;
  });

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <a href={paths.module('deals')} className="hover:text-copper transition-colors">
            Deals
          </a>
        }
        title={`${deal.code} — ${customer?.name ?? 'Unknown customer'}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <DealStatusBadge status={deal.status} />
            <span className="text-muted">
              {vehicle ? `${vehicle.code} · ${vehicleTitle(vehicle)}` : 'No vehicle'} · {deal.plan} ·{' '}
              {salespersonName(state, deal.salespersonId)}
            </span>
          </span>
        }
        actions={
          <>
            <LinkButton href={paths.dealPrint(deal.id)}>
              <Printer size={14} aria-hidden="true" />
              Summary
            </LinkButton>
            {editable && <Button onClick={() => setPricingOpen(true)}>Pricing</Button>}
            {editable && totals.balance > 0 && (
              <Button onClick={() => setPaymentOpen(true)}>Record payment</Button>
            )}
            {editable && deal.plan === 'Financing' && !financing && (
              <Button onClick={() => setFinancingOpen(true)}>Open financing</Button>
            )}
            {financing && (
              <LinkButton href={paths.financingApplication(financing.id)}>
                {financing.code}
              </LinkButton>
            )}
            {editable && mayClose && (
              <Button variant="primary" onClick={() => setCloseOpen(true)}>
                Close deal
              </Button>
            )}
            {deal.status === 'Closed' && !isDelivered(deal) && (
              <Button variant="primary" onClick={() => setDeliveryOpen(true)}>
                Delivery
              </Button>
            )}
            {editable && (
              <Button variant="danger" onClick={() => setCancelOpen(true)}>
                Cancel
              </Button>
            )}
          </>
        }
      />

      {editable && !mayClose && (
        <p className="border border-app-border bg-app-panel rounded-[3px] px-3.5 py-2.5 text-[0.8125rem] text-muted">
          Closing a sale sits with the owner, sales manager and finance roles. Switch the demo role
          in the sidebar to see that view.
        </p>
      )}

      {editable && readiness.blockers.length > 0 && (
        <div className="border border-app-warning/40 bg-app-warning/[0.06] rounded-[3px] px-3.5 py-2.5">
          <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-charcoal">
            <AlertTriangle size={14} aria-hidden="true" className="shrink-0 text-app-warning" />
            Before this deal can close
          </p>
          <ul className="mt-1.5 space-y-1">
            {readiness.blockers.map((blocker) => (
              <li key={blocker} className="text-[0.8125rem] text-muted">
                {blocker}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2">
          <Panel>
            <Tabs tabs={tabs} active={tab} onChange={setTab} label="Deal sections" />

            {tab === 'overview' && (
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
                <Detail label="Plan">{deal.plan}</Detail>
                <Detail label="Opened">{formatDate(deal.openedAt)}</Detail>
                <Detail label="Closed">{deal.closedAt ? formatDate(deal.closedAt) : '—'}</Detail>
                <Detail label="Reservation">
                  {reservation ? (
                    <a
                      href={paths.reservation(reservation.id)}
                      className="hover:text-copper transition-colors"
                    >
                      {reservation.code}
                    </a>
                  ) : (
                    '—'
                  )}
                </Detail>
                <Detail label="Documents">
                  {docReadiness.satisfied.length} of {docReadiness.required.length} required
                </Detail>
                <Detail label="Open tasks">{tasks.filter((task) => !task.done).length}</Detail>
                <Detail label="Delivered">
                  {isDelivered(deal) ? formatDate(deal.delivery!.completedAt!) : 'Not yet'}
                </Detail>
                {deal.notes && (
                  <div className="col-span-2 sm:col-span-3">
                    <Detail label="Notes">{deal.notes}</Detail>
                  </div>
                )}
              </div>
            )}

            {tab === 'documents' && (
              <div className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[0.8125rem] text-muted">
                    {docReadiness.complete
                      ? 'Everything required is on file.'
                      : `Outstanding: ${docReadiness.outstanding.join(', ')}.`}
                  </p>
                  <Button size="sm" onClick={() => setDocumentOpen(true)}>
                    Add document
                  </Button>
                </div>

                {documents.length === 0 ? (
                  <EmptyState
                    title="No documents yet"
                    description="Track what has been requested and what has come back."
                  />
                ) : (
                  <ul className="divide-y divide-app-border">
                    {documents.map((document) => (
                      <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <span className="min-w-0">
                          <span className="block text-[0.875rem] text-charcoal">{document.type}</span>
                          <span className="block text-[0.75rem] text-muted">
                            {document.fileLabel ?? document.code}
                            {document.receivedAt && ` · received ${formatDate(document.receivedAt)}`}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <DocumentStatusBadge status={document.status} />
                          <Select
                            id={`deal-doc-${document.id}`}
                            aria-label={`Status for ${document.type}`}
                            value={document.status}
                            className="w-auto"
                            onChange={(event) =>
                              dispatch({
                                type: 'document/status',
                                id: document.id,
                                status: event.target.value as typeof document.status,
                              })
                            }
                          >
                            {['Missing', 'Requested', 'Received', 'Reviewed', 'Signed', 'Not Applicable'].map(
                              (option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ),
                            )}
                          </Select>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === 'financial' && (
              <div className="p-4 space-y-4">
                <dl className="space-y-1.5 text-[0.875rem]">
                  <Row label="Sale price" value={formatMoney(deal.salePrice)} />
                  {deal.discount > 0 && <Row label="Discount" value={`− ${formatMoney(deal.discount)}`} />}
                  {deal.tradeIn && (
                    <Row
                      label={`Trade-in credit (${deal.tradeIn.year} ${deal.tradeIn.make} ${deal.tradeIn.model})`}
                      value={`− ${formatMoney(totals.tradeCredit)}`}
                    />
                  )}
                  <Row label={`Tax (${deal.taxRate}%)`} value={formatMoney(totals.tax)} />
                  {deal.fees.map((fee) => (
                    <div key={fee.id} className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted">
                        {fee.label}
                        {editable && (
                          <IconButton
                            label={`Remove ${fee.label}`}
                            className="ml-1.5 align-middle"
                            onClick={() =>
                              dispatch({ type: 'deal/removeFee', id: deal.id, feeId: fee.id })
                            }
                          >
                            <Trash2 size={12} aria-hidden="true" />
                          </IconButton>
                        )}
                      </dt>
                      <dd className="tabular-nums text-charcoal">{formatMoney(fee.amount)}</dd>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between gap-3 border-t border-app-border pt-2 font-medium">
                    <dt className="text-charcoal">Total</dt>
                    <dd className="tabular-nums text-charcoal">{formatMoney(totals.total)}</dd>
                  </div>
                  <Row label="Recorded" value={formatMoney(totals.paid)} />
                  <div className="flex items-baseline justify-between gap-3 border-t border-app-border pt-2 font-medium">
                    <dt className="text-charcoal">Balance</dt>
                    <dd className="tabular-nums text-charcoal">{formatMoney(totals.balance)}</dd>
                  </div>
                  {deal.plan === 'Financing' && (
                    <Row label="To be financed" value={formatMoney(totals.financedAmount)} />
                  )}
                </dl>

                {editable && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setFeeOpen(true)}>
                      Add fee
                    </Button>
                    <Button size="sm" onClick={() => setTradeOpen(true)}>
                      {deal.tradeIn ? 'Edit trade-in' : 'Add trade-in'}
                    </Button>
                    {totals.balance > 0 && (
                      <Button size="sm" onClick={() => setPaymentOpen(true)}>
                        Record payment
                      </Button>
                    )}
                  </div>
                )}

                <div>
                  <h3 className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-muted mb-2">
                    Payments
                  </h3>
                  {payments.length === 0 ? (
                    <p className="text-[0.8125rem] text-muted">Nothing recorded yet.</p>
                  ) : (
                    <ul className="divide-y divide-app-border">
                      {payments.map((payment) => (
                        <li
                          key={payment.id}
                          className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                        >
                          <span className="text-[0.875rem] text-charcoal">
                            {payment.code}
                            <span className="ml-2 text-[0.75rem] text-muted">
                              {formatDate(payment.receivedAt)} · {payment.method}
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            <PaymentKindBadge kind={payment.kind} />
                            <span className="tabular-nums text-[0.875rem] text-charcoal">
                              {formatMoney(payment.amount)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-[0.75rem] text-muted">
                    Demo only — no real transaction is processed.
                  </p>
                </div>
              </div>
            )}

            {tab === 'delivery' && (
              <div className="p-4 space-y-3">
                {deal.status !== 'Closed' ? (
                  <EmptyState
                    title="Delivery opens once the deal closes"
                    description="The handover is recorded after the sale is agreed and the paperwork is done."
                  />
                ) : (
                  <>
                    <ul className="space-y-1.5">
                      {DELIVERY_CHECKS.map((check) => (
                        <li key={check.key} className="flex items-center gap-2 text-[0.875rem]">
                          <span
                            aria-hidden="true"
                            className={`flex items-center justify-center w-4 h-4 rounded-full border ${
                              deal.delivery?.[check.key]
                                ? 'border-app-success bg-app-success/10 text-app-success'
                                : 'border-app-border text-transparent'
                            }`}
                          >
                            <Check size={10} strokeWidth={3} />
                          </span>
                          <span className={deal.delivery?.[check.key] ? 'text-charcoal' : 'text-muted'}>
                            {check.label}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {isDelivered(deal) ? (
                      <p className="text-[0.8125rem] text-charcoal">
                        Delivered {formatDate(deal.delivery!.completedAt!)}.
                        {deal.delivery?.notes && (
                          <span className="block text-muted">{deal.delivery.notes}</span>
                        )}
                      </p>
                    ) : (
                      <Button variant="primary" size="sm" onClick={() => setDeliveryOpen(true)}>
                        {delivery.ready ? 'Complete delivery' : 'Work through delivery'}
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === 'activity' && (
              <div className="p-4">
                <Timeline events={events} />
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Totals" as="h3" />
            <div className="p-4 space-y-1">
              <p className="font-heading font-semibold text-[1.5rem] tabular-nums text-charcoal">
                {formatMoney(totals.total)}
              </p>
              <p className="text-[0.8125rem] text-muted">
                {formatMoney(totals.paid)} recorded · {formatMoney(totals.balance)} balance
              </p>
            </div>
          </Panel>

          {editable && (
            <Panel>
              <PanelHeader title="Stage" as="h3" />
              <div className="p-3 flex flex-wrap gap-1.5">
                {/* Closed and Cancelled are deliberately absent: those are
                    decisions with consequences, taken through their own
                    confirmed actions rather than a status button. */}
                {WORKING_STATUSES.map((option) => (
                  <Button
                    key={option}
                    size="sm"
                    variant={option === deal.status ? 'primary' : 'secondary'}
                    onClick={() => dispatch({ type: 'deal/status', id: deal.id, status: option })}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </Panel>
          )}

          {financing && (
            <Panel>
              <PanelHeader title="Financing" as="h3" />
              <a
                href={paths.financingApplication(financing.id)}
                className="block px-4 py-3 transition-colors hover:bg-app-bg"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[0.875rem] text-charcoal">{financing.code}</span>
                  <FinancingStatusBadge status={financing.status} />
                </div>
                <p className="mt-1 text-[0.75rem] text-muted">
                  {formatMoney(financing.amountRequested)} over {financing.termMonths} months ·{' '}
                  {financing.lenderCategory}
                </p>
              </a>
              <p className="px-4 pb-3 text-[0.75rem] text-muted">
                Demo workflow only — no real credit decision or financing submission is performed.
              </p>
            </Panel>
          )}
        </div>
      </div>

      <DealPricingForm open={pricingOpen} onClose={() => setPricingOpen(false)} deal={deal} />
      <DealFeeForm open={feeOpen} onClose={() => setFeeOpen(false)} dealId={deal.id} />
      <TradeInForm open={tradeOpen} onClose={() => setTradeOpen(false)} deal={deal} />
      <CloseDealDialog open={closeOpen} onClose={() => setCloseOpen(false)} dealId={deal.id} />
      <CancelDealDialog
        open={cancelOpen}
        onClose={() => {
          setCancelOpen(false);
          navigate(paths.module('deals'));
        }}
        dealId={deal.id}
      />
      <DeliveryForm open={deliveryOpen} onClose={() => setDeliveryOpen(false)} deal={deal} />
      <FinancingForm open={financingOpen} onClose={() => setFinancingOpen(false)} dealId={deal.id} />
      <PaymentForm
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        customerId={deal.customerId}
        dealId={deal.id}
        kind={totals.paid === 0 ? 'Down Payment' : 'Balance Payment'}
        suggestedAmount={Math.max(0, totals.balance)}
        maximum={Math.max(0, totals.balance)}
      />
      <DocumentForm
        open={documentOpen}
        onClose={() => setDocumentOpen(false)}
        customerId={deal.customerId}
        dealId={deal.id}
        type={docReadiness.outstanding[0]}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums text-charcoal">{value}</dd>
    </div>
  );
}
