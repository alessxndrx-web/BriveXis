import { useMemo, useState } from 'react';
import { Printer, ShieldAlert } from 'lucide-react';
import { useCommand, useWorkspace } from '../DistributionProvider';
import { paths } from '../distribution.routes';
import type { Invoice, Payment } from '../distribution.types';
import {
  getCustomer,
  getOrder,
  getProduct,
  invoiceBalance,
  invoicePaid,
  invoicePayments,
  invoiceStatus,
  outstandingReceivable,
  paymentsThisMonth,
} from '../distribution.selectors';
import { invoiceAging } from '../distribution.reports';
import { formatDate, formatMoney, matches, totals } from '../distribution.utils';
import {
  Button,
  Detail,
  EmptyState,
  InlineField,
  LinkButton,
  Metric,
  PageHeader,
  Panel,
  PanelHeader,
  Select,
  TextInput,
  Toolbar,
} from '../../shared/ui/AppUI';
import { type Column } from '../../shared/ui/DataTable';
import { Num, Records } from '../components/DataViews';
import { InvoiceStatusBadge } from '../components/StatusBadge';
import { DocumentTotals } from '../components/LineItemEditor';
import { PaymentForm } from '../forms/FinanceForms';

/**
 * Invoices and recorded payments.
 *
 * This is billing, not accounting. There is no ledger of accounts, no journal
 * and no financial statement: an invoice is what a customer was asked to pay,
 * and a payment is a note that money arrived by some means outside this
 * workspace.
 */

const ALL = 'all';
const DEMO_NOTICE = 'Demo only — no real transaction is processed.';

/** Cash recorded in the current calendar month. */
const receivedThisMonth = (state: ReturnType<typeof useWorkspace>) =>
  paymentsThisMonth(state).reduce((sum, payment) => sum + payment.amount, 0);

// ---------------------------------------------------------------- invoices

function invoiceColumns(state: ReturnType<typeof useWorkspace>): Column<Invoice>[] {
  return [
    {
      key: 'invoice',
      header: 'Invoice',
      sortValue: (invoice) => invoice.code,
      cell: (invoice) => (
        <>
          <span className="font-medium text-charcoal">{invoice.code}</span>
          <span className="mt-0.5 block text-[0.75rem] text-muted">
            {getCustomer(state, invoice.customerId)?.name}
          </span>
        </>
      ),
    },
    {
      key: 'date',
      header: 'Issued',
      width: 'w-28',
      hideBelow: 'md',
      sortValue: (invoice) => invoice.date,
      cell: (invoice) => <span className="text-muted">{formatDate(invoice.date)}</span>,
    },
    {
      key: 'due',
      header: 'Due',
      width: 'w-28',
      sortValue: (invoice) => invoice.dueDate,
      cell: (invoice) => <span className="text-muted">{formatDate(invoice.dueDate)}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      width: 'w-28',
      align: 'right',
      sortValue: (invoice) => totals(invoice).total,
      cell: (invoice) => <Num>{formatMoney(totals(invoice).total)}</Num>,
    },
    {
      key: 'paid',
      header: 'Paid',
      width: 'w-28',
      align: 'right',
      hideBelow: 'lg',
      sortValue: (invoice) => invoicePaid(state, invoice.id),
      cell: (invoice) => <Num tone="muted">{formatMoney(invoicePaid(state, invoice.id))}</Num>,
    },
    {
      key: 'balance',
      header: 'Balance',
      width: 'w-28',
      align: 'right',
      sortValue: (invoice) => invoiceBalance(state, invoice),
      cell: (invoice) => {
        const balance = invoice.status === 'Void' ? 0 : invoiceBalance(state, invoice);
        return <Num tone={balance === 0 ? 'muted' : undefined}>{formatMoney(balance)}</Num>;
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: 'w-32',
      sortValue: (invoice) => invoiceStatus(state, invoice),
      cell: (invoice) => <InvoiceStatusBadge status={invoiceStatus(state, invoice)} />,
    },
  ];
}

export function InvoicesPage() {
  const state = useWorkspace();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(ALL);

  const rows = useMemo(
    () =>
      state.invoices.filter((invoice) => {
        if (status !== ALL && invoiceStatus(state, invoice) !== status) return false;
        return matches(
          query,
          invoice.code,
          getCustomer(state, invoice.customerId)?.name,
          getOrder(state, invoice.orderId)?.code,
        );
      }),
    [state, query, status],
  );

  const aging = invoiceAging(state);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Invoices"
        description="Billing for shipped quantities. Invoices are created from a sales order once it has shipped."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric
          label="Outstanding"
          value={formatMoney(outstandingReceivable(state))}
          meta="Sent, unpaid balance"
        />
        <Metric
          label="Received this month"
          value={formatMoney(receivedThisMonth(state))}
          href={paths.module('payments')}
        />
        <Metric
          label="Invoices"
          value={state.invoices.filter((invoice) => invoice.status !== 'Void').length}
          meta={`${state.invoices.filter((invoice) => invoice.status === 'Void').length} void`}
        />
        <Metric
          label="Past due"
          value={formatMoney(
            aging
              .filter((bucket) => bucket.label !== 'Not yet due')
              .reduce((sum, bucket) => sum + (bucket.amount ?? 0), 0),
          )}
          tone={
            aging.some((bucket) => bucket.label !== 'Not yet due' && bucket.value > 0)
              ? 'warning'
              : 'default'
          }
        />
      </div>

      <Panel>
        <Toolbar>
          <div className="w-full sm:w-64">
            <label htmlFor="invoice-search" className="sr-only">
              Search invoices
            </label>
            <TextInput
              id="invoice-search"
              type="search"
              placeholder="Invoice, customer, order…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <InlineField label="Status" htmlFor="invoice-status">
            <Select
              id="invoice-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All</option>
              {['Draft', 'Sent', 'Partial', 'Paid', 'Overdue', 'Void'].map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
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
            {rows.length} of {state.invoices.length}
          </span>
        </Toolbar>

        <Records
          caption="Invoices"
          rows={rows}
          columns={invoiceColumns(state)}
          href={(invoice) => paths.invoice(invoice.id)}
          cardSkip={['invoice']}
          cardTitle={(invoice) =>
            `${invoice.code} — ${getCustomer(state, invoice.customerId)?.name ?? ''}`
          }
          defaultSort={{ key: 'due', direction: 'asc' }}
          empty={
            <EmptyState
              title="No invoices match these filters."
              description="An invoice is created from a shipped sales order."
              action={<LinkButton href={paths.module('orders')}>Sales orders</LinkButton>}
            />
          }
        />
      </Panel>

      {state.invoices.length > 0 && (
        <Panel>
          <PanelHeader title="Outstanding by age" as="h2" />
          <ul className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {aging.map((bucket) => (
              <li key={bucket.label}>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted">
                  {bucket.label}
                </p>
                <p className="mt-1 text-[1.125rem] tabular-nums text-charcoal">
                  {formatMoney(bucket.amount ?? 0)}
                </p>
                <p className="text-[0.75rem] text-muted">{bucket.value} invoices</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const state = useWorkspace();
  const run = useCommand();
  const [paymentOpen, setPaymentOpen] = useState(false);

  const invoice = state.invoices.find((entry) => entry.id === invoiceId);

  if (!invoice) {
    return (
      <EmptyState
        title="That invoice is not in this workspace"
        action={<LinkButton href={paths.module('invoices')}>Back to invoices</LinkButton>}
      />
    );
  }

  const status = invoiceStatus(state, invoice);
  const customer = getCustomer(state, invoice.customerId);
  const order = getOrder(state, invoice.orderId);
  const payments = invoicePayments(state, invoice.id);
  const paid = invoicePaid(state, invoice.id);
  const balance = invoiceBalance(state, invoice);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <a href={paths.module('invoices')} className="hover:text-copper transition-colors">
            Invoices
          </a>
        }
        title={invoice.code}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <InvoiceStatusBadge status={status} />
            <span className="text-muted">
              {customer?.name} · issued {formatDate(invoice.date)} · due{' '}
              {formatDate(invoice.dueDate)}
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
              <Button
                variant="primary"
                onClick={() =>
                  run(
                    { type: 'invoice/send', invoiceId: invoice.id },
                    `${invoice.code} marked as sent. Payments can now be recorded against it.`,
                  )
                }
              >
                Mark as sent
              </Button>
            )}

            {invoice.status === 'Sent' && balance > 0 && (
              <Button variant="primary" onClick={() => setPaymentOpen(true)}>
                Record payment
              </Button>
            )}

            {invoice.status !== 'Void' && paid === 0 && (
              <Button
                variant="danger"
                onClick={() =>
                  run({ type: 'invoice/void', invoiceId: invoice.id }, `${invoice.code} voided.`)
                }
              >
                Void
              </Button>
            )}
          </>
        }
      />

      {invoice.status === 'Void' && (
        <p className="border border-app-border bg-app-panel rounded-[3px] px-3.5 py-2.5 text-[0.8125rem] text-muted">
          This invoice is void. It carries no balance and cannot take payments. The shipments it
          billed are untouched — voiding a bill never moves inventory.
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Invoice total" value={formatMoney(totals(invoice).total)} />
        <Metric label="Paid" value={formatMoney(paid)} meta={`${payments.length} payments`} />
        <Metric
          label="Balance"
          value={formatMoney(invoice.status === 'Void' ? 0 : balance)}
          tone={invoice.status !== 'Void' && balance > 0 ? 'warning' : 'default'}
        />
        <Metric
          label="Sales order"
          value={order?.code ?? '—'}
          href={order ? paths.order(order.id) : undefined}
          meta="Billed for shipped units"
        />
      </div>

      <Panel>
        <PanelHeader title="Billed lines" as="h2" meta="Shipped quantities only" />
        <Records
          caption={`Lines on ${invoice.code}`}
          rows={invoice.lines}
          cardTitle={(line) => getProduct(state, line.productId)?.sku ?? ''}
          cardSkip={['product']}
          columns={[
            {
              key: 'product',
              header: 'Product',
              cell: (line) => {
                const product = getProduct(state, line.productId);
                return product ? (
                  <a
                    href={paths.product(product.id)}
                    className="text-charcoal hover:text-copper transition-colors"
                  >
                    {product.sku} — {product.name}
                  </a>
                ) : (
                  <span className="text-muted">Unknown product</span>
                );
              },
            },
            {
              key: 'quantity',
              header: 'Quantity',
              width: 'w-24',
              align: 'right',
              cell: (line) => <Num>{line.quantity}</Num>,
            },
            {
              key: 'price',
              header: 'Unit price',
              width: 'w-28',
              align: 'right',
              hideBelow: 'md',
              cell: (line) => <Num tone="muted">{formatMoney(line.unitPrice)}</Num>,
            },
            {
              key: 'amount',
              header: 'Amount',
              width: 'w-28',
              align: 'right',
              cell: (line) => <Num>{formatMoney(line.quantity * line.unitPrice)}</Num>,
            },
          ]}
        />
        <div className="p-4 border-t border-app-border">
          <DocumentTotals
            lines={invoice.lines}
            discount={invoice.discount}
            taxBps={invoice.taxBps}
            freight={invoice.freight}
            editable={false}
          />
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Panel>
          <PanelHeader title="Bill to" as="h2" />
          <div className="p-4 space-y-3">
            <Detail label="Customer">
              {customer ? (
                <a href={paths.customer(customer.id)} className="text-copper hover:underline">
                  {customer.name}
                </a>
              ) : (
                '—'
              )}
            </Detail>
            <Detail label="Terms">{customer?.terms ?? '—'}</Detail>
            <Detail label="Due date">{formatDate(invoice.dueDate)}</Detail>
          </div>
        </Panel>

        <div className="lg:col-span-2">
          <Panel>
            <PanelHeader title="Payments" as="h2" meta={`${payments.length}`} />
            {payments.length === 0 ? (
              <EmptyState
                title="No payments recorded"
                description={
                  invoice.status === 'Sent'
                    ? DEMO_NOTICE
                    : 'Mark the invoice as sent before recording a payment.'
                }
              />
            ) : (
              <ul className="divide-y divide-app-border">
                {payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5"
                  >
                    <span className="text-[0.875rem] text-charcoal">
                      {payment.code}
                      <span className="ml-2 text-[0.75rem] text-muted">
                        {formatDate(payment.date)} · {payment.method}
                        {payment.reference ? ` · ${payment.reference}` : ''}
                      </span>
                    </span>
                    <Num>{formatMoney(payment.amount)}</Num>
                  </li>
                ))}
              </ul>
            )}
            <p className="flex items-start gap-2 border-t border-app-border px-4 py-2.5 text-[0.75rem] text-muted">
              <ShieldAlert size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
              {DEMO_NOTICE} Payments are recorded here after money is taken somewhere else.
            </p>
          </Panel>
        </div>
      </div>

      {invoice.status === 'Sent' && paymentOpen && (
        <PaymentForm open onClose={() => setPaymentOpen(false)} invoice={invoice} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- payments

export function PaymentsPage() {
  const state = useWorkspace();
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState(ALL);

  const rows = state.payments.filter((payment) => {
    if (method !== ALL && payment.method !== method) return false;
    return matches(
      query,
      payment.code,
      payment.reference,
      getCustomer(state, payment.customerId)?.name,
      state.invoices.find((invoice) => invoice.id === payment.invoiceId)?.code,
    );
  });

  const columns: Column<Payment>[] = [
    {
      key: 'payment',
      header: 'Payment',
      sortValue: (payment) => payment.code,
      cell: (payment) => (
        <>
          <span className="font-medium text-charcoal">{payment.code}</span>
          <span className="mt-0.5 block text-[0.75rem] text-muted">
            {getCustomer(state, payment.customerId)?.name}
          </span>
        </>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      width: 'w-32',
      sortValue: (payment) => payment.date,
      cell: (payment) => <span className="text-muted">{formatDate(payment.date)}</span>,
    },
    {
      key: 'invoice',
      header: 'Invoice',
      width: 'w-32',
      cell: (payment) => {
        const invoice = state.invoices.find((entry) => entry.id === payment.invoiceId);
        return invoice ? (
          <a href={paths.invoice(invoice.id)} className="text-charcoal hover:text-copper">
            {invoice.code}
          </a>
        ) : (
          <span className="text-muted">—</span>
        );
      },
    },
    {
      key: 'method',
      header: 'Method',
      width: 'w-28',
      hideBelow: 'md',
      sortValue: (payment) => payment.method,
      cell: (payment) => <span className="text-muted">{payment.method}</span>,
    },
    {
      key: 'reference',
      header: 'Reference',
      hideBelow: 'lg',
      cell: (payment) => <span className="text-muted">{payment.reference || '—'}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      width: 'w-28',
      align: 'right',
      sortValue: (payment) => payment.amount,
      cell: (payment) => <Num>{formatMoney(payment.amount)}</Num>,
    },
  ];

  const received = rows.reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payments"
        description="A record of money already taken elsewhere. Nothing on this screen moves funds."
      />

      <p className="flex items-start gap-2 border border-app-border bg-app-panel rounded-[3px] px-3.5 py-2.5 text-[0.8125rem] text-muted">
        <ShieldAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
        {DEMO_NOTICE} This workspace has no payment processor and never asks for card numbers or
        bank credentials.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Metric label="Payments recorded" value={state.payments.length} />
        <Metric label="Received this month" value={formatMoney(receivedThisMonth(state))} />
        <Metric
          label="Outstanding"
          value={formatMoney(outstandingReceivable(state))}
          href={paths.module('invoices')}
        />
      </div>

      <Panel>
        <Toolbar>
          <div className="w-full sm:w-64">
            <label htmlFor="payment-search" className="sr-only">
              Search payments
            </label>
            <TextInput
              id="payment-search"
              type="search"
              placeholder="Payment, customer, reference…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <InlineField label="Method" htmlFor="payment-method">
            <Select
              id="payment-method"
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All</option>
              {['ACH', 'Check', 'Card', 'Cash', 'Wire', 'Other'].map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </InlineField>

          {(query || method !== ALL) && (
            <Button
              size="sm"
              onClick={() => {
                setQuery('');
                setMethod(ALL);
              }}
            >
              Clear filters
            </Button>
          )}

          <span className="ml-auto text-[0.75rem] text-muted tabular-nums">
            {formatMoney(received)} across {rows.length}
          </span>
        </Toolbar>

        <Records
          caption="Payments"
          rows={rows}
          columns={columns}
          cardSkip={['payment']}
          cardTitle={(payment) => payment.code}
          defaultSort={{ key: 'date', direction: 'desc' }}
          empty={
            <EmptyState
              title="No payments match these filters."
              description="Payments are recorded from a sent invoice."
            />
          }
        />
      </Panel>
    </div>
  );
}
