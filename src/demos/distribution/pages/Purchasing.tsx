import { useMemo, useState } from 'react';
import { Plus, Printer } from 'lucide-react';
import { useCommand, useWorkspace } from '../DistributionProvider';
import { paths } from '../distribution.routes';
import type { Partner, PurchaseOrder, Receipt } from '../distribution.types';
import {
  awaitingReceipt,
  getSupplier,
  getWarehouse,
  poStatus,
  receivedQuantity,
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
  Tabs,
  TextInput,
  Toolbar,
} from '../../shared/ui/AppUI';
import { type Column } from '../../shared/ui/DataTable';
import { Num, Records } from '../components/DataViews';
import { PurchaseOrderStatusBadge } from '../components/StatusBadge';
import { DocumentTotals } from '../components/LineItemEditor';
import { PartnerForm } from '../forms/CatalogForms';
import { PurchaseOrderForm, ReceiptForm } from '../forms/PurchasingForms';

/**
 * Suppliers, purchase orders and receiving.
 *
 * The rule that shapes all three: ordering, submitting and approving move no
 * stock whatsoever. Inventory only changes when a receipt is posted, and only
 * by the quantity actually counted off the truck.
 */

const ALL = 'all';
const PO_STATUSES = ['Draft', 'Submitted', 'Approved', 'Partially Received', 'Received', 'Cancelled'];

// --------------------------------------------------------------- suppliers

export function SuppliersPage() {
  const state = useWorkspace();
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const rows = state.suppliers.filter((supplier) =>
    matches(query, supplier.name, supplier.code, supplier.contact, supplier.email),
  );

  const columns: Column<Partner>[] = [
    {
      key: 'supplier',
      header: 'Supplier',
      sortValue: (supplier) => supplier.name,
      cell: (supplier) => (
        <>
          <span className="font-medium text-charcoal">{supplier.name}</span>
          <span className="mt-0.5 block font-mono text-[0.75rem] text-muted">{supplier.code}</span>
        </>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      hideBelow: 'md',
      cell: (supplier) => (
        <>
          <span className="text-charcoal">{supplier.contact || '—'}</span>
          <span className="mt-0.5 block text-[0.75rem] text-muted">
            {supplier.phone ? formatPhone(supplier.phone) : ''}
          </span>
        </>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      width: 'w-40',
      hideBelow: 'lg',
      cell: (supplier) => (
        <span className="text-muted">
          {supplier.address.city}, {supplier.address.state}
        </span>
      ),
    },
    {
      key: 'lead',
      header: 'Lead time',
      width: 'w-28',
      align: 'right',
      sortValue: (supplier) => supplier.leadDays,
      cell: (supplier) => <Num tone="muted">{supplier.leadDays} days</Num>,
    },
    {
      key: 'orders',
      header: 'Open POs',
      width: 'w-24',
      align: 'right',
      sortValue: (supplier) =>
        state.purchaseOrders.filter(
          (po) => po.supplierId === supplier.id && poStatus(state, po) !== 'Received',
        ).length,
      cell: (supplier) => (
        <Num>
          {
            state.purchaseOrders.filter(
              (po) => po.supplierId === supplier.id && poStatus(state, po) !== 'Received',
            ).length
          }
        </Num>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Suppliers"
        description={`${state.suppliers.length} trading partners. Payment terms are informational.`}
        actions={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <Plus size={14} aria-hidden="true" />
            New supplier
          </Button>
        }
      />

      <Panel>
        <Toolbar>
          <div className="w-full sm:w-64">
            <label htmlFor="supplier-search" className="sr-only">
              Search suppliers
            </label>
            <TextInput
              id="supplier-search"
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
            {rows.length} of {state.suppliers.length}
          </span>
        </Toolbar>

        <Records
          caption="Suppliers"
          rows={rows}
          columns={columns}
          href={(supplier) => paths.supplier(supplier.id)}
          cardSkip={['supplier']}
          cardTitle={(supplier) => supplier.name}
          empty={
            <EmptyState
              title="No suppliers match this search."
              action={<Button onClick={() => setQuery('')}>Clear filters</Button>}
            />
          }
        />
      </Panel>

      {formOpen && <PartnerForm open onClose={() => setFormOpen(false)} kind="supplier" />}
    </div>
  );
}

export function SupplierDetail({ supplierId }: { supplierId: string }) {
  const state = useWorkspace();
  const [editOpen, setEditOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);

  const supplier = getSupplier(state, supplierId);

  if (!supplier) {
    return (
      <EmptyState
        title="That supplier is not in this workspace"
        action={<LinkButton href={paths.module('suppliers')}>Back to suppliers</LinkButton>}
      />
    );
  }

  const orders = state.purchaseOrders.filter((po) => po.supplierId === supplier.id);
  const products = state.products.filter((product) => product.supplierId === supplier.id);
  const receipts = state.receipts.filter((receipt) =>
    orders.some((po) => po.id === receipt.poId),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <a href={paths.module('suppliers')} className="hover:text-copper transition-colors">
            Suppliers
          </a>
        }
        title={supplier.name}
        description={
          <span className="text-muted">
            {supplier.code} · {supplier.terms} · {supplier.leadDays} day lead time
          </span>
        }
        actions={
          <>
            <Button onClick={() => setEditOpen(true)}>Edit</Button>
            <Button variant="primary" onClick={() => setOrderOpen(true)}>
              New purchase order
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Panel>
          <PanelHeader title="Details" as="h2" />
          <div className="p-4 grid grid-cols-2 gap-4">
            <Detail label="Contact">{supplier.contact || '—'}</Detail>
            <Detail label="Phone">{supplier.phone ? formatPhone(supplier.phone) : '—'}</Detail>
            <div className="col-span-2">
              <Detail label="Email">{supplier.email || '—'}</Detail>
            </div>
            <div className="col-span-2">
              <Detail label="Address">{formatAddress(supplier.address)}</Detail>
            </div>
            <Detail label="Status">{supplier.active ? 'Active' : 'Inactive'}</Detail>
            <Detail label="Products">{products.length}</Detail>
          </div>
        </Panel>

        <div className="lg:col-span-2 space-y-4">
          <Panel>
            <PanelHeader title="Purchase orders" as="h2" meta={`${orders.length}`} />
            <Records
              caption={`Purchase orders from ${supplier.name}`}
              rows={orders}
              href={(po) => paths.purchaseOrder(po.id)}
              cardTitle={(po) => po.code}
              cardSkip={['po']}
              columns={purchaseOrderColumns(state)}
              empty={<EmptyState title="No purchase orders yet" />}
            />
          </Panel>

          <Panel>
            <PanelHeader title="Goods received" as="h2" meta={`${receipts.length}`} />
            {receipts.length === 0 ? (
              <EmptyState title="Nothing received from this supplier yet" />
            ) : (
              <ul className="divide-y divide-app-border">
                {receipts.map((receipt) => (
                  <li key={receipt.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
                    <span className="text-[0.875rem] text-charcoal">{receipt.code}</span>
                    <span className="text-[0.75rem] text-muted">
                      {formatDate(receipt.date)} ·{' '}
                      {receipt.lines.reduce((sum, line) => sum + line.quantity, 0)} units
                    </span>
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
          kind="supplier"
          partner={supplier}
        />
      )}
      {orderOpen && <PurchaseOrderForm open onClose={() => setOrderOpen(false)} />}
    </div>
  );
}

// -------------------------------------------------------- purchase orders

function purchaseOrderColumns(state: ReturnType<typeof useWorkspace>): Column<PurchaseOrder>[] {
  return [
    {
      key: 'po',
      header: 'PO',
      sortValue: (po) => po.code,
      cell: (po) => (
        <>
          <span className="font-medium text-charcoal">{po.code}</span>
          <span className="mt-0.5 block text-[0.75rem] text-muted">
            {getSupplier(state, po.supplierId)?.name}
          </span>
        </>
      ),
    },
    {
      key: 'warehouse',
      header: 'Deliver to',
      width: 'w-32',
      hideBelow: 'lg',
      cell: (po) => <span className="text-muted">{getWarehouse(state, po.warehouseId)?.short}</span>,
    },
    {
      key: 'expected',
      header: 'Expected',
      width: 'w-32',
      hideBelow: 'sm',
      sortValue: (po) => po.expectedDate,
      cell: (po) => <span className="text-muted">{formatDate(po.expectedDate)}</span>,
    },
    {
      key: 'units',
      header: 'Received',
      width: 'w-32',
      align: 'right',
      sortValue: (po) =>
        po.lines.reduce((sum, line) => sum + receivedQuantity(state, po.id, line.id), 0),
      cell: (po) => {
        const ordered = po.lines.reduce((sum, line) => sum + line.quantity, 0);
        const received = po.lines.reduce(
          (sum, line) => sum + receivedQuantity(state, po.id, line.id),
          0,
        );
        return (
          <Num tone={received < ordered ? 'muted' : undefined}>
            {received} / {ordered}
          </Num>
        );
      },
    },
    {
      key: 'total',
      header: 'Total',
      width: 'w-28',
      align: 'right',
      sortValue: (po) => totals(po).total,
      cell: (po) => <Num>{formatMoney(totals(po).total)}</Num>,
    },
    {
      key: 'status',
      header: 'Status',
      width: 'w-40',
      sortValue: (po) => poStatus(state, po),
      cell: (po) => <PurchaseOrderStatusBadge status={poStatus(state, po)} />,
    },
  ];
}

export function PurchasingPage() {
  const state = useWorkspace();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);

  const rows = useMemo(
    () =>
      state.purchaseOrders.filter((po) => {
        if (status !== ALL && poStatus(state, po) !== status) return false;
        return matches(query, po.code, getSupplier(state, po.supplierId)?.name, po.notes);
      }),
    [state, query, status],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Purchasing"
        description="Ordering, submitting and approving move no stock. Only a posted receipt does."
        actions={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <Plus size={14} aria-hidden="true" />
            New purchase order
          </Button>
        }
      />

      <Panel>
        <Toolbar>
          <div className="w-full sm:w-64">
            <label htmlFor="po-search" className="sr-only">
              Search purchase orders
            </label>
            <TextInput
              id="po-search"
              type="search"
              placeholder="PO number, supplier…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <InlineField label="Status" htmlFor="po-status">
            <Select
              id="po-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All</option>
              {PO_STATUSES.map((entry) => (
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
            {rows.length} of {state.purchaseOrders.length}
          </span>
        </Toolbar>

        <Records
          caption="Purchase orders"
          rows={rows}
          columns={purchaseOrderColumns(state)}
          href={(po) => paths.purchaseOrder(po.id)}
          cardSkip={['po']}
          cardTitle={(po) => `${po.code} — ${getSupplier(state, po.supplierId)?.name ?? ''}`}
          defaultSort={{ key: 'expected', direction: 'asc' }}
          empty={
            <EmptyState
              title="No purchase orders match these filters."
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

      {formOpen && <PurchaseOrderForm open onClose={() => setFormOpen(false)} />}
    </div>
  );
}

export function PurchaseOrderDetail({ purchaseOrderId }: { purchaseOrderId: string }) {
  const state = useWorkspace();
  const run = useCommand();
  const [editOpen, setEditOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  const po = state.purchaseOrders.find((entry) => entry.id === purchaseOrderId);

  if (!po) {
    return (
      <EmptyState
        title="That purchase order is not in this workspace"
        action={<LinkButton href={paths.module('purchasing')}>Back to purchasing</LinkButton>}
      />
    );
  }

  const status = poStatus(state, po);
  const supplier = getSupplier(state, po.supplierId);
  const warehouse = getWarehouse(state, po.warehouseId);
  const receipts = state.receipts.filter((receipt) => receipt.poId === po.id);
  const outstanding = po.lines.reduce(
    (sum, line) => sum + Math.max(0, line.quantity - receivedQuantity(state, po.id, line.id)),
    0,
  );

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <a href={paths.module('purchasing')} className="hover:text-copper transition-colors">
            Purchasing
          </a>
        }
        title={po.code}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <PurchaseOrderStatusBadge status={status} />
            <span className="text-muted">
              {supplier?.name} · deliver to {warehouse?.name} · expected{' '}
              {formatDate(po.expectedDate)}
            </span>
          </span>
        }
        actions={
          <>
            <LinkButton href={paths.purchaseOrderPrint(po.id)}>
              <Printer size={14} aria-hidden="true" />
              Print
            </LinkButton>

            {po.status === 'Draft' && (
              <>
                <Button onClick={() => setEditOpen(true)}>Edit</Button>
                <Button
                  variant="primary"
                  onClick={() => run({ type: 'po/status', poId: po.id, status: 'Submitted' }, `${po.code} submitted.`)}
                >
                  Submit PO
                </Button>
              </>
            )}

            {po.status === 'Submitted' && (
              <Button
                variant="primary"
                onClick={() => run({ type: 'po/status', poId: po.id, status: 'Approved' }, `${po.code} approved.`)}
              >
                Approve PO
              </Button>
            )}

            {po.status === 'Approved' && outstanding > 0 && (
              <Button variant="primary" onClick={() => setReceiveOpen(true)}>
                Receive goods
              </Button>
            )}

            {po.status !== 'Cancelled' && status !== 'Received' && (
              <Button
                variant="danger"
                onClick={() => run({ type: 'po/status', poId: po.id, status: 'Cancelled' }, `${po.code} cancelled.`)}
              >
                Cancel
              </Button>
            )}
          </>
        }
      />

      {po.status === 'Cancelled' && receipts.length > 0 && (
        <p className="border border-app-border bg-app-panel rounded-[3px] px-3.5 py-2.5 text-[0.8125rem] text-muted">
          This order was cancelled after goods had already been received. Those receipts and their
          inventory movements stay posted — cancelling an order never erases stock that arrived.
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Ordered" value={po.lines.reduce((sum, line) => sum + line.quantity, 0)} meta="Units" />
        <Metric
          label="Received"
          value={po.lines.reduce((sum, line) => sum + receivedQuantity(state, po.id, line.id), 0)}
          meta="Units in stock"
        />
        <Metric
          label="Outstanding"
          value={outstanding}
          tone={outstanding > 0 ? 'warning' : 'default'}
          meta="Still due"
        />
        <Metric label="Order value" value={formatMoney(totals(po).total)} meta="Including freight" />
      </div>

      <Panel>
        <PanelHeader title="Lines" as="h2" />
        <Records
          caption={`Lines on ${po.code}`}
          rows={po.lines.map((line) => ({ ...line, id: line.id }))}
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
              key: 'received',
              header: 'Received',
              width: 'w-24',
              align: 'right',
              cell: (line) => <Num>{receivedQuantity(state, po.id, line.id)}</Num>,
            },
            {
              key: 'outstanding',
              header: 'Outstanding',
              width: 'w-28',
              align: 'right',
              cell: (line) => {
                const remaining = line.quantity - receivedQuantity(state, po.id, line.id);
                return <Num tone={remaining > 0 ? 'danger' : 'muted'}>{remaining}</Num>;
              },
            },
            {
              key: 'unit',
              header: 'Unit cost',
              width: 'w-28',
              align: 'right',
              hideBelow: 'sm',
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
            lines={po.lines}
            discount={po.discount}
            taxBps={po.taxBps}
            freight={po.freight}
            editable={false}
          />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Receipts" as="h2" meta={`${receipts.length}`} />
        {receipts.length === 0 ? (
          <EmptyState
            title="Nothing received yet"
            description="Posting a receipt is the only thing that turns this order into stock."
          />
        ) : (
          <ul className="divide-y divide-app-border">
            {receipts.map((receipt) => (
              <li key={receipt.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[0.9375rem] text-charcoal">{receipt.code}</span>
                  <span className="text-[0.75rem] text-muted">
                    {formatDate(receipt.date)}
                    {receipt.reference && ` · ${receipt.reference}`}
                  </span>
                </div>
                <ul className="mt-1 space-y-0.5">
                  {receipt.lines.map((line) => {
                    const ordered = po.lines.find((entry) => entry.id === line.lineId);
                    const product = state.products.find((entry) => entry.id === ordered?.productId);
                    return (
                      <li key={line.lineId} className="text-[0.8125rem] text-muted">
                        {product?.sku} — <Num>{line.quantity}</Num> units
                      </li>
                    );
                  })}
                </ul>
                {receipt.notes && (
                  <p className="mt-1 text-[0.75rem] text-muted">{receipt.notes}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {po.notes && (
        <Panel>
          <PanelHeader title="Notes" as="h2" />
          <p className="p-4 text-[0.875rem] text-charcoal">{po.notes}</p>
        </Panel>
      )}

      {editOpen && (
        <PurchaseOrderForm
          open
          onClose={() => setEditOpen(false)}
          purchaseOrder={po}
        />
      )}
      {receiveOpen && (
        <ReceiptForm
          open
          onClose={() => setReceiveOpen(false)}
          purchaseOrderId={po.id}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------- receiving

/**
 * The receiving queue.
 *
 * Built for somebody standing at a dock door: the approved orders with
 * something still outstanding, biggest first, each one click from the count
 * screen.
 */
export function ReceivingPage() {
  const state = useWorkspace();
  const [tab, setTab] = useState('queue');
  const [receiving, setReceiving] = useState<string | null>(null);

  const queue = awaitingReceipt(state);
  const receipts = state.receipts.slice().sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Receiving"
        description="Count what arrived. Only the quantities entered here become stock."
      />

      <Panel>
        <Tabs
          tabs={[
            { id: 'queue', label: 'Awaiting receipt', count: queue.length },
            { id: 'posted', label: 'Posted receipts', count: receipts.length },
          ]}
          active={tab}
          onChange={setTab}
          label="Receiving views"
        />

        {tab === 'queue' &&
          (queue.length === 0 ? (
            <EmptyState
              title="Nothing is awaiting receipt"
              description="Approved purchase orders with outstanding quantities appear here."
            />
          ) : (
            <ul className="divide-y divide-app-border">
              {queue.map((po) => {
                const outstanding = po.lines.reduce(
                  (sum, line) => sum + Math.max(0, line.quantity - receivedQuantity(state, po.id, line.id)),
                  0,
                );
                return (
                  <li key={po.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <a
                          href={paths.purchaseOrder(po.id)}
                          className="text-[0.9375rem] text-charcoal hover:text-copper transition-colors"
                        >
                          {po.code}
                        </a>
                        <p className="mt-0.5 text-[0.8125rem] text-muted">
                          {getSupplier(state, po.supplierId)?.name} ·{' '}
                          {getWarehouse(state, po.warehouseId)?.name}
                        </p>
                        <p className="mt-0.5 text-[0.75rem] text-muted">
                          Expected {formatDate(po.expectedDate)} · <Num>{outstanding}</Num> units
                          outstanding
                        </p>
                      </div>
                      {/* The queue repeats this control per order, so the
                          accessible name carries the order it belongs to. */}
                      <Button
                        variant="primary"
                        size="sm"
                        aria-label={`Receive goods for ${po.code}`}
                        onClick={() => setReceiving(po.id)}
                      >
                        Receive goods
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ))}

        {tab === 'posted' && (
          <Records
            caption="Posted receipts"
            rows={receipts}
            cardTitle={(receipt) => receipt.code}
            cardSkip={['receipt']}
            columns={receiptColumns(state)}
            empty={<EmptyState title="No receipts posted yet" />}
          />
        )}
      </Panel>

      {receiving && (
        <ReceiptForm
          open
          onClose={() => setReceiving(null)}
          purchaseOrderId={receiving}
        />
      )}
    </div>
  );
}

function receiptColumns(state: ReturnType<typeof useWorkspace>): Column<Receipt>[] {
  return [
    {
      key: 'receipt',
      header: 'Receipt',
      sortValue: (receipt) => receipt.code,
      cell: (receipt) => {
        const po = state.purchaseOrders.find((entry) => entry.id === receipt.poId);
        return (
          <>
            <span className="font-medium text-charcoal">{receipt.code}</span>
            <span className="mt-0.5 block text-[0.75rem] text-muted">{po?.code}</span>
          </>
        );
      },
    },
    {
      key: 'date',
      header: 'Date',
      width: 'w-32',
      sortValue: (receipt) => receipt.date,
      cell: (receipt) => <span className="text-muted">{formatDate(receipt.date)}</span>,
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      width: 'w-32',
      hideBelow: 'md',
      cell: (receipt) => (
        <span className="text-muted">{getWarehouse(state, receipt.warehouseId)?.short}</span>
      ),
    },
    {
      key: 'units',
      header: 'Units',
      width: 'w-24',
      align: 'right',
      sortValue: (receipt) => receipt.lines.reduce((sum, line) => sum + line.quantity, 0),
      cell: (receipt) => <Num>{receipt.lines.reduce((sum, line) => sum + line.quantity, 0)}</Num>,
    },
    {
      key: 'reference',
      header: 'Packing slip',
      hideBelow: 'lg',
      cell: (receipt) => <span className="text-muted">{receipt.reference || '—'}</span>,
    },
  ];
}
