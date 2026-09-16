import { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { track } from '../../../lib/analytics';
import { useCommand, useWorkspace } from '../DistributionProvider';
import { paths } from '../distribution.routes';
import type { SalesOrder, Shipment } from '../distribution.types';
import {
  awaitingAllocation,
  backorderQuantity,
  unallocatedQuantity,
  getCustomer,
  getOrder,
  getProduct,
  getWarehouse,
  lineAllocation,
  openOrders,
  orderAllocations,
  orderStatus,
  shippedQuantity,
  stock,
} from '../distribution.selectors';
import { returnedQuantity } from '../domain/logistics';
import { formatDate, formatMoney, matches, pluralize } from '../distribution.utils';
import {
  Button,
  Detail,
  EmptyState,
  LinkButton,
  Metric,
  PageHeader,
  Panel,
  PanelHeader,
  ProgressBar,
  TextInput,
  Toolbar,
} from '../../shared/ui/AppUI';
import { type Column } from '../../shared/ui/DataTable';
import { Num, Records } from '../components/DataViews';
import { OrderStatusBadge } from '../components/StatusBadge';
import { ShipmentForm } from '../forms/SalesForms';
import { ReturnForm } from '../forms/LogisticsForms';

/**
 * The warehouse floor: allocate, pick, pack, ship.
 *
 * Each step is deliberately separate. Allocation reserves stock without moving
 * it, picking and packing are progress markers on that reservation, and only
 * the shipment posts a movement. That is why an order can be "Ready to Ship"
 * while the ledger has not changed at all.
 */

export function FulfillmentPage() {
  const state = useWorkspace();
  const [query, setQuery] = useState('');
  const [shipFor, setShipFor] = useState<string | null>(null);

  // Only released work reaches the floor. A draft is still being written, so
  // offering to allocate against it would be an action that can only fail.
  const queue = useMemo(
    () =>
      openOrders(state)
        .filter((order) => order.status === 'Confirmed')
        .filter((order) => matches(query, order.code, getCustomer(state, order.customerId)?.name)),
    [state, query],
  );

  const toAllocate = awaitingAllocation(state);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fulfillment"
        description="Allocate reserves stock. Picking and packing track progress. Only shipping moves inventory."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Open orders" value={queue.length} meta="Confirmed, not fully shipped" />
        <Metric
          label="Awaiting allocation"
          value={toAllocate.length}
          tone={toAllocate.length > 0 ? 'warning' : 'default'}
        />
        <Metric
          label="Units allocated"
          value={state.allocations.reduce((sum, row) => sum + row.quantity, 0)}
          meta="Reserved, still on hand"
        />
        <Metric
          label="Units packed"
          value={state.allocations.reduce((sum, row) => sum + row.packed, 0)}
          meta="Ready to leave"
        />
      </div>

      <Panel>
        <Toolbar>
          <div className="w-full sm:w-64">
            <label htmlFor="fulfillment-search" className="sr-only">
              Search the fulfillment queue
            </label>
            <TextInput
              id="fulfillment-search"
              type="search"
              placeholder="Order number, customer…"
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
            {pluralize(queue.length, 'order')}
          </span>
        </Toolbar>

        {queue.length === 0 ? (
          <EmptyState
            title="Nothing in the fulfillment queue"
            description="Confirm a sales order and it will appear here."
            action={<LinkButton href={paths.module('orders')}>Sales orders</LinkButton>}
          />
        ) : (
          <ul className="divide-y divide-app-border">
            {queue.map((order) => (
              <li key={order.id} className="p-4">
                <FulfillmentCard order={order} onShip={() => setShipFor(order.id)} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {shipFor && <ShipmentForm open onClose={() => setShipFor(null)} orderId={shipFor} />}
    </div>
  );
}

/**
 * One order in the queue.
 *
 * The three buttons are enabled by what has actually happened, not by a stored
 * stage, so the card cannot offer to pick something that was never allocated.
 */
function FulfillmentCard({ order, onShip }: { order: SalesOrder; onShip: () => void }) {
  const state = useWorkspace();
  const run = useCommand();

  const allocations = orderAllocations(state, order.id);
  const ordered = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const shipped = order.lines.reduce(
    (sum, line) => sum + shippedQuantity(state, order.id, line.id),
    0,
  );
  const allocated = allocations.reduce((sum, row) => sum + row.quantity, 0);
  const picked = allocations.reduce((sum, row) => sum + row.picked, 0);
  const packed = allocations.reduce((sum, row) => sum + row.packed, 0);
  // Two different numbers, deliberately: what is still to reserve, and the
  // part of it the warehouse genuinely cannot cover.
  const pending = unallocatedQuantity(state, order);
  const backorder = backorderQuantity(state, order);

  const customer = getCustomer(state, order.customerId);
  const warehouse = getWarehouse(state, order.warehouseId);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={paths.order(order.id)}
            className="text-[0.9375rem] font-medium text-charcoal hover:text-copper transition-colors"
          >
            {order.code}
          </a>
          <p className="mt-0.5 text-[0.8125rem] text-muted">
            {customer?.name} · {warehouse?.short} · requested {formatDate(order.requestedDate)}
          </p>
        </div>
        <OrderStatusBadge status={orderStatus(state, order)} />
      </div>

      <div className="mt-3">
        <ProgressBar
          value={ordered === 0 ? 0 : Math.round(((shipped + packed) / ordered) * 100)}
          label={`${shipped} shipped · ${packed} packed · ${picked} picked · ${allocated} allocated of ${ordered}`}
        />
      </div>

      {backorder > 0 ? (
        <p className="mt-2 text-[0.8125rem] text-muted">
          <Num>{backorder}</Num> of the {pending} outstanding units cannot be allocated — there is
          not enough available stock at {warehouse?.name}. They stay on backorder until goods
          arrive.
        </p>
      ) : (
        pending > 0 && (
          <p className="mt-2 text-[0.8125rem] text-muted">
            <Num>{pending}</Num> units are waiting to be allocated. There is enough available stock
            at {warehouse?.name} to cover them.
          </p>
        )
      )}

      <ul className="mt-3 space-y-1">
        {order.lines.map((line) => {
          const allocation = lineAllocation(state, order.id, line.id);
          const position = stock(state, line.productId, order.warehouseId);
          const lineShipped = shippedQuantity(state, order.id, line.id);
          const outstanding = line.quantity - lineShipped - (allocation?.quantity ?? 0);
          const shortfall = Math.max(0, outstanding - position.available);
          const product = getProduct(state, line.productId);
          return (
            <li
              key={line.id}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[0.8125rem]"
            >
              <span className="text-charcoal">
                {product?.sku} — {product?.name}
              </span>
              <span className="flex flex-wrap items-baseline gap-x-3 text-muted">
                <span className="tabular-nums">{line.quantity} ordered</span>
                <span className="tabular-nums">{allocation?.quantity ?? 0} allocated</span>
                <span className="tabular-nums">{lineShipped} shipped</span>
                {shortfall > 0 ? (
                  <span className="tabular-nums text-app-warning">
                    {shortfall} short ({position.available} available)
                  </span>
                ) : (
                  outstanding > 0 && (
                    <span className="tabular-nums">
                      {outstanding} to allocate ({position.available} available)
                    </span>
                  )
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        {/* The queue stacks one card per order, so every action here repeats.
            Naming each one after its order is what makes the page navigable by
            screen reader, where the visual grouping does not exist. */}
        <Button
          size="sm"
          disabled={pending === 0}
          aria-label={`Allocate stock for ${order.code}`}
          onClick={() => {
            const failure = run(
              { type: 'order/allocate', orderId: order.id },
              `Stock allocated to ${order.code}. Available quantities dropped; nothing moved yet.`,
            );
            if (!failure) track('stock_allocated');
          }}
        >
          Allocate stock
        </Button>
        <Button
          size="sm"
          disabled={allocated === 0 || picked >= allocated}
          aria-label={`Mark ${order.code} picked`}
          onClick={() => run({ type: 'order/pick', orderId: order.id }, `${order.code} picked.`)}
        >
          Mark picked
        </Button>
        <Button
          size="sm"
          disabled={picked === 0 || packed >= picked}
          aria-label={`Mark ${order.code} packed`}
          onClick={() => run({ type: 'order/pack', orderId: order.id }, `${order.code} packed.`)}
        >
          Mark packed
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={packed === 0}
          aria-label={`Post shipment for ${order.code}`}
          onClick={onShip}
        >
          Post shipment
        </Button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- shipments

export function ShipmentsPage() {
  const state = useWorkspace();
  const [query, setQuery] = useState('');

  const rows = state.shipments.filter((shipment) =>
    matches(
      query,
      shipment.code,
      shipment.carrier,
      getOrder(state, shipment.orderId)?.code,
      getCustomer(state, getOrder(state, shipment.orderId)?.customerId)?.name,
    ),
  );

  const columns: Column<Shipment>[] = [
    {
      key: 'shipment',
      header: 'Shipment',
      sortValue: (shipment) => shipment.code,
      cell: (shipment) => {
        const order = getOrder(state, shipment.orderId);
        return (
          <>
            <span className="font-medium text-charcoal">{shipment.code}</span>
            <span className="mt-0.5 block text-[0.75rem] text-muted">
              {order?.code} · {getCustomer(state, order?.customerId)?.name}
            </span>
          </>
        );
      },
    },
    {
      key: 'date',
      header: 'Shipped',
      width: 'w-32',
      sortValue: (shipment) => shipment.date,
      cell: (shipment) => <span className="text-muted">{formatDate(shipment.date)}</span>,
    },
    {
      key: 'from',
      header: 'From',
      width: 'w-24',
      hideBelow: 'lg',
      cell: (shipment) => (
        <span className="text-muted">{getWarehouse(state, shipment.warehouseId)?.short}</span>
      ),
    },
    {
      key: 'carrier',
      header: 'Carrier',
      hideBelow: 'md',
      cell: (shipment) => (
        <>
          <span className="text-charcoal">{shipment.carrier}</span>
          {shipment.tracking && (
            <span className="mt-0.5 block font-mono text-[0.75rem] text-muted">
              {shipment.tracking}
            </span>
          )}
        </>
      ),
    },
    {
      key: 'units',
      header: 'Units',
      width: 'w-24',
      align: 'right',
      sortValue: (shipment) => shipment.lines.reduce((sum, line) => sum + line.quantity, 0),
      cell: (shipment) => <Num>{shipment.lines.reduce((sum, line) => sum + line.quantity, 0)}</Num>,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Shipments"
        description="Every posted shipment. A shipment is permanent — corrections are made with a return."
      />

      <Panel>
        <Toolbar>
          <div className="w-full sm:w-64">
            <label htmlFor="shipment-search" className="sr-only">
              Search shipments
            </label>
            <TextInput
              id="shipment-search"
              type="search"
              placeholder="Shipment, order, carrier…"
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
            {rows.length} of {state.shipments.length}
          </span>
        </Toolbar>

        <Records
          caption="Shipments"
          rows={rows}
          columns={columns}
          href={(shipment) => paths.shipment(shipment.id)}
          cardSkip={['shipment']}
          cardTitle={(shipment) => shipment.code}
          defaultSort={{ key: 'date', direction: 'desc' }}
          empty={<EmptyState title="No shipments match this search." />}
        />
      </Panel>
    </div>
  );
}

// ----------------------------------------------------------------- returns

/** Returns list, reused by the returns page and the shipment record. */
export function ReturnsTable({ shipmentId }: { shipmentId?: string }) {
  const state = useWorkspace();

  const rows = state.returns
    .filter((entry) => !shipmentId || entry.shipmentId === shipmentId)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No returns recorded"
        description="Open a shipment to record a customer return against it."
      />
    );
  }

  return (
    <Records
      caption="Customer returns"
      rows={rows}
      cardTitle={(entry) => entry.code}
      cardSkip={['return']}
      columns={[
        {
          key: 'return',
          header: 'Return',
          cell: (entry) => {
            const shipment = state.shipments.find((row) => row.id === entry.shipmentId);
            const order = getOrder(state, shipment?.orderId);
            return (
              <>
                <span className="font-medium text-charcoal">{entry.code}</span>
                <span className="mt-0.5 block text-[0.75rem] text-muted">
                  {shipment?.code} · {getCustomer(state, order?.customerId)?.name}
                </span>
              </>
            );
          },
        },
        {
          key: 'date',
          header: 'Date',
          width: 'w-32',
          sortValue: (entry) => entry.date,
          cell: (entry) => <span className="text-muted">{formatDate(entry.date)}</span>,
        },
        {
          key: 'product',
          header: 'Product',
          hideBelow: 'md',
          cell: (entry) => {
            const shipment = state.shipments.find((row) => row.id === entry.shipmentId);
            const order = getOrder(state, shipment?.orderId);
            const line = order?.lines.find((row) => row.id === entry.lineId);
            return (
              <span className="text-charcoal">{getProduct(state, line?.productId)?.sku ?? '—'}</span>
            );
          },
        },
        {
          key: 'quantity',
          header: 'Units',
          width: 'w-20',
          align: 'right',
          cell: (entry) => <Num>{entry.quantity}</Num>,
        },
        {
          key: 'disposition',
          header: 'Disposition',
          width: 'w-48',
          cell: (entry) => (
            <span className={entry.disposition === 'Damaged' ? 'text-app-danger' : 'text-charcoal'}>
              {entry.disposition === 'Damaged'
                ? 'Damaged — not restocked'
                : 'Returned to sellable stock'}
            </span>
          ),
        },
        {
          key: 'reason',
          header: 'Reason',
          hideBelow: 'lg',
          cell: (entry) => <span className="text-muted">{entry.reason || '—'}</span>,
        },
      ]}
    />
  );
}

export function ReturnsPage() {
  const state = useWorkspace();

  const restocked = state.returns
    .filter((entry) => entry.disposition === 'Return to Stock')
    .reduce((sum, entry) => sum + entry.quantity, 0);
  const damaged = state.returns
    .filter((entry) => entry.disposition === 'Damaged')
    .reduce((sum, entry) => sum + entry.quantity, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Returns"
        description="A return is its own inventory event. Damaged goods are recorded but never re-enter sellable stock."
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Metric label="Returns recorded" value={state.returns.length} />
        <Metric label="Units restocked" value={restocked} meta="Posted a Return In movement" />
        <Metric
          label="Units damaged"
          value={damaged}
          meta="Recorded, no movement posted"
          tone={damaged > 0 ? 'warning' : 'default'}
        />
      </div>

      <Panel>
        <PanelHeader title="Recorded returns" as="h2" />
        <ReturnsTable />
      </Panel>

      <p className="text-[0.75rem] text-muted">
        Returns are recorded against a posted shipment, from the shipment record. Stock returns and
        financial credits are separate processes in this demo.
      </p>
    </div>
  );
}

// --------------------------------------------------------- shipment detail

export function ShipmentDetail({ shipmentId }: { shipmentId: string }) {
  const state = useWorkspace();
  const [returnOpen, setReturnOpen] = useState(false);

  const shipment = state.shipments.find((entry) => entry.id === shipmentId);

  if (!shipment) {
    return (
      <EmptyState
        title="That shipment is not in this workspace"
        action={<LinkButton href={paths.module('shipments')}>Back to shipments</LinkButton>}
      />
    );
  }

  const order = getOrder(state, shipment.orderId);
  const customer = getCustomer(state, order?.customerId);
  const warehouse = getWarehouse(state, shipment.warehouseId);
  const returns = state.returns.filter((entry) => entry.shipmentId === shipment.id);
  const outstanding = shipment.lines.reduce(
    (sum, line) => sum + line.quantity - returnedQuantity(state, shipment.id, line.lineId),
    0,
  );

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <a href={paths.module('shipments')} className="hover:text-copper transition-colors">
            Shipments
          </a>
        }
        title={shipment.code}
        description={
          <span className="text-muted">
            {order?.code} · {customer?.name} · shipped {formatDate(shipment.date)} from{' '}
            {warehouse?.name}
          </span>
        }
        actions={
          <>
            <LinkButton href={paths.shipmentPrint(shipment.id)}>
              <Printer size={14} aria-hidden="true" />
              Packing slip
            </LinkButton>
            <Button
              variant="primary"
              disabled={outstanding === 0}
              onClick={() => setReturnOpen(true)}
            >
              Record return
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Panel>
          <PanelHeader title="Shipment" as="h2" />
          <div className="p-4 grid grid-cols-2 gap-4">
            <Detail label="Carrier">{shipment.carrier}</Detail>
            <Detail label="Tracking">{shipment.tracking || '—'}</Detail>
            <Detail label="Ship date">{formatDate(shipment.date)}</Detail>
            <Detail label="From">{warehouse?.name}</Detail>
            <div className="col-span-2">
              <Detail label="Ship to">{order?.shippingAddress}</Detail>
            </div>
            <div className="col-span-2">
              <Detail label="Sales order">
                {order ? (
                  <a href={paths.order(order.id)} className="text-copper hover:underline">
                    {order.code}
                  </a>
                ) : (
                  '—'
                )}
              </Detail>
            </div>
          </div>
        </Panel>

        <div className="lg:col-span-2">
          <Panel>
            <PanelHeader title="Lines" as="h2" />
            <Records
              caption={`Lines on ${shipment.code}`}
              rows={shipment.lines.map((line) => ({ id: line.lineId, ...line }))}
              cardTitle={(row) => {
                const orderLine = order?.lines.find((entry) => entry.id === row.lineId);
                return getProduct(state, orderLine?.productId)?.sku ?? '';
              }}
              cardSkip={['product']}
              columns={[
                {
                  key: 'product',
                  header: 'Product',
                  cell: (row) => {
                    const orderLine = order?.lines.find((entry) => entry.id === row.lineId);
                    const product = getProduct(state, orderLine?.productId);
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
                  header: 'Shipped',
                  width: 'w-24',
                  align: 'right',
                  cell: (row) => <Num>{row.quantity}</Num>,
                },
                {
                  key: 'returned',
                  header: 'Returned',
                  width: 'w-24',
                  align: 'right',
                  cell: (row) => (
                    <Num tone="muted">{returnedQuantity(state, shipment.id, row.lineId)}</Num>
                  ),
                },
                {
                  key: 'value',
                  header: 'Value',
                  width: 'w-28',
                  align: 'right',
                  hideBelow: 'md',
                  cell: (row) => {
                    const orderLine = order?.lines.find((entry) => entry.id === row.lineId);
                    return <Num>{formatMoney((orderLine?.unitPrice ?? 0) * row.quantity)}</Num>;
                  },
                },
              ]}
            />
          </Panel>
        </div>
      </div>

      {returns.length > 0 && (
        <Panel>
          <PanelHeader title="Returns against this shipment" as="h2" meta={`${returns.length}`} />
          <ReturnsTable shipmentId={shipment.id} />
        </Panel>
      )}

      {returnOpen && <ReturnForm open onClose={() => setReturnOpen(false)} shipmentId={shipment.id} />}
    </div>
  );
}
