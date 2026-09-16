import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useWorkspace } from '../DealerProvider';
import { useRouter } from '../../../lib/router';
import { paths } from '../dealer.routes';
import type { Customer } from '../dealer.types';
import {
  activityFor,
  customerSummary,
  dealTotals,
  getVehicle,
  leadsForCustomer,
  tasksFor,
} from '../dealer.selectors';
import {
  formatAddress,
  formatDate,
  formatMoney,
  formatPhone,
  matches,
  vehicleTitle,
} from '../dealer.utils';
import {
  Button,
  Detail,
  EmptyState,
  LinkButton,
  PageHeader,
  Panel,
  PanelHeader,
  Tabs,
  TextInput,
  Toolbar,
} from '../../shared/ui/AppUI';
import { CellMeta, CodeCell, DataTable, type Column } from '../../shared/ui/DataTable';
import {
  DealStatusBadge,
  DocumentStatusBadge,
  FinancingStatusBadge,
  LeadStageBadge,
  PaymentKindBadge,
  ReservationStatusBadge,
} from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import { CustomerForm } from '../forms/CustomerForm';
import { ReservationForm } from '../forms/ReservationForms';
import { DealForm } from '../forms/DealForms';

/** Customers and their whole history with the dealership. */

export function CustomersPage() {
  const state = useWorkspace();
  const [query, setQuery] = useState('');
  const [openOnly, setOpenOnly] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const rows = useMemo(
    () =>
      state.customers.filter((customer) => {
        if (openOnly) {
          const summary = customerSummary(state, customer.id);
          if (!summary || summary.openBalance <= 0) return false;
        }
        return matches(query, customer.name, customer.code, customer.email, customer.phone);
      }),
    [state, query, openOnly],
  );

  const columns: Column<Customer>[] = [
    {
      key: 'customer',
      header: 'Customer',
      sortValue: (customer) => customer.name,
      cell: (customer) => (
        <>
          <span className="font-medium text-charcoal">{customer.name}</span>
          <CellMeta>
            <CodeCell>{customer.code}</CodeCell> · {formatPhone(customer.phone)}
          </CellMeta>
        </>
      ),
    },
    {
      key: 'city',
      header: 'City',
      width: 'w-40',
      hideBelow: 'md',
      sortValue: (customer) => customer.address.city,
      cell: (customer) => (
        <span className="text-muted">
          {customer.address.city}, {customer.address.state}
        </span>
      ),
    },
    {
      key: 'deals',
      header: 'Deals',
      width: 'w-20',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (customer) => state.deals.filter((deal) => deal.customerId === customer.id).length,
      cell: (customer) => (
        <span className="tabular-nums text-muted">
          {state.deals.filter((deal) => deal.customerId === customer.id).length}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Open balance',
      width: 'w-32',
      align: 'right',
      sortValue: (customer) => customerSummary(state, customer.id)?.openBalance ?? 0,
      cell: (customer) => {
        const balance = customerSummary(state, customer.id)?.openBalance ?? 0;
        return (
          <span className={`tabular-nums ${balance > 0 ? 'text-charcoal' : 'text-muted'}`}>
            {formatMoney(balance)}
          </span>
        );
      },
    },
    {
      key: 'since',
      header: 'Customer since',
      width: 'w-36',
      hideBelow: 'lg',
      sortValue: (customer) => customer.customerSince,
      cell: (customer) => <span className="text-muted">{formatDate(customer.customerSince)}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        description={`${state.customers.length} customer records.`}
        actions={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <Plus size={14} aria-hidden="true" />
            New customer
          </Button>
        }
      />

      <Panel>
        <Toolbar>
          <div className="w-full sm:w-64">
            <label htmlFor="customer-search" className="sr-only">
              Search customers
            </label>
            <TextInput
              id="customer-search"
              type="search"
              placeholder="Name, phone, email…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <Button size="sm" variant={openOnly ? 'primary' : 'secondary'} onClick={() => setOpenOnly((v) => !v)}>
            Open balance only
          </Button>

          {(query || openOnly) && (
            <Button
              size="sm"
              onClick={() => {
                setQuery('');
                setOpenOnly(false);
              }}
            >
              Clear filters
            </Button>
          )}

          <span className="ml-auto text-[0.75rem] text-muted tabular-nums">
            {rows.length} of {state.customers.length}
          </span>
        </Toolbar>

        <DataTable
          caption="Customers"
          columns={columns}
          rows={rows}
          rowKey={(customer) => customer.id}
          rowHref={(customer) => paths.customer(customer.id)}
          defaultSort={{ key: 'customer', direction: 'asc' }}
          empty={
            <EmptyState
              title="No customers match these filters."
              action={
                <Button
                  onClick={() => {
                    setQuery('');
                    setOpenOnly(false);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          }
        />
      </Panel>

      <CustomerForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

// ----------------------------------------------------------- customer detail

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'deals', label: 'Deals' },
  { id: 'payments', label: 'Payments' },
  { id: 'documents', label: 'Documents' },
  { id: 'activity', label: 'Activity' },
];

export function CustomerDetail({ customerId }: { customerId: string }) {
  const state = useWorkspace();
  const { navigate } = useRouter();
  const [tab, setTab] = useState('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);

  const summary = customerSummary(state, customerId);

  if (!summary) {
    return (
      <EmptyState
        title="That customer is not in this workspace"
        action={<LinkButton href={paths.module('customers')}>Back to customers</LinkButton>}
      />
    );
  }

  const { customer, deals, payments, reservations, financing, documents } = summary;
  const leads = leadsForCustomer(state, customer.id);
  const tasks = tasksFor(state, { customerId: customer.id });
  const events = activityFor(state, { kind: 'customer', id: customer.id });

  const tabs = TABS.map((entry) => {
    if (entry.id === 'deals') return { ...entry, count: deals.length };
    if (entry.id === 'payments') return { ...entry, count: payments.length };
    if (entry.id === 'documents') return { ...entry, count: documents.length };
    return entry;
  });

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <a href={paths.module('customers')} className="hover:text-copper transition-colors">
            Customers
          </a>
        }
        title={customer.name}
        description={
          <span className="text-muted">
            {customer.code} · customer since {formatDate(customer.customerSince)}
          </span>
        }
        actions={
          <>
            <Button onClick={() => setEditOpen(true)}>Edit</Button>
            <Button onClick={() => setReserveOpen(true)}>New reservation</Button>
            <Button variant="primary" onClick={() => setDealOpen(true)}>
              New deal
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2">
          <Panel>
            <Tabs tabs={tabs} active={tab} onChange={setTab} label="Customer sections" />

            {tab === 'overview' && (
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Detail label="Phone">
                  <a href={`tel:${customer.phone}`} className="hover:text-copper transition-colors">
                    {formatPhone(customer.phone)}
                  </a>
                </Detail>
                <Detail label="Email">
                  {customer.email ? (
                    <a
                      href={`mailto:${customer.email}`}
                      className="hover:text-copper transition-colors break-all"
                    >
                      {customer.email}
                    </a>
                  ) : (
                    '—'
                  )}
                </Detail>
                <Detail label="Total paid">
                  <span className="tabular-nums">{formatMoney(summary.totalPaid)}</span>
                </Detail>
                <Detail label="Open balance">
                  <span className="tabular-nums">{formatMoney(summary.openBalance)}</span>
                </Detail>
                <Detail label="Vehicles purchased">{summary.vehiclesOwned.length}</Detail>
                <Detail label="Open tasks">{tasks.filter((task) => !task.done).length}</Detail>
                <div className="col-span-2 sm:col-span-3">
                  <Detail label="Address">{formatAddress(customer.address)}</Detail>
                </div>
                {customer.notes && (
                  <div className="col-span-2 sm:col-span-3">
                    <Detail label="Notes">{customer.notes}</Detail>
                  </div>
                )}
              </div>
            )}

            {tab === 'deals' && (
              <div className="p-4 space-y-2.5">
                {deals.length === 0 && reservations.length === 0 ? (
                  <EmptyState title="No deals or reservations yet" />
                ) : (
                  <>
                    {deals.map((deal) => {
                      const totals = dealTotals(state, deal);
                      const vehicle = getVehicle(state, deal.vehicleId);
                      return (
                        <a
                          key={deal.id}
                          href={paths.deal(deal.id)}
                          className="block border border-app-border rounded-[2px] px-3 py-2.5 transition-colors hover:bg-app-bg"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-[0.875rem] text-charcoal">
                              {deal.code} · {vehicle ? vehicleTitle(vehicle) : 'No vehicle'}
                            </span>
                            <DealStatusBadge status={deal.status} />
                          </div>
                          <p className="mt-0.5 text-[0.75rem] text-muted tabular-nums">
                            {formatMoney(totals.total)} total · {formatMoney(totals.balance)} balance
                          </p>
                        </a>
                      );
                    })}
                    {reservations.map((reservation) => (
                      <a
                        key={reservation.id}
                        href={paths.reservation(reservation.id)}
                        className="block border border-app-border rounded-[2px] px-3 py-2 transition-colors hover:bg-app-bg"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-[0.875rem] text-charcoal">{reservation.code}</span>
                          <ReservationStatusBadge status={reservation.status} />
                        </div>
                      </a>
                    ))}
                  </>
                )}

                {financing.length > 0 && (
                  <div className="pt-2">
                    <h3 className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-muted mb-2">
                      Financing
                    </h3>
                    {financing.map((application) => (
                      <a
                        key={application.id}
                        href={paths.financingApplication(application.id)}
                        className="flex items-baseline justify-between gap-2 border-b border-app-border py-2 last:border-b-0 hover:text-copper transition-colors"
                      >
                        <span className="text-[0.875rem] text-charcoal">{application.code}</span>
                        <FinancingStatusBadge status={application.status} />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'payments' && (
              <div className="p-4">
                {payments.length === 0 ? (
                  <EmptyState title="No payments recorded" />
                ) : (
                  <ul className="divide-y divide-app-border -my-2.5">
                    {payments.map((payment) => (
                      <li key={payment.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
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
              </div>
            )}

            {tab === 'documents' && (
              <div className="p-4">
                {documents.length === 0 ? (
                  <EmptyState title="No documents tracked" />
                ) : (
                  <ul className="divide-y divide-app-border -my-2.5">
                    {documents.map((document) => (
                      <li key={document.id} className="flex items-baseline justify-between gap-2 py-2.5">
                        <span className="text-[0.875rem] text-charcoal">{document.type}</span>
                        <DocumentStatusBadge status={document.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === 'activity' && (
              <div className="p-4">
                <Timeline events={events} emptyMessage="Nothing recorded for this customer yet." />
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Vehicles purchased" as="h3" />
            {summary.vehiclesOwned.length === 0 ? (
              <EmptyState title="None yet" />
            ) : (
              <ul>
                {summary.vehiclesOwned.map((vehicle) => (
                  <li key={vehicle.id} className="border-b border-app-border last:border-b-0">
                    <a
                      href={paths.vehicle(vehicle.id)}
                      className="block px-4 py-2.5 transition-colors hover:bg-app-bg"
                    >
                      <span className="block text-[0.875rem] text-charcoal">
                        {vehicleTitle(vehicle)}
                      </span>
                      <span className="block text-[0.75rem] text-muted">
                        {vehicle.code} · sold {vehicle.soldAt ? formatDate(vehicle.soldAt) : '—'}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {leads.length > 0 && (
            <Panel>
              <PanelHeader title="Originating leads" as="h3" />
              <ul>
                {leads.map((lead) => (
                  <li key={lead.id} className="border-b border-app-border last:border-b-0">
                    <a
                      href={paths.lead(lead.id)}
                      className="flex items-baseline justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-app-bg"
                    >
                      <span className="text-[0.875rem] text-charcoal">{lead.code}</span>
                      <LeadStageBadge stage={lead.stage} />
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>

      <CustomerForm open={editOpen} onClose={() => setEditOpen(false)} customer={customer} />
      <ReservationForm
        open={reserveOpen}
        onClose={() => setReserveOpen(false)}
        customerId={customer.id}
        onCreated={(id) => navigate(paths.reservation(id))}
      />
      <DealForm
        open={dealOpen}
        onClose={() => setDealOpen(false)}
        customerId={customer.id}
        onCreated={(id) => navigate(paths.deal(id))}
      />
    </div>
  );
}
