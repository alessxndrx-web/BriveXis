import { useState } from 'react';
import { useWorkspace } from '../DistributionProvider';
import { paths } from '../distribution.routes';
import { MOVEMENT_TYPES } from '../distribution.types';
import { PAYMENT_METHODS } from '../domain/finance';
import {
  backorderRows,
  inventoryByCategory,
  inventoryByWarehouse,
  invoiceAging,
  movementsByType,
  paymentsByMethod,
  purchaseOrdersByStatus,
  purchasingBySupplier,
  salesOrdersByStatus,
  topProductsByUnitsShipped,
} from '../distribution.reports';
import {
  getCustomer,
  getWarehouse,
  inventoryValue,
  invoiceBalance,
  outstandingReceivable,
} from '../distribution.selectors';
import { formatDate, formatMoney, formatMoneyWhole } from '../distribution.utils';
import {
  EmptyState,
  Metric,
  PageHeader,
  Panel,
  Tabs,
  type TabDefinition,
} from '../../shared/ui/AppUI';
import { BarList, ColumnChart } from '../../shared/ui/Charts';
import { movementLabel } from '../components/StatusBadge';
import { Num, Records } from '../components/DataViews';

/**
 * Operational reporting.
 *
 * Everything here describes what the operation is doing: where stock sits,
 * what is on order, what has shipped, what is owed. There are deliberately no
 * financial statements — this is not an accounting system and does not pretend
 * to be one.
 */

const PO_STATUSES = [
  'Draft',
  'Submitted',
  'Approved',
  'Partially Received',
  'Received',
  'Cancelled',
] as const;

const SO_STATUSES = [
  'Draft',
  'Confirmed',
  'Partially Allocated',
  'Allocated',
  'Picking',
  'Ready to Ship',
  'Partially Shipped',
  'Shipped',
  'Cancelled',
] as const;

type ReportTab = 'inventory' | 'purchasing' | 'sales' | 'receivables';

const TABS: TabDefinition[] = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'purchasing', label: 'Purchasing' },
  { id: 'sales', label: 'Sales and fulfillment' },
  { id: 'receivables', label: 'Receivables' },
];

export function ReportsPage() {
  const state = useWorkspace();
  const [tab, setTab] = useState<ReportTab>('inventory');

  const shippedUnits = state.shipments.reduce(
    (sum, shipment) => sum + shipment.lines.reduce((inner, line) => inner + line.quantity, 0),
    0,
  );
  const receivedUnits = state.receipts.reduce(
    (sum, receipt) => sum + receipt.lines.reduce((inner, line) => inner + line.quantity, 0),
    0,
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        description="Operational reporting across inventory, purchasing, fulfillment and receivables."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric
          label="Inventory value"
          value={formatMoneyWhole(inventoryValue(state))}
          meta="At cost, on hand"
        />
        <Metric label="Units received" value={receivedUnits} meta="All posted receipts" />
        <Metric label="Units shipped" value={shippedUnits} meta="All posted shipments" />
        <Metric
          label="Outstanding"
          value={formatMoneyWhole(outstandingReceivable(state))}
          meta="Unpaid invoice balances"
        />
      </div>

      <Panel>
        <div className="px-3.5 pt-2 border-b border-app-border">
          <Tabs
            label="Report groups"
            tabs={TABS}
            active={tab}
            onChange={(id) => setTab(id as ReportTab)}
          />
        </div>

        <div id={`tabpanel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="p-4">
          {tab === 'inventory' && <InventoryReports />}
          {tab === 'purchasing' && <PurchasingReports />}
          {tab === 'sales' && <SalesReports />}
          {tab === 'receivables' && <ReceivableReports />}
        </div>
      </Panel>

      <p className="text-[0.75rem] text-muted">
        These are operational reports. This demo does not produce a profit and loss statement, a
        balance sheet or a general ledger, and does not claim to be a full accounting system.
      </p>
    </div>
  );
}

// -------------------------------------------------------------- inventory

function InventoryReports() {
  const state = useWorkspace();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section aria-labelledby="report-warehouse">
        <h2
          id="report-warehouse"
          className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted mb-3"
        >
          Stock value by warehouse
        </h2>
        <BarList data={inventoryByWarehouse(state)} showAmount emptyLabel="No stock on hand." />
      </section>

      <section aria-labelledby="report-category">
        <h2
          id="report-category"
          className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted mb-3"
        >
          Stock value by category
        </h2>
        <BarList data={inventoryByCategory(state)} showAmount emptyLabel="No stock on hand." />
      </section>

      <section aria-labelledby="report-movements" className="lg:col-span-2">
        <h2
          id="report-movements"
          className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted mb-3"
        >
          Movement ledger by type
        </h2>
        <ColumnChart
          caption="Units moved, by movement type"
          data={movementsByType(state, MOVEMENT_TYPES).map((bucket) => ({
            ...bucket,
            label: movementLabel(bucket.label as (typeof MOVEMENT_TYPES)[number]),
            value: bucket.amount ?? 0,
          }))}
          height={150}
        />
        <p className="mt-2 text-[0.75rem] text-muted">
          Units, not documents. Every figure in this workspace traces back to these movements.
        </p>
      </section>
    </div>
  );
}

// -------------------------------------------------------------- purchasing

function PurchasingReports() {
  const state = useWorkspace();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section aria-labelledby="report-po-status" className="lg:col-span-2">
        <h2
          id="report-po-status"
          className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted mb-3"
        >
          Purchase orders by status
        </h2>
        <ColumnChart
          caption="Purchase orders by status"
          data={purchaseOrdersByStatus(state, PO_STATUSES)}
          height={150}
        />
      </section>

      <section aria-labelledby="report-supplier">
        <h2
          id="report-supplier"
          className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted mb-3"
        >
          Purchasing by supplier
        </h2>
        <BarList
          data={purchasingBySupplier(state)}
          showAmount
          emptyLabel="No purchase orders yet."
        />
      </section>

      <section aria-labelledby="report-receipts">
        <h2
          id="report-receipts"
          className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted mb-3"
        >
          Recent receipts
        </h2>
        {state.receipts.length === 0 ? (
          <EmptyState title="No goods received yet" />
        ) : (
          <ul className="divide-y divide-app-border border-y border-app-border">
            {[...state.receipts]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 8)
              .map((receipt) => (
                <li
                  key={receipt.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                >
                  <span className="text-[0.875rem] text-charcoal">
                    {receipt.code}
                    <span className="ml-2 text-[0.75rem] text-muted">
                      {getWarehouse(state, receipt.warehouseId)?.short} ·{' '}
                      {formatDate(receipt.date)}
                    </span>
                  </span>
                  <Num>{receipt.lines.reduce((sum, line) => sum + line.quantity, 0)} units</Num>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ sales

function SalesReports() {
  const state = useWorkspace();
  const backorders = backorderRows(state);

  return (
    <div className="space-y-6">
      <section aria-labelledby="report-so-status">
        <h2
          id="report-so-status"
          className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted mb-3"
        >
          Sales orders by fulfillment status
        </h2>
        <ColumnChart
          caption="Sales orders by fulfillment status"
          data={salesOrdersByStatus(state, SO_STATUSES)}
          height={150}
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section aria-labelledby="report-top-products">
          <h2
            id="report-top-products"
            className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted mb-3"
          >
            Units shipped by product
          </h2>
          <BarList
            data={topProductsByUnitsShipped(state)}
            emptyLabel="Nothing has shipped yet."
          />
        </section>

        <section aria-labelledby="report-backorders">
          <h2
            id="report-backorders"
            className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted mb-3"
          >
            Backorders
          </h2>
          {backorders.length === 0 ? (
            <p className="text-[0.875rem] text-muted">
              Every confirmed order can be covered by available stock.
            </p>
          ) : (
            <ul className="divide-y divide-app-border border-y border-app-border">
              {backorders.map((row) => (
                <li key={row.order.id} className="py-2">
                  <a
                    href={paths.order(row.order.id)}
                    className="flex flex-wrap items-baseline justify-between gap-2"
                  >
                    <span className="text-[0.875rem] text-charcoal">
                      {row.order.code}
                      <span className="ml-2 text-[0.75rem] text-muted">
                        {getCustomer(state, row.order.customerId)?.name}
                      </span>
                    </span>
                    <Num tone="danger">{row.units} units short</Num>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- receivables

function ReceivableReports() {
  const state = useWorkspace();
  const aging = invoiceAging(state);
  const methods = paymentsByMethod(state, PAYMENT_METHODS);

  return (
    <div className="space-y-6">
      <section aria-labelledby="report-aging">
        <h2
          id="report-aging"
          className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted mb-3"
        >
          Open invoice balances by age
        </h2>
        <BarList data={aging} showAmount emptyLabel="Nothing outstanding." />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section aria-labelledby="report-methods">
          <h2
            id="report-methods"
            className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted mb-3"
          >
            Payments recorded by method
          </h2>
          <BarList data={methods} showAmount emptyLabel="No payments recorded yet." />
          <p className="mt-2 text-[0.75rem] text-muted">
            Demo only — no real transaction is processed. These are records of money taken
            elsewhere.
          </p>
        </section>

        <section aria-labelledby="report-open-invoices">
          <h2
            id="report-open-invoices"
            className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted mb-3"
          >
            Largest open balances
          </h2>
          <OpenInvoiceList />
        </section>
      </div>
    </div>
  );
}

function OpenInvoiceList() {
  const state = useWorkspace();

  const rows = state.invoices
    .filter((invoice) => invoice.status === 'Sent')
    .map((invoice) => ({
      id: invoice.id,
      code: invoice.code,
      customer: getCustomer(state, invoice.customerId)?.name ?? '',
      dueDate: invoice.dueDate,
      balance: invoiceBalance(state, invoice),
    }))
    .filter((row) => row.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 8);

  return (
    <Records
      caption="Open invoice balances"
      rows={rows}
      cardTitle={(row) => row.code}
      cardSkip={['invoice']}
      href={(row) => paths.invoice(row.id)}
      empty={<EmptyState title="Nothing outstanding" />}
      columns={[
        {
          key: 'invoice',
          header: 'Invoice',
          cell: (row) => (
            <>
              <span className="text-charcoal">{row.code}</span>
              <span className="mt-0.5 block text-[0.75rem] text-muted">{row.customer}</span>
            </>
          ),
        },
        {
          key: 'due',
          header: 'Due',
          width: 'w-28',
          cell: (row) => <span className="text-muted">{formatDate(row.dueDate)}</span>,
        },
        {
          key: 'balance',
          header: 'Balance',
          width: 'w-28',
          align: 'right',
          cell: (row) => <Num>{formatMoney(row.balance)}</Num>,
        },
      ]}
    />
  );
}
