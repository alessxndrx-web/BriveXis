import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useContractor } from '../ContractorProvider';
import type { Customer } from '../contractor.types';
import {
  activityFor,
  customerEstimates,
  customerInvoices,
  customerJobs,
  customerLifetimeValue,
  customerLocations,
  customerOpenBalance,
  customerPayments,
  customerHasOpenWork,
  invoiceBalance,
  invoiceStatus,
  invoiceTotal,
  estimateTotal,
} from '../contractor.selectors';
import { paths } from '../contractor.routes';
import {
  formatAddress,
  formatDate,
  formatMoney,
  formatPhone,
  matches,
} from '../contractor.utils';
import {
  Button,
  Detail,
  EmptyState,
  FieldLabel,
  LinkButton,
  Panel,
  PageHeader,
  Tabs,
  TextInput,
  Toolbar,
} from '../components/AppUI';
import { CellMeta, DataTable, type Column } from '../components/DataTable';
import {
  EstimateStatusBadge,
  InvoiceStatusBadge,
  JobStatusBadge,
} from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import { CustomerForm } from '../forms/CustomerForm';

export function CustomersPage() {
  const { state } = useContractor();
  const [query, setQuery] = useState('');
  const [openOnly, setOpenOnly] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const filtered = useMemo(
    () =>
      state.customers.filter((customer) => {
        if (openOnly && !customerHasOpenWork(state, customer)) return false;
        return matches(
          query,
          customer.code,
          customer.name,
          customer.company,
          customer.email,
          customer.phone,
          customer.billingAddress.city,
        );
      }),
    [state, query, openOnly],
  );

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Customer',
      sortValue: (customer) => customer.name,
      cell: (customer) => (
        <>
          <span className="block truncate max-w-[16rem]">{customer.name}</span>
          <CellMeta>{customer.company ?? customer.code}</CellMeta>
        </>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      hideBelow: 'md',
      cell: (customer) => (
        <>
          <span className="block text-[0.8125rem] text-muted">{formatPhone(customer.phone)}</span>
          <CellMeta>{customer.email}</CellMeta>
        </>
      ),
    },
    {
      key: 'city',
      header: 'Billing city',
      hideBelow: 'lg',
      sortValue: (customer) => customer.billingAddress.city,
      cell: (customer) => (
        <span className="text-[0.8125rem] text-muted">
          {customer.billingAddress.city}, {customer.billingAddress.state}
        </span>
      ),
    },
    {
      key: 'locations',
      header: 'Locations',
      width: 'w-24',
      align: 'right',
      sortValue: (customer) => customerLocations(state, customer.id).length,
      cell: (customer) => (
        <span className="tabular-nums text-[0.8125rem] text-muted">
          {customerLocations(state, customer.id).length}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Open balance',
      width: 'w-32',
      align: 'right',
      sortValue: (customer) => customerOpenBalance(state, customer.id),
      cell: (customer) => {
        const balance = customerOpenBalance(state, customer.id);
        return (
          <span
            className={`tabular-nums text-[0.8125rem] ${balance > 0 ? 'text-charcoal' : 'text-muted'}`}
          >
            {formatMoney(balance)}
          </span>
        );
      },
    },
    {
      key: 'lifetime',
      header: 'Received',
      width: 'w-32',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (customer) => customerLifetimeValue(state, customer.id),
      cell: (customer) => (
        <span className="tabular-nums text-[0.8125rem] text-muted">
          {formatMoney(customerLifetimeValue(state, customer.id))}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        description="Accounts, their service locations and their operational history."
        actions={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <Plus size={14} aria-hidden="true" />
            New customer
          </Button>
        }
      />

      <Panel>
        <Toolbar>
          <div className="flex-1 min-w-[12rem]">
            <label htmlFor="customer-search" className="sr-only">
              Search customers
            </label>
            <TextInput
              id="customer-search"
              type="search"
              placeholder="Search by name, company or phone…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-8"
            />
          </div>

          <button
            type="button"
            aria-pressed={openOnly}
            onClick={() => setOpenOnly((current) => !current)}
            className={`h-8 px-2.5 border rounded-[2px] text-[0.8125rem] transition-colors ${
              openOnly
                ? 'border-copper bg-copper/10 text-copper font-medium'
                : 'border-app-border-strong text-muted hover:bg-app-hover hover:text-charcoal'
            }`}
          >
            Open work only
          </button>

          <span className="ml-auto text-[0.75rem] text-muted tabular-nums">
            {filtered.length} of {state.customers.length}
          </span>
        </Toolbar>

        <DataTable
          caption="Customers"
          columns={columns}
          rows={filtered}
          rowKey={(customer) => customer.id}
          rowHref={(customer) => paths.customer(customer.id)}
          defaultSort={{ key: 'name', direction: 'asc' }}
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

// -------------------------------------------------------------- detail

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'estimates', label: 'Estimates' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'financial', label: 'Financial' },
  { id: 'activity', label: 'Activity' },
];

export function CustomerDetail({ customerId }: { customerId: string }) {
  const { state } = useContractor();
  const [tab, setTab] = useState('overview');
  const [editOpen, setEditOpen] = useState(false);

  const customer = state.customers.find((candidate) => candidate.id === customerId);

  const locations = useMemo(
    () => (customer ? customerLocations(state, customer.id) : []),
    [state, customer],
  );
  const estimates = useMemo(
    () => (customer ? customerEstimates(state, customer.id) : []),
    [state, customer],
  );
  const jobs = useMemo(() => (customer ? customerJobs(state, customer.id) : []), [state, customer]);
  const invoices = useMemo(
    () => (customer ? customerInvoices(state, customer.id) : []),
    [state, customer],
  );
  const payments = useMemo(
    () => (customer ? customerPayments(state, customer.id) : []),
    [state, customer],
  );
  const events = useMemo(
    () => (customer ? activityFor(state, 'customer', customer.id, 40) : []),
    [state, customer],
  );

  if (!customer) {
    return (
      <EmptyState
        title="Customer not found"
        action={<LinkButton href={paths.module('customers')}>Back to customers</LinkButton>}
      />
    );
  }

  const openBalance = customerOpenBalance(state, customer.id);
  const lifetime = customerLifetimeValue(state, customer.id);

  const tabsWithCounts = TABS.map((definition) => ({
    ...definition,
    count:
      definition.id === 'estimates'
        ? estimates.length
        : definition.id === 'jobs'
          ? jobs.length
          : definition.id === 'financial'
            ? invoices.length
            : undefined,
  }));

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
            {customer.company ? `${customer.company} · ` : ''}
            {customer.code} · Customer since {formatDate(customer.customerSince)}
          </span>
        }
        actions={<Button onClick={() => setEditOpen(true)}>Edit customer</Button>}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-app-panel border border-app-border rounded-[3px] p-3">
          <FieldLabel>Open balance</FieldLabel>
          <p className="mt-1.5 font-heading font-semibold text-[1.125rem] tabular-nums text-charcoal">
            {formatMoney(openBalance)}
          </p>
        </div>
        <div className="bg-app-panel border border-app-border rounded-[3px] p-3">
          <FieldLabel>Total received</FieldLabel>
          <p className="mt-1.5 font-heading font-semibold text-[1.125rem] tabular-nums text-charcoal">
            {formatMoney(lifetime)}
          </p>
        </div>
        <div className="bg-app-panel border border-app-border rounded-[3px] p-3">
          <FieldLabel>Jobs</FieldLabel>
          <p className="mt-1.5 font-heading font-semibold text-[1.125rem] tabular-nums text-charcoal">
            {jobs.length}
          </p>
        </div>
        <div className="bg-app-panel border border-app-border rounded-[3px] p-3">
          <FieldLabel>Locations</FieldLabel>
          <p className="mt-1.5 font-heading font-semibold text-[1.125rem] tabular-nums text-charcoal">
            {locations.length}
          </p>
        </div>
      </div>

      <Panel>
        <div className="border-b border-app-border px-2">
          <Tabs tabs={tabsWithCounts} active={tab} onChange={setTab} label="Customer sections" />
        </div>

        <div id={`tabpanel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {tab === 'overview' && (
            <div className="divide-y divide-app-border">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 px-3.5 py-3.5">
                <Detail label="Phone">
                  <a href={`tel:${customer.phone}`} className="hover:text-copper transition-colors">
                    {formatPhone(customer.phone)}
                  </a>
                </Detail>
                <Detail label="Email">
                  <a
                    href={`mailto:${customer.email}`}
                    className="hover:text-copper transition-colors break-all"
                  >
                    {customer.email}
                  </a>
                </Detail>
                <Detail label="Billing address" className="col-span-2 sm:col-span-1">
                  {formatAddress(customer.billingAddress)}
                </Detail>
              </div>

              <div className="px-3.5 py-3.5">
                <FieldLabel className="mb-2">Service locations</FieldLabel>
                <ul className="space-y-1.5">
                  {locations.map((location) => (
                    <li
                      key={location.id}
                      className="flex flex-wrap items-baseline gap-x-2 text-[0.875rem]"
                    >
                      <span className="font-medium text-charcoal">{location.label}</span>
                      <span className="text-muted">{formatAddress(location.address)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {customer.notes && (
                <div className="px-3.5 py-3.5">
                  <FieldLabel>Notes</FieldLabel>
                  <p className="mt-1.5 text-[0.875rem] text-charcoal leading-relaxed">
                    {customer.notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === 'estimates' &&
            (estimates.length === 0 ? (
              <EmptyState title="No estimates yet" />
            ) : (
              <ul className="divide-y divide-app-border">
                {estimates.map((estimate) => (
                  <li key={estimate.id}>
                    <a
                      href={paths.estimate(estimate.id)}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-app-hover"
                    >
                      <span className="min-w-0">
                        <span className="block text-[0.875rem] text-charcoal truncate">
                          {estimate.title}
                        </span>
                        <CellMeta>
                          {estimate.code} · {formatDate(estimate.issuedAt)}
                        </CellMeta>
                      </span>
                      <span className="flex items-center gap-3 shrink-0">
                        <span className="tabular-nums text-[0.8125rem] text-charcoal">
                          {formatMoney(estimateTotal(estimate))}
                        </span>
                        <EstimateStatusBadge status={estimate.status} />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ))}

          {tab === 'jobs' &&
            (jobs.length === 0 ? (
              <EmptyState title="No jobs yet" />
            ) : (
              <ul className="divide-y divide-app-border">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <a
                      href={paths.job(job.id)}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-app-hover"
                    >
                      <span className="min-w-0">
                        <span className="block text-[0.875rem] text-charcoal truncate">
                          {job.title}
                        </span>
                        <CellMeta>
                          {job.code}
                          {job.scheduledStart && ` · ${formatDate(job.scheduledStart)}`}
                        </CellMeta>
                      </span>
                      <JobStatusBadge status={job.status} />
                    </a>
                  </li>
                ))}
              </ul>
            ))}

          {tab === 'financial' && (
            <div className="divide-y divide-app-border">
              <div>
                <div className="px-3.5 pt-3 pb-1.5">
                  <FieldLabel>Invoices</FieldLabel>
                </div>
                {invoices.length === 0 ? (
                  <p className="px-3.5 pb-3 text-[0.875rem] text-muted">No invoices yet.</p>
                ) : (
                  <ul className="divide-y divide-app-border">
                    {invoices.map((invoice) => (
                      <li key={invoice.id}>
                        <a
                          href={paths.invoice(invoice.id)}
                          className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-app-hover"
                        >
                          <span className="min-w-0">
                            <span className="block text-[0.875rem] text-charcoal">
                              {invoice.code}
                            </span>
                            <CellMeta>
                              Issued {formatDate(invoice.issuedAt)} · due {formatDate(invoice.dueAt)}
                            </CellMeta>
                          </span>
                          <span className="flex items-center gap-3 shrink-0">
                            <span className="text-right">
                              <span className="block tabular-nums text-[0.8125rem] text-charcoal">
                                {formatMoney(invoiceTotal(invoice))}
                              </span>
                              {invoiceBalance(state, invoice) > 0 && (
                                <span className="block text-[0.75rem] tabular-nums text-muted">
                                  {formatMoney(invoiceBalance(state, invoice))} due
                                </span>
                              )}
                            </span>
                            <InvoiceStatusBadge status={invoiceStatus(state, invoice)} />
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="px-3.5 pt-3 pb-1.5">
                  <FieldLabel>Payments</FieldLabel>
                </div>
                {payments.length === 0 ? (
                  <p className="px-3.5 pb-3 text-[0.875rem] text-muted">No payments recorded.</p>
                ) : (
                  <ul className="divide-y divide-app-border">
                    {payments.map((payment) => (
                      <li
                        key={payment.id}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                      >
                        <span className="min-w-0">
                          <span className="block text-[0.875rem] text-charcoal">
                            {payment.code} · {payment.method}
                          </span>
                          <CellMeta>
                            {formatDate(payment.receivedAt)}
                            {payment.reference && ` · ${payment.reference}`}
                          </CellMeta>
                        </span>
                        <span className="shrink-0 tabular-nums text-[0.8125rem] text-success font-medium">
                          {formatMoney(payment.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {tab === 'activity' && (
            <div className="px-3.5 py-2">
              <Timeline events={events} />
            </div>
          )}
        </div>
      </Panel>

      <CustomerForm open={editOpen} onClose={() => setEditOpen(false)} customer={customer} />
    </div>
  );
}
