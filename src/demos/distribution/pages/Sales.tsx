import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useCommand, useWorkspace } from '../DistributionProvider';
import { paths } from '../distribution.routes';
import type { Partner, SalesOrder } from '../distribution.types';
import {
  backorderQuantity,
  getCustomer,
  getWarehouse,
  invoiceBalance,
  invoiceStatus,
  lineAllocation,
  orderAllocations,
  orderShipments,
  orderStatus,
  shippedQuantity,
  stock,
} from '../distribution.selectors';
import {
  formatAddress,
  formatDate,
  formatMoney,
  formatPhone,
  matches,
  totals,
} from '../distribution.utils';
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
import { InvoiceStatusBadge, OrderStatusBadge } from '../components/StatusBadge';
import { DocumentTotals } from '../components/LineItemEditor';
import { PartnerForm } from '../forms/CatalogForms';
import { SalesOrderForm, ShipmentForm } from '../forms/SalesForms';
import { InvoiceForm } from '../forms/FinanceForms';

/**
 * Customers and sales orders.
 *
 * The order screen keeps fulfillment and money visibly separate, because they
 * are: an order can be fully shipped and unpaid, or paid and unshipped, and
 * conflating the two is the classic way a distribution system starts lying.
 */

const ALL = 'all';
const ORDER_STATUSES = [
  'Draft',
  'Confirmed',
  'Partially Allocated',
  'Allocated',
  'Picking',
  'Ready to Ship',
  'Partially Shipped',
  'Shipped',
  'Cancelled',
];

// --------------------------------------------------------------- customers

export function CustomersPage() {
  const state = useWorkspace();
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const rows = state.customers.filter((customer) =>
    matches(query, customer.name, customer.code, customer.contact, customer.email),
  );

  const columns: Column<Partner>[] = [
    {
      key: 'customer',
      header: 'Customer',
      sortValue: (customer) => customer.name,
      cell: (customer) => (
        <>
          <span className="font-medium text-charcoal">{customer.name}</span>
          <span className="mt-0.5 block font-mono text-[0.75rem] text-muted">{customer.code}</span>
        </>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      hideBelow: 'md',
      cell: (customer) => (
        <>
          <span className="text-charcoal">{customer.contact || '—'}</span>
          <span className="mt-0.5 block text-[0.75rem] text-muted">
            {customer.phone ? formatPhone(customer.phone) : ''}
          </span>
        </>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      width: 'w-40',
      hideBelow: 'lg',
      cell: (customer) => (
        <span className="text-muted">
          {customer.address.city}, {customer.address.state}
        </span>
      ),
    },
    {
      key: 'orders',
      header: 'Open orders',
      width: 'w-28',
      align: 'right',
      sortValue: (customer) =>
        state.orders.filter(
          (order) => order.customerId === customer.id && orderStatus(state, order) !== 'Shipped',
        ).length,
      cell: (customer) => (
        <Num>
          {
            state.orders.filter(
              (order) => order.customerId === customer.id && orderStatus(state, order) !== 'Shipped',
            ).length
          }
        </Num>
      ),
    },
    {
      key: 'balance',
      header: 'Open balance',
      width: 'w-32',
      align: 'right',
      sortValue: (customer) => customerBalance(state, customer.id),
      cell: (customer) => {
        const balance = customerBalance(state, customer.id);
        return <Num tone={balance > 0 ? undefined : 'muted'}>{formatMoney(balance)}</Num>;
      },
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        description={`${state.customers.length} accounts. Payment terms are informational.`}
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
              placeholder="Name, code, contact…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {query && (
            <Button size="sm" onClick={() => setQuery('')}>
              Clear filters
            </Button>
          )}
          <span className="ml-auto text-[0.75rem] text-muted tabular-nums">
            {rows.length} of {state.customers.length}
          </span>
        </Toolbar>

        <Records
          caption="Customers"
          rows={rows}
          columns={columns}
          href={(customer) => paths.customer(customer.id)}
          cardSkip={['customer']}
          cardTitle={(customer) => customer.name}
          empty={
            <EmptyState
              title="No customers match this search."
              action={<Button onClick={() => setQuery('')}>Clear filters</Button>}
            />
          }
        />
      </Panel>

      {formOpen && <PartnerForm open onClose={() => setFormOpen(false)} kind="customer" />}
    </div>
  );
}

const customerBalance = (state: ReturnType<typeof useWorkspace>, customerId: string) =>
  state.invoices
    .filter((invoice) => invoice.customerId === customerId && invoice.status !== 'Void')
    .reduce((sum, invoice) => sum + Math.max(0, invoiceBalance(state, invoice)), 0);

export function CustomerDetail({ customerId }: { customerId: string }) {
  const state = useWorkspace();
  const [editOpen, setEditOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);

  const customer = getCustomer(state, customerId);

  if (!customer) {
    return (
      <EmptyState
        title="That customer is not in this workspace"
        action={<LinkButton href={paths.module('customers')}>Back to customers</LinkButton>}
      />
    );
  }

  const orders = state.orders.filter((order) => order.customerId === customer.id);
  const invoices = state.invoices.filter((invoice) => invoice.customerId === customer.id);
  const payments = state.payments.filter((payment) => payment.customerId === customer.id);
  const shipments = state.shipments.filter((shipment) =>
    orders.some((order) => order.id === shipment.orderId),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <a href={paths.module('customers')} className="hover:text-copper transition-colors">
            Customers
          </a>
        }
        title={customer.name}
        description={<span className="text-muted">{customer.code} · {customer.terms}</span>}
        actions={
          <>
            <Button onClick={() => setEditOpen(true)}>Edit</Button>
            <Button variant="primary" onClick={() => setOrderOpen(true)}>
              New sales order
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Orders" value={orders.length} />
        <Metric label="Shipments" value={shipments.length} />
        <Metric
          label="Open balance"
          value={formatMoney(customerBalance(state, customer.id))}
          meta={`${invoices.length} invoices`}
        />
        <Metric
          label="Received"
          value={formatMoney(payments.reduce((sum, payment) => sum + payment.amount, 0))}
          meta={`${payments.length} payments`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Panel>
          <PanelHeader title="Details" as="h2" />
          <div className="p-4 grid grid-cols-2 gap-4">
            <Detail label="Contact">{customer.contact || '—'}</Detail>
            <Detail label="Phone">{customer.phone ? formatPhone(customer.phone) : '—'}</Detail>
            <div className="col-span-2">
              <Detail label="Email">{customer.email || '—'}</Detail>
            </div>
            <div className="col-span-2">
              <Detail label="Billing address">{formatAddress(customer.address)}</Detail>
            </div>
            {customer.shippingAddress && (
              <div className="col-span-2">
                <Detail label="Shipping address">{formatAddress(customer.shippingAddress)}</Detail>
              </div>
            )}
            <Detail label="Status">{customer.active ? 'Active' : 'Inactive'}</Detail>
          </div>
        </Panel>

        <div className="lg:col-span-2 space-y-4">
          <Panel>
            <PanelHeader title="Sales orders" as="h2" meta={`${orders.length}`} />
            <Records
              caption={`Sales orders for ${customer.name}`}
              rows={orders}
              href={(order) => paths.order(order.id)}
              cardTitle={(order) => order.code}
              cardSkip={['order']}
              columns={salesOrderColumns(state)}
              empty={<EmptyState title="No orders yet" />}
            />
          </Panel>

          <Panel>
            <PanelHeader title="Invoices and payments" as="h2" />
            {invoices.length === 0 ? (
              <EmptyState title="No invoices yet" />
            ) : (
              <ul className="divide-y divide-app-border">
                {invoices.map((invoice) => (
                  <li key={invoice.id}>
                    <a
                      href={paths.invoice(invoice.id)}
                      className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-app-bg"
                    >
                      <span className="text-[0.875rem] text-charcoal">
                        {invoice.code}
                        <span className="ml-2 text-[0.75rem] text-muted">
                          {formatDate(invoice.date)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <InvoiceStatusBadge status={invoiceStatus(state, invoice)} />
                        <Num>{formatMoney(invoiceBalance(state, invoice))}</Num>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {editOpen && (
        <PartnerForm
          open
          onClose={() => setEditOpen(false)}
          kind="customer"
          partner={customer}
        />
      )}
      {orderOpen && (
        <SalesOrderForm
          open
          onClose={() => setOrderOpen(false)}
          customerId={customer.id}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------ sales orders

function salesOrderColumns(state: ReturnType<typeof useWorkspace>): Column<SalesOrder>[] {
  return [
    {
      key: 'order',
      header: 'Order',
      sortValue: (order) => order.code,
      cell: (order) => (
        <>
          <span className="font-medium text-charcoal">{order.code}</span>
          <span className="mt-0.5 block text-[0.75rem] text-muted">
            {getCustomer(state, order.customerId)?.name}
          </span>
        </>
      ),
    },
    {
      key: 'warehouse',
      header: 'Ship from',
      width: 'w-28',
      hideBelow: 'lg',
      cell: (order) => (
        <span className="text-muted">{getWarehouse(state, order.warehouseId)?.short}</span>
      ),
    },
    {
      key: 'requested',
      header: 'Requested',
      width: 'w-32',
      hideBelow: 'sm',
      sortValue: (order) => order.requestedDate,
      cell: (order) => <span className="text-muted">{formatDate(order.requestedDate)}</span>,
    },
    {
      key: 'shipped',
      header: 'Shipped',
      width: 'w-28',
      align: 'right',
      sortValue: (order) =>
        order.lines.reduce((sum, line) => sum + shippedQuantity(state, order.id, line.id), 0),
      cell: (order) => {
        const ordered = order.lines.reduce((sum, line) => sum + line.quantity, 0);
        const shipped = order.lines.reduce(
          (sum, line) => sum + shippedQuantity(state, order.id, line.id),
          0,
        );
        return (
          <Num tone={shipped < ordered ? 'muted' : undefined}>
            {shipped} / {ordered}
          </Num>
        );
      },
    },
    {
      key: 'total',
      header: 'Total',
      width: 'w-28',
      align: 'right',
      sortValue: (order) => totals(order).total,
      cell: (order) => <Num>{formatMoney(totals(order).total)}</Num>,
    },
    {
      key: 'status',
      header: 'Fulfillment',
      width: 'w-40',
      sortValue: (order) => orderStatus(state, order),
      cell: (order) => <OrderStatusBadge status={orderStatus(state, order)} />,
    },
  ];
}

export function OrdersPage() {
  const state = useWorkspace();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);

  const rows = useMemo(
    () =>
      state.orders.filter((order) => {
        if (status !== ALL && orderStatus(state, order) !== status) return false;
        return matches(query, order.code, getCustomer(state, order.customerId)?.name, order.notes);
      }),
    [state, query, status],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sales Orders"
        description="Fulfillment state and payment state are tracked independently."
        actions={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <Plus size={14} aria-hidden="true" />
            New sales order
          </Button>
        }
      />

      <Panel>
        <Toolbar>
          <div className="w-full sm:w-64">
            <label htmlFor="order-search" className="sr-only">
              Search sales orders
            </label>
            <TextInput
              id="order-search"
              type="search"
              placeholder="Order number, customer…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <InlineField label="Status" htmlFor="order-status">
            <Select
              id="order-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All</option>
              {ORDER_STATUSES.map((entry) => (
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
            {rows.length} of {state.orders.length}
          </span>
        </Toolbar>

        <Records
          caption="Sales orders"
          rows={rows}
          columns={salesOrderColumns(state)}
          href={(order) => paths.order(order.id)}
          cardSkip={['order']}
          cardTitle={(order) => `${order.code} — ${getCustomer(state, order.customerId)?.name ?? ''}`}
          defaultSort={{ key: 'requested', direction: 'asc' }}
          empty={
            <EmptyState
              title="No sales orders match these filters."
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

      {formOpen && <SalesOrderForm open onClose={() => setFormOpen(false)} />}
    </div>
  );
}

export function OrderDetail({ orderId }: { orderId: string }) {
  const state = useWorkspace();
  const run = useCommand();
  const [editOpen, setEditOpen] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  const order = state.orders.find((entry) => entry.id === orderId);

  if (!order) {
    return (
      <EmptyState
        title="That sales order is not in this workspace"
        action={<LinkButton href={paths.module('orders')}>Back to sales orders</LinkButton>}
      />
    );
  }

  const status = orderStatus(state, order);
  const customer = getCustomer(state, order.customerId);
  const warehouse = getWarehouse(state, order.warehouseId);
  const allocations = orderAllocations(state, order.id);
  const shipments = orderShipments(state, order.id);
  const invoice = state.invoices.find(
    (entry) => entry.orderId === order.id && entry.status !== 'Void',
  );
  const backorder = backorderQuantity(state, order);

  const packed = allocations.reduce((sum, row) => sum + row.packed, 0);
  const canInvoice = status === 'Shipped' || (order.status === 'Cancelled' && shipments.length > 0);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <a href={paths.module('orders')} className="hover:text-copper transition-colors">
            Sales Orders
          </a>
        }
        title={order.code}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={status} />
            {invoice && <InvoiceStatusBadge status={invoiceStatus(state, invoice)} />}
            <span className="text-muted">
              {customer?.name} · ship from {warehouse?.name} · requested{' '}
              {formatDate(order.requestedDate)}
            </span>
          </span>
        }
        actions={
          <>
            {order.status === 'Draft' && (
              <>
                <Button onClick={() => setEditOpen(true)}>Edit</Button>
                <Button
                  variant="primary"
                  onClick={() => run({ type: 'order/confirm', orderId: order.id }, `${order.code} confirmed.`)}
                >
                  Confirm order
                </Button>
              </>
            )}

            {order.status === 'Confirmed' && status !== 'Shipped' && (
              <LinkButton href={paths.module('fulfillment')}>Fulfillment</LinkButton>
            )}

            {order.status === 'Confirmed' && packed > 0 && (
              <Button variant="primary" onClick={() => setShipOpen(true)}>
                Post shipment
              </Button>
            )}

            {canInvoice && !invoice && (
              <Button variant="primary" onClick={() => setInvoiceOpen(true)}>
                Create invoice
              </Button>
            )}

            {invoice && <LinkButton href={paths.invoice(invoice.id)}>{invoice.code}</LinkButton>}

            {order.status !== 'Cancelled' && status !== 'Shipped' && (
              <Button
                variant="danger"
                onClick={() =>
                  run(
                    { type: 'order/cancel', orderId: order.id },
                    `${order.code} cancelled. Unshipped allocations released.`,
                  )
                }
              >
                Cancel
              </Button>
            )}
          </>
        }
      />

      {order.status === 'Cancelled' && shipments.length > 0 && (
        <p className="border border-app-border bg-app-panel rounded-[3px] px-3.5 py-2.5 text-[0.8125rem] text-muted">
          This order was cancelled after part of it had shipped. Those shipments stay posted and
          can still be invoiced; only the unshipped allocation was released.
        </p>
      )}

      {backorder > 0 && order.status === 'Confirmed' && (
        <p className="border border-app-warning/40 bg-app-warning/[0.06] rounded-[3px] px-3.5 py-2.5 text-[0.8125rem] text-charcoal">
          <Num>{backorder}</Num> units are on backorder — there is not enough available stock at{' '}
          {warehouse?.name} to reserve them. Allocate them once goods arrive.
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Ordered" value={order.lines.reduce((sum, line) => sum + line.quantity, 0)} meta="Units" />
        <Metric
          label="Allocated"
          value={allocations.reduce((sum, row) => sum + row.quantity, 0)}
          meta="Reserved, still on hand"
        />
        <Metric
          label="Shipped"
          value={order.lines.reduce((sum, line) => sum + shippedQuantity(state, order.id, line.id), 0)}
          meta="Left the warehouse"
        />
        <Metric label="Order value" value={formatMoney(totals(order).total)} />
      </div>

      <Panel>
        <PanelHeader title="Lines" as="h2" />
        <Records
          caption={`Lines on ${order.code}`}
          rows={order.lines}
          cardTitle={(line) => state.products.find((p) => p.id === line.productId)?.sku ?? ''}
          cardSkip={['product']}
          columns={[
            {
              key: 'product',
              header: 'Product',
              cell: (line) => {
                const product = state.products.find((entry) => entry.id === line.productId);
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
              key: 'ordered',
              header: 'Ordered',
              width: 'w-24',
              align: 'right',
              cell: (line) => <Num>{line.quantity}</Num>,
            },
            {
              key: 'allocated',
              header: 'Allocated',
              width: 'w-24',
              align: 'right',
              cell: (line) => (
                <Num tone="muted">{lineAllocation(state, order.id, line.id)?.quantity ?? 0}</Num>
              ),
            },
            {
              key: 'shipped',
              header: 'Shipped',
              width: 'w-24',
              align: 'right',
              cell: (line) => <Num>{shippedQuantity(state, order.id, line.id)}</Num>,
            },
            {
              key: 'available',
              header: 'Available',
              width: 'w-24',
              align: 'right',
              hideBelow: 'lg',
              cell: (line) => {
                const position = stock(state, line.productId, order.warehouseId);
                return (
                  <Num tone={position.available <= 0 ? 'danger' : 'muted'}>{position.available}</Num>
                );
              },
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
            lines={order.lines}
            discount={order.discount}
            taxBps={order.taxBps}
            freight={order.freight}
            editable={false}
          />
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel>
          <PanelHeader title="Shipments" as="h2" meta={`${shipments.length}`} />
          {shipments.length === 0 ? (
            <EmptyState title="Nothing shipped yet" />
          ) : (
            <ul className="divide-y divide-app-border">
              {shipments.map((shipment) => (
                <li key={shipment.id}>
                  <a
                    href={paths.shipment(shipment.id)}
                    className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-app-bg"
                  >
                    <span className="text-[0.875rem] text-charcoal">{shipment.code}</span>
                    <span className="text-[0.75rem] text-muted">
                      {formatDate(shipment.date)} · {shipment.carrier} ·{' '}
                      {shipment.lines.reduce((sum, line) => sum + line.quantity, 0)} units
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Shipping and notes" as="h2" />
          <div className="p-4 space-y-3">
            <Detail label="Ship to">{order.shippingAddress}</Detail>
            <Detail label="Order date">{formatDate(order.date)}</Detail>
            {order.notes && <Detail label="Notes">{order.notes}</Detail>}
          </div>
        </Panel>
      </div>

      {editOpen && <SalesOrderForm open onClose={() => setEditOpen(false)} order={order} />}
      {shipOpen && <ShipmentForm open onClose={() => setShipOpen(false)} orderId={order.id} />}
      {invoiceOpen && <InvoiceForm open onClose={() => setInvoiceOpen(false)} orderId={order.id} />}
    </div>
  );
}
