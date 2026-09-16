import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useWorkspace } from '../DistributionProvider';
import { paths } from '../distribution.routes';
import {
  dashboardMetrics,
  recentMovements,
  recentReceipts,
  recentShipments,
  warehouseSummary,
} from '../distribution.reports';
import {
  awaitingAllocation,
  awaitingReceipt,
  getCustomer,
  getSupplier,
  lowStockProducts,
  orderStatus,
  poStatus,
  readyToShip,
  receivedQuantity,
  stock,
} from '../distribution.selectors';
import { formatDate, formatMoney, formatMoneyWhole, pluralize } from '../distribution.utils';
import { EmptyState, Metric, PageHeader, Panel, PanelHeader } from '../../shared/ui/AppUI';
import { Num } from '../components/DataViews';
import { MovementBadge, OrderStatusBadge, PurchaseOrderStatusBadge } from '../components/StatusBadge';

/**
 * Operational overview.
 *
 * Every figure is computed from the workspace as it stands, so posting a
 * receipt or a shipment moves these numbers immediately. Nothing here claims a
 * trend or a growth rate — a demo has nothing to compare itself against.
 */

export function Dashboard() {
  const state = useWorkspace();
  const metrics = dashboardMetrics(state);
  const lowStock = lowStockProducts(state);
  const inbound = awaitingReceipt(state);
  const toAllocate = awaitingAllocation(state);
  const toShip = readyToShip(state);
  const warehouses = warehouseSummary(state);

  const today = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-4">
      <PageHeader
        title="Overview"
        description={`${state.settings.companyName} — operational snapshot for ${today}.`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Metric
          label="Inventory value"
          value={formatMoneyWhole(metrics.inventoryValue)}
          meta="At cost, on hand"
          href={paths.module('inventory')}
        />
        <Metric
          label="Low stock"
          value={metrics.lowStockCount}
          meta="At or below reorder point"
          tone={metrics.lowStockCount > 0 ? 'warning' : 'default'}
          href={paths.module('products')}
        />
        <Metric
          label="Open purchase orders"
          value={metrics.openPurchaseOrders}
          meta={`${metrics.inboundUnits} units inbound`}
          href={paths.module('purchasing')}
        />
        <Metric
          label="Open sales orders"
          value={metrics.openOrders}
          meta={`${metrics.backorderedUnits} units short of available stock`}
          tone={metrics.backorderedUnits > 0 ? 'warning' : 'default'}
          href={paths.module('orders')}
        />
        <Metric
          label="Ready to ship"
          value={metrics.readyToShip}
          meta={`${metrics.awaitingAllocation} awaiting allocation`}
          href={paths.module('fulfillment')}
        />
        <Metric
          label="Outstanding"
          value={formatMoneyWhole(metrics.outstandingReceivable)}
          meta={`${formatMoneyWhole(metrics.paymentsThisMonth)} received this month`}
          href={paths.module('invoices')}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        {/* Two packed columns rather than two stacked grids: a short panel
            must not hold back everything on the row below it. */}
        <div className="xl:col-span-2 space-y-4">
          {/* ---------------------------------------------- low stock */}
          <Panel>
            <PanelHeader
              title="Low stock"
              meta={lowStock.length > 0 ? pluralize(lowStock.length, 'product') : undefined}
              actions={
                <a
                  href={paths.module('purchasing')}
                  className="inline-flex items-center gap-1 text-[0.8125rem] text-muted hover:text-copper transition-colors"
                >
                  Purchasing
                  <ArrowRight size={13} aria-hidden="true" />
                </a>
              }
            />
            {lowStock.length === 0 ? (
              <EmptyState
                title="Everything is above its reorder point"
                description="Nothing needs replenishing right now."
              />
            ) : (
              <ul>
                {lowStock.slice(0, 6).map((product) => {
                  const position = stock(state, product.id);
                  return (
                    <li key={product.id} className="border-b border-app-border last:border-b-0">
                      <a
                        href={paths.product(product.id)}
                        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-l-2 border-l-app-warning px-4 py-2.5 transition-colors hover:bg-app-bg"
                      >
                        <span className="min-w-0">
                          <span className="block text-[0.9375rem] text-charcoal">
                            {product.sku} — {product.name}
                          </span>
                          <span className="block text-[0.75rem] text-muted">
                            Reorder point {product.reorderPoint} · {getSupplier(state, product.supplierId)?.name ?? 'No preferred supplier'}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5 text-[0.8125rem]">
                          <AlertTriangle size={13} aria-hidden="true" className="text-app-warning" />
                          <Num tone={position.available <= 0 ? 'danger' : undefined}>
                            {position.available} available
                          </Num>
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* ------------------------------------------ inbound queue */}
            <Panel>
              <PanelHeader title="Incoming purchase orders" meta={inbound.length > 0 ? `${inbound.length}` : undefined} />
              {inbound.length === 0 ? (
                <EmptyState title="Nothing awaiting receipt" />
              ) : (
                <ul>
                  {inbound.slice(0, 5).map((po) => {
                    const outstanding = po.lines.reduce(
                      (sum, line) => sum + Math.max(0, line.quantity - receivedQuantity(state, po.id, line.id)),
                      0,
                    );
                    return (
                      <li key={po.id} className="border-b border-app-border last:border-b-0">
                        <a href={paths.purchaseOrder(po.id)} className="block px-4 py-2.5 transition-colors hover:bg-app-bg">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[0.875rem] text-charcoal">{po.code}</span>
                            <PurchaseOrderStatusBadge status={poStatus(state, po)} />
                          </div>
                          <p className="mt-0.5 text-[0.75rem] text-muted truncate">
                            {getSupplier(state, po.supplierId)?.name} · {outstanding} units due{' '}
                            {formatDate(po.expectedDate)}
                          </p>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            {/* ----------------------------------------- orders to work */}
            <Panel>
              <PanelHeader
                title="Orders requiring attention"
                meta={toAllocate.length + toShip.length > 0 ? `${toAllocate.length + toShip.length}` : undefined}
              />
              {toAllocate.length + toShip.length === 0 ? (
                <EmptyState title="Nothing waiting" description="Every confirmed order is moving." />
              ) : (
                <ul>
                  {[...toShip, ...toAllocate].slice(0, 5).map((order) => (
                    <li key={order.id} className="border-b border-app-border last:border-b-0">
                      <a href={paths.order(order.id)} className="block px-4 py-2.5 transition-colors hover:bg-app-bg">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[0.875rem] text-charcoal">{order.code}</span>
                          <OrderStatusBadge status={orderStatus(state, order)} />
                        </div>
                        <p className="mt-0.5 text-[0.75rem] text-muted truncate">
                          {getCustomer(state, order.customerId)?.name} · requested{' '}
                          {formatDate(order.requestedDate)}
                        </p>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {/* ------------------------------------- what moved recently */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <Panel>
              <PanelHeader title="Recent receipts" />
              {recentReceipts(state).length === 0 ? (
                <EmptyState title="No goods received yet" />
              ) : (
                <ul>
                  {recentReceipts(state).map((receipt) => (
                    <li
                      key={receipt.id}
                      className="flex items-baseline justify-between gap-2 border-b border-app-border last:border-b-0 px-4 py-2.5"
                    >
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

            <Panel>
              <PanelHeader title="Recent shipments" />
              {recentShipments(state).length === 0 ? (
                <EmptyState title="Nothing shipped yet" />
              ) : (
                <ul>
                  {recentShipments(state).map((shipment) => (
                    <li key={shipment.id} className="border-b border-app-border last:border-b-0">
                      <a
                        href={paths.shipment(shipment.id)}
                        className="flex items-baseline justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-app-bg"
                      >
                        <span className="text-[0.875rem] text-charcoal">{shipment.code}</span>
                        <span className="text-[0.75rem] text-muted">
                          {formatDate(shipment.date)} · {shipment.carrier}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>

        <div className="space-y-4">
          {/* --------------------------------------- warehouse summary */}
          <Panel>
            <PanelHeader title="Warehouse stock" meta={`${state.warehouses.length} locations`} />
            <ul>
              {warehouses.map((row) => (
                <li key={row.warehouse.id} className="border-b border-app-border last:border-b-0">
                  <a
                    href={paths.warehouse(row.warehouse.id)}
                    className="block px-4 py-2.5 transition-colors hover:bg-app-bg"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[0.875rem] text-charcoal truncate">
                        {row.warehouse.name}
                      </span>
                      <Num>{formatMoneyWhole(row.value)}</Num>
                    </div>
                    <p className="mt-0.5 text-[0.75rem] text-muted">
                      {row.units} units
                      {row.lowStock > 0 && ` · ${row.lowStock} low`}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          </Panel>

          {/* ------------------------------------------ movement ledger */}
          <Panel>
            <PanelHeader title="Recent movements" actions={
              <a
                href={paths.module('inventory')}
                className="inline-flex items-center gap-1 text-[0.8125rem] text-muted hover:text-copper transition-colors"
              >
                Ledger
                <ArrowRight size={13} aria-hidden="true" />
              </a>
            } />
            <ul>
              {recentMovements(state, 6).map((movement) => (
                <li
                  key={movement.id}
                  className="flex items-baseline justify-between gap-2 border-b border-app-border last:border-b-0 px-4 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block text-[0.8125rem] text-charcoal truncate">
                      {state.products.find((product) => product.id === movement.productId)?.sku} ·{' '}
                      {movement.source}
                    </span>
                    <span className="block text-[0.75rem] text-muted">
                      {formatDate(movement.at)} ·{' '}
                      {state.warehouses.find((w) => w.id === movement.warehouseId)?.short}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <MovementBadge type={movement.type} />
                    <Num tone={movement.quantity < 0 ? 'danger' : undefined}>
                      {movement.quantity > 0 ? '+' : ''}
                      {movement.quantity}
                    </Num>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <p className="text-[0.75rem] text-muted">
        Every figure above is computed from the movement ledger and the documents in this
        workspace. Inventory value is {formatMoney(metrics.inventoryValue)} at cost.
      </p>
    </div>
  );
}
