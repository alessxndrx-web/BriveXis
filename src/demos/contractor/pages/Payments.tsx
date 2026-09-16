import { useMemo, useState } from 'react';
import { useContractor } from '../ContractorProvider';
import { PAYMENT_METHODS, type Payment } from '../contractor.types';
import {
  getCustomer,
  getInvoice,
  invoiceBalance,
  invoiceStatus,
  paymentHistory,
} from '../contractor.selectors';
import { paths } from '../contractor.routes';
import { formatDateNumeric, formatMoney, matches, parseDateOnly } from '../contractor.utils';
import {
  Button,
  EmptyState,
  FieldLabel,
  InlineField,
  Panel,
  PanelHeader,
  PageHeader,
  Select,
  TextInput,
  Toolbar,
} from '../components/AppUI';
import { CellMeta, DataTable, type Column } from '../components/DataTable';
import { InvoiceStatusBadge } from '../components/StatusBadge';
import { ColumnChart } from '../components/Charts';
import { PaymentForm } from '../forms/FinanceForms';

/**
 * Recorded payments.
 *
 * This is a record of money already received, not a payment processor. No card
 * details are ever requested and nothing is charged.
 */
export function PaymentsPage() {
  const { state } = useContractor();
  const now = useMemo(() => new Date(), []);
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState('all');
  const [recordFor, setRecordFor] = useState<string>('');

  const filtered = useMemo(
    () =>
      state.payments.filter((payment) => {
        if (method !== 'all' && payment.method !== method) return false;
        const customer = getCustomer(state, payment.customerId);
        const invoice = getInvoice(state, payment.invoiceId);
        return matches(query, payment.code, payment.reference, customer?.name, invoice?.code);
      }),
    [state, query, method],
  );

  const history = useMemo(() => paymentHistory(state, 6, now), [state, now]);

  const received = useMemo(
    () => state.payments.reduce((sum, payment) => sum + payment.amount, 0),
    [state.payments],
  );

  const monthTotal = useMemo(() => {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return state.payments
      .filter((payment) => parseDateOnly(payment.receivedAt) >= monthStart)
      .reduce((sum, payment) => sum + payment.amount, 0);
  }, [state.payments, now]);

  /** Invoices that can still take money, offered in the record-payment picker. */
  const openInvoices = useMemo(
    () =>
      state.invoices.filter((invoice) => {
        const status = invoiceStatus(state, invoice, now);
        return status !== 'Paid' && status !== 'Void' && invoiceBalance(state, invoice) > 0;
      }),
    [state, now],
  );

  const selectedInvoice = openInvoices.find((invoice) => invoice.id === recordFor);

  const columns: Column<Payment>[] = [
    {
      key: 'code',
      header: 'Payment',
      width: 'w-32',
      sortValue: (payment) => payment.code,
      cell: (payment) => (
        <>
          <span className="block tabular-nums">{payment.code}</span>
          <CellMeta>{formatDateNumeric(payment.receivedAt)}</CellMeta>
        </>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      sortValue: (payment) => getCustomer(state, payment.customerId)?.name ?? '',
      cell: (payment) => {
        const customer = getCustomer(state, payment.customerId);
        return customer ? (
          <a
            href={paths.customer(customer.id)}
            className="text-[0.8125rem] text-muted hover:text-copper transition-colors"
          >
            {customer.name}
          </a>
        ) : (
          <span className="text-[0.8125rem] text-muted">—</span>
        );
      },
    },
    {
      key: 'invoice',
      header: 'Invoice',
      width: 'w-36',
      sortValue: (payment) => getInvoice(state, payment.invoiceId)?.code ?? '',
      cell: (payment) => {
        const invoice = getInvoice(state, payment.invoiceId);
        if (!invoice) return <span className="text-[0.8125rem] text-muted">—</span>;
        return (
          <span className="flex items-center gap-2">
            <a
              href={paths.invoice(invoice.id)}
              className="text-[0.8125rem] tabular-nums text-muted hover:text-copper transition-colors"
            >
              {invoice.code}
            </a>
            <InvoiceStatusBadge status={invoiceStatus(state, invoice, now)} />
          </span>
        );
      },
    },
    {
      key: 'method',
      header: 'Method',
      width: 'w-24',
      hideBelow: 'sm',
      sortValue: (payment) => payment.method,
      cell: (payment) => <span className="text-[0.8125rem] text-muted">{payment.method}</span>,
    },
    {
      key: 'reference',
      header: 'Reference',
      hideBelow: 'lg',
      cell: (payment) => (
        <span className="text-[0.8125rem] text-muted truncate block max-w-[12rem]">
          {payment.reference ?? '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      width: 'w-28',
      align: 'right',
      sortValue: (payment) => payment.amount,
      cell: (payment) => (
        <span className="tabular-nums text-[0.8125rem] text-charcoal font-medium">
          {formatMoney(payment.amount)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payments"
        description="Money received against issued invoices. Demo only — no real transaction is processed."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Received by month" meta="Last six months" />
          <div className="px-3.5 py-3.5">
            <ColumnChart data={history} showAmount caption="Payments received by month" />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Record a payment" />
          <div className="px-3.5 py-3.5 space-y-3">
            <div>
              <FieldLabel>This month</FieldLabel>
              <p className="mt-1 font-heading font-semibold text-[1.375rem] tabular-nums text-charcoal">
                {formatMoney(monthTotal)}
              </p>
            </div>
            <div>
              <FieldLabel>All time</FieldLabel>
              <p className="mt-1 text-[0.9375rem] tabular-nums text-muted">{formatMoney(received)}</p>
            </div>

            <div className="border-t border-app-border pt-3">
              <label
                htmlFor="payment-invoice"
                className="block text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted mb-1"
              >
                Against invoice
              </label>
              {openInvoices.length === 0 ? (
                <p className="text-[0.8125rem] text-muted">
                  Every issued invoice is settled. Nothing to record.
                </p>
              ) : (
                <>
                  <Select
                    id="payment-invoice"
                    value={recordFor}
                    onChange={(event) => setRecordFor(event.target.value)}
                  >
                    <option value="">Select an invoice</option>
                    {openInvoices.map((invoice) => (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.code} — {getCustomer(state, invoice.customerId)?.name} (
                        {formatMoney(invoiceBalance(state, invoice))} due)
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!selectedInvoice}
                    onClick={() => selectedInvoice && setRecordFor(selectedInvoice.id)}
                    className="mt-2 w-full"
                  >
                    Record demo payment
                  </Button>
                </>
              )}
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <Toolbar>
          <div className="flex-1 min-w-[12rem]">
            <label htmlFor="payment-search" className="sr-only">
              Search payments
            </label>
            <TextInput
              id="payment-search"
              type="search"
              placeholder="Search by payment, invoice, customer or reference…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-8"
            />
          </div>

          <InlineField label="Method" htmlFor="payment-method">
            <Select
              id="payment-method"
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              className="h-8 w-auto"
            >
              <option value="all">All</option>
              {PAYMENT_METHODS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </InlineField>

          <span className="ml-auto text-[0.75rem] text-muted tabular-nums">
            {filtered.length} of {state.payments.length}
          </span>
        </Toolbar>

        <DataTable
          caption="Payments"
          columns={columns}
          rows={filtered}
          rowKey={(payment) => payment.id}
          defaultSort={{ key: 'code', direction: 'desc' }}
          empty={
            <EmptyState
              title="No payments match these filters."
              action={
                <Button
                  onClick={() => {
                    setQuery('');
                    setMethod('all');
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          }
        />
      </Panel>

      {selectedInvoice && (
        <PaymentForm
          open={Boolean(selectedInvoice)}
          onClose={() => setRecordFor('')}
          invoice={selectedInvoice}
        />
      )}
    </div>
  );
}
