import { useMemo, useState } from 'react';
import { Printer, Send } from 'lucide-react';
import { useContractor } from '../ContractorProvider';
import { useRouter } from '../../../lib/router';
import { INVOICE_STATUSES, type Invoice, type LineItem } from '../contractor.types';
import {
  activityFor,
  getCustomer,
  getJob,
  invoiceBalance,
  invoicePaidAmount,
  invoicePayments,
  invoiceStatus,
  invoiceTotal,
} from '../contractor.selectors';
import { paths } from '../contractor.routes';
import {
  formatAddress,
  formatDate,
  formatDateNumeric,
  formatMoney,
  formatRelativeDay,
  matches,
} from '../contractor.utils';
import {
  Button,
  Detail,
  EmptyState,
  FormField,
  InlineField,
  LinkButton,
  Panel,
  PanelHeader,
  PageHeader,
  Select,
  TextArea,
  TextInput,
  Toolbar,
} from '../components/AppUI';
import { CellMeta, DataTable, type Column } from '../components/DataTable';
import { InvoiceStatusBadge, JobStatusBadge } from '../components/StatusBadge';
import { LineItemEditor, LineItemTable, TotalsSummary } from '../components/LineItemEditor';
import { Timeline } from '../components/Timeline';
import { ConfirmDialog } from '../components/Dialog';
import { PaymentForm } from '../forms/FinanceForms';

export function InvoicesPage() {
  const { state } = useContractor();
  const now = useMemo(() => new Date(), []);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');

  const filtered = useMemo(
    () =>
      state.invoices.filter((invoice) => {
        if (status !== 'all' && invoiceStatus(state, invoice, now) !== status) return false;
        const customer = getCustomer(state, invoice.customerId);
        return matches(query, invoice.code, customer?.name);
      }),
    [state, query, status, now],
  );

  const columns: Column<Invoice>[] = [
    {
      key: 'code',
      header: 'Invoice',
      width: 'w-32',
      sortValue: (invoice) => invoice.code,
      cell: (invoice) => (
        <>
          <span className="block tabular-nums">{invoice.code}</span>
          <CellMeta>{formatDateNumeric(invoice.issuedAt)}</CellMeta>
        </>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      sortValue: (invoice) => getCustomer(state, invoice.customerId)?.name ?? '',
      cell: (invoice) => (
        <span className="text-[0.8125rem] text-muted truncate block max-w-[16rem]">
          {getCustomer(state, invoice.customerId)?.name}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 'w-28',
      sortValue: (invoice) => INVOICE_STATUSES.indexOf(invoiceStatus(state, invoice, now)),
      cell: (invoice) => <InvoiceStatusBadge status={invoiceStatus(state, invoice, now)} />,
    },
    {
      key: 'due',
      header: 'Due',
      width: 'w-32',
      hideBelow: 'md',
      sortValue: (invoice) => invoice.dueAt,
      cell: (invoice) => {
        const overdue = invoiceStatus(state, invoice, now) === 'Overdue';
        return (
          <span
            className={`text-[0.8125rem] tabular-nums ${overdue ? 'text-danger font-medium' : 'text-muted'}`}
          >
            {formatDateNumeric(invoice.dueAt)}
          </span>
        );
      },
    },
    {
      key: 'total',
      header: 'Total',
      width: 'w-28',
      align: 'right',
      sortValue: (invoice) => invoiceTotal(invoice),
      cell: (invoice) => (
        <span className="tabular-nums text-[0.8125rem] text-muted">
          {formatMoney(invoiceTotal(invoice))}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      width: 'w-28',
      align: 'right',
      sortValue: (invoice) => invoiceBalance(state, invoice),
      cell: (invoice) => {
        const balance = invoiceBalance(state, invoice);
        return (
          <span
            className={`tabular-nums text-[0.8125rem] ${
              balance > 0 ? 'text-charcoal font-medium' : 'text-success'
            }`}
          >
            {balance > 0 ? formatMoney(balance) : 'Settled'}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Invoices"
        description="Billing raised from completed work, with what is still outstanding."
      />

      <Panel>
        <Toolbar>
          <div className="flex-1 min-w-[12rem]">
            <label htmlFor="invoice-search" className="sr-only">
              Search invoices
            </label>
            <TextInput
              id="invoice-search"
              type="search"
              placeholder="Search by invoice number or customer…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-8"
            />
          </div>

          <InlineField label="Status" htmlFor="invoice-status">
            <Select
              id="invoice-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-8 w-auto"
            >
              <option value="all">All</option>
              {INVOICE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </InlineField>

          <span className="ml-auto text-[0.75rem] text-muted tabular-nums">
            {filtered.length} of {state.invoices.length}
          </span>
        </Toolbar>

        <DataTable
          caption="Invoices"
          columns={columns}
          rows={filtered}
          rowKey={(invoice) => invoice.id}
          rowHref={(invoice) => paths.invoice(invoice.id)}
          defaultSort={{ key: 'due', direction: 'asc' }}
          empty={
            <EmptyState
              title="No invoices match these filters."
              description="Invoices are created from completed jobs."
              action={
                <Button
                  onClick={() => {
                    setQuery('');
                    setStatus('all');
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          }
        />
      </Panel>
    </div>
  );
}

// -------------------------------------------------------------- detail

export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const { state, dispatch, notify } = useContractor();
  const { navigate } = useRouter();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);

  const invoice = state.invoices.find((candidate) => candidate.id === invoiceId);
  const payments = useMemo(
    () => (invoice ? invoicePayments(state, invoice.id) : []),
    [state, invoice],
  );
  const events = useMemo(
    () => (invoice ? activityFor(state, 'invoice', invoice.id) : []),
    [state, invoice],
  );

  if (!invoice) {
    return (
      <EmptyState
        title="Invoice not found"
        action={<LinkButton href={paths.module('invoices')}>Back to invoices</LinkButton>}
      />
    );
  }

  const customer = getCustomer(state, invoice.customerId);
  const job = getJob(state, invoice.jobId);
  const status = invoiceStatus(state, invoice);
  const paid = invoicePaidAmount(state, invoice.id);
  const balance = invoiceBalance(state, invoice);
  const canRecordPayment = status !== 'Void' && status !== 'Paid';

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <a href={paths.module('invoices')} className="hover:text-copper transition-colors">
            Invoices
          </a>
        }
        title={`Invoice ${invoice.code}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <InvoiceStatusBadge status={status} />
            <span className="text-muted">
              {customer?.name} · issued {formatDate(invoice.issuedAt)} · due{' '}
              {formatDate(invoice.dueAt)}
            </span>
          </span>
        }
        actions={
          <>
            <LinkButton href={paths.invoicePrint(invoice.id)}>
              <Printer size={14} aria-hidden="true" />
              Print
            </LinkButton>
            {invoice.status === 'Draft' && (
              <>
                <Button onClick={() => navigate(paths.invoiceEdit(invoice.id))}>Edit</Button>
                <Button
                  onClick={() => {
                    dispatch({ type: 'invoice/send', id: invoice.id });
                    notify(`${invoice.code} marked sent.`, 'success');
                  }}
                >
                  <Send size={14} aria-hidden="true" />
                  Mark sent
                </Button>
              </>
            )}
            {canRecordPayment && (
              <Button variant="primary" onClick={() => setPaymentOpen(true)}>
                Record payment
              </Button>
            )}
          </>
        }
      />

      {status === 'Overdue' && (
        <div className="border border-danger/40 bg-danger/[0.05] rounded-[3px] px-3.5 py-2.5">
          <p className="text-[0.8125rem] text-danger">
            This invoice was due {formatRelativeDay(invoice.dueAt)} and has{' '}
            {formatMoney(balance)} outstanding.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Panel>
            <PanelHeader title="Billed items" meta={`${invoice.items.length} lines`} />
            <LineItemTable items={invoice.items} />
            <div className="border-t border-app-border px-3.5 py-3.5">
              <TotalsSummary
                items={invoice.items}
                taxRate={invoice.taxRate}
                discount={invoice.discount}
                paid={paid}
                balance={balance}
              />
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Payments"
              meta={payments.length > 0 ? `${payments.length} recorded` : undefined}
              actions={
                canRecordPayment ? (
                  <Button size="sm" onClick={() => setPaymentOpen(true)}>
                    Record payment
                  </Button>
                ) : undefined
              }
            />
            {payments.length === 0 ? (
              <EmptyState
                title="No payments recorded"
                description="Recording a payment updates the balance, the invoice status and the customer's history."
              />
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
                    <span className="shrink-0 tabular-nums text-[0.875rem] text-success font-medium">
                      {formatMoney(payment.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="border-t border-app-border px-3.5 py-2 text-[0.75rem] text-muted">
              Demo only — no real transaction is processed.
            </p>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Summary" />
            <div className="grid grid-cols-2 gap-4 px-3.5 py-3.5">
              <Detail label="Total">
                <span className="tabular-nums">{formatMoney(invoiceTotal(invoice))}</span>
              </Detail>
              <Detail label="Paid">
                <span className="tabular-nums text-success">{formatMoney(paid)}</span>
              </Detail>
              <Detail label="Balance">
                <span
                  className={`tabular-nums font-semibold ${balance > 0 ? 'text-charcoal' : 'text-success'}`}
                >
                  {formatMoney(Math.max(0, balance))}
                </span>
              </Detail>
              <Detail label="Terms">Net {state.settings.paymentTermsDays}</Detail>
              <Detail label="Customer" className="col-span-2">
                {customer ? (
                  <a
                    href={paths.customer(customer.id)}
                    className="hover:text-copper transition-colors"
                  >
                    {customer.name}
                  </a>
                ) : (
                  '—'
                )}
              </Detail>
              {customer && (
                <Detail label="Billing address" className="col-span-2">
                  {formatAddress(customer.billingAddress)}
                </Detail>
              )}
            </div>

            {invoice.status !== 'Void' && (
              <div className="border-t border-app-border px-3.5 py-3">
                <Button size="sm" variant="danger" onClick={() => setVoidOpen(true)}>
                  Void invoice
                </Button>
              </div>
            )}
          </Panel>

          {job && (
            <Panel>
              <PanelHeader title="Job" />
              <a
                href={paths.job(job.id)}
                className="flex items-center justify-between gap-3 px-3.5 py-3 transition-colors hover:bg-app-hover"
              >
                <span className="min-w-0">
                  <span className="block text-[0.875rem] text-charcoal truncate">{job.title}</span>
                  <CellMeta>{job.code}</CellMeta>
                </span>
                <JobStatusBadge status={job.status} />
              </a>
            </Panel>
          )}

          {invoice.notes && (
            <Panel>
              <PanelHeader title="Notes" />
              <p className="px-3.5 py-3 text-[0.875rem] text-muted leading-relaxed">
                {invoice.notes}
              </p>
            </Panel>
          )}

          <Panel>
            <PanelHeader title="Activity" />
            <div className="px-3.5 py-2">
              <Timeline events={events} />
            </div>
          </Panel>
        </div>
      </div>

      <PaymentForm open={paymentOpen} onClose={() => setPaymentOpen(false)} invoice={invoice} />

      <ConfirmDialog
        open={voidOpen}
        onCancel={() => setVoidOpen(false)}
        onConfirm={() => {
          dispatch({ type: 'invoice/void', id: invoice.id });
          setVoidOpen(false);
          notify(`${invoice.code} voided.`);
        }}
        title="Void this invoice?"
        confirmLabel="Void invoice"
        tone="danger"
        description={`${invoice.code} will be marked void and excluded from outstanding balances. Recorded payments stay on the record.`}
      />
    </div>
  );
}

// -------------------------------------------------------------- editor

export function InvoiceEditor({ invoiceId }: { invoiceId: string }) {
  const { state, dispatch, notify } = useContractor();
  const { navigate } = useRouter();

  const invoice = state.invoices.find((candidate) => candidate.id === invoiceId);

  const [items, setItems] = useState<LineItem[]>(
    () => invoice?.items.map((item) => ({ ...item })) ?? [],
  );
  const [taxRate, setTaxRate] = useState(invoice?.taxRate ?? state.settings.defaultTaxRate);
  const [discount, setDiscount] = useState(invoice?.discount ?? 0);
  const [dueAt, setDueAt] = useState(invoice?.dueAt ?? '');
  const [notes, setNotes] = useState(invoice?.notes ?? '');
  const [error, setError] = useState<string>();

  if (!invoice) {
    return (
      <EmptyState
        title="Invoice not found"
        action={<LinkButton href={paths.module('invoices')}>Back to invoices</LinkButton>}
      />
    );
  }

  const job = getJob(state, invoice.jobId);
  const customer = getCustomer(state, invoice.customerId);

  const save = () => {
    const priced = items.filter(
      (item) => item.description.trim() && item.quantity > 0 && item.unitPrice > 0,
    );
    if (priced.length === 0) {
      setError('Add at least one line item with a description, quantity and price.');
      return;
    }

    dispatch({
      type: 'invoice/update',
      id: invoice.id,
      patch: {
        items: items.filter((item) => item.description.trim() || item.unitPrice > 0),
        taxRate,
        discount,
        dueAt,
        notes: notes.trim(),
      },
    });
    notify(`${invoice.code} saved.`, 'success');
    navigate(paths.invoice(invoice.id));
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <a href={paths.invoice(invoice.id)} className="hover:text-copper transition-colors">
            {invoice.code}
          </a>
        }
        title={`Edit invoice ${invoice.code}`}
        description={
          job
            ? `Pre-filled from ${job.code}${
                invoice.estimateId ? ' and its accepted estimate' : ''
              }. Adjust before sending.`
            : 'Adjust the billed items before sending.'
        }
        actions={
          <>
            <Button onClick={() => navigate(paths.invoice(invoice.id))}>Cancel</Button>
            <Button variant="primary" onClick={save}>
              Save invoice
            </Button>
          </>
        }
      />

      <Panel>
        <PanelHeader title="Billing" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-3.5 py-3.5">
          <Detail label="Customer">{customer?.name ?? '—'}</Detail>
          <Detail label="Issued">{formatDate(invoice.issuedAt)}</Detail>
          <FormField label="Due date" htmlFor="dueAt">
            <TextInput
              id="dueAt"
              type="date"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </FormField>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Line items" />
        <div className="px-2 py-3">
          <LineItemEditor
            items={items}
            onChange={(next) => {
              setItems(next);
              setError(undefined);
            }}
            taxRate={taxRate}
            onTaxRateChange={setTaxRate}
            discount={discount}
            onDiscountChange={setDiscount}
            error={error}
          />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Notes" />
        <div className="px-3.5 py-3.5">
          <FormField label="Notes on the invoice" htmlFor="notes" optional>
            <TextArea
              id="notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>
        </div>
      </Panel>

      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={() => navigate(paths.invoice(invoice.id))}>Cancel</Button>
        <Button variant="primary" onClick={save}>
          Save invoice
        </Button>
      </div>
    </div>
  );
}
