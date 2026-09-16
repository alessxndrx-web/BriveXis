import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useWorkspace } from '../DistributionProvider';
import { paths } from '../distribution.routes';
import type { Movement, Product } from '../distribution.types';
import { MOVEMENT_TYPES } from '../distribution.types';
import {
  getSupplier,
  getWarehouse,
  inventoryValue,
  lowStock,
  movementsFor,
  stock,
  stockByWarehouse,
} from '../distribution.selectors';
import { warehouseSummary } from '../distribution.reports';
import {
  formatAddress,
  formatDateTime,
  formatMoney,
  formatMoneyWhole,
  matches,
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
import { Num, Records, Section, StockFigures } from '../components/DataViews';
import { MovementBadge, StockBadge, movementLabel } from '../components/StatusBadge';
import { AdjustmentForm, ProductForm } from '../forms/CatalogForms';
import { TransferForm } from '../forms/LogisticsForms';

/**
 * Products, warehouses and the inventory ledger.
 *
 * None of these screens store a stock figure. On hand, allocated and available
 * are asked of the movement ledger and the allocation table every time they are
 * shown, which is why they cannot disagree with each other.
 */

const ALL = 'all';

// ---------------------------------------------------------------- products

export function ProductsPage() {
  const state = useWorkspace();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL);
  const [supplier, setSupplier] = useState(ALL);
  const [level, setLevel] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);

  const categories = useMemo(
    () => Array.from(new Set(state.products.map((product) => product.category))).sort(),
    [state.products],
  );

  const rows = useMemo(
    () =>
      state.products.filter((product) => {
        if (category !== ALL && product.category !== category) return false;
        if (supplier !== ALL && product.supplierId !== supplier) return false;
        if (level === 'low' && !lowStock(state, product)) return false;
        if (level === 'healthy' && lowStock(state, product)) return false;
        if (level === 'out' && stock(state, product.id).available > 0) return false;
        return matches(query, product.sku, product.name, product.brand, product.category);
      }),
    [state, query, category, supplier, level],
  );

  const clear = () => {
    setQuery('');
    setCategory(ALL);
    setSupplier(ALL);
    setLevel(ALL);
  };

  const filtered = query || category !== ALL || supplier !== ALL || level !== ALL;

  const columns: Column<Product>[] = [
    {
      key: 'product',
      header: 'SKU / Product',
      sortValue: (product) => product.sku,
      cell: (product) => (
        <>
          <span className="font-medium text-charcoal">{product.name}</span>
          <span className="mt-0.5 block font-mono text-[0.75rem] text-muted">{product.sku}</span>
        </>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      width: 'w-32',
      hideBelow: 'lg',
      sortValue: (product) => product.category,
      cell: (product) => <span className="text-muted">{product.category}</span>,
    },
    {
      key: 'onHand',
      header: 'On hand',
      width: 'w-24',
      align: 'right',
      sortValue: (product) => stock(state, product.id).onHand,
      cell: (product) => <Num>{stock(state, product.id).onHand}</Num>,
    },
    {
      key: 'allocated',
      header: 'Allocated',
      width: 'w-24',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (product) => stock(state, product.id).allocated,
      cell: (product) => <Num tone="muted">{stock(state, product.id).allocated}</Num>,
    },
    {
      key: 'available',
      header: 'Available',
      width: 'w-24',
      align: 'right',
      sortValue: (product) => stock(state, product.id).available,
      cell: (product) => {
        const available = stock(state, product.id).available;
        return <Num tone={available <= 0 ? 'danger' : undefined}>{available}</Num>;
      },
    },
    {
      key: 'price',
      header: 'Price',
      width: 'w-28',
      align: 'right',
      hideBelow: 'lg',
      sortValue: (product) => product.price,
      cell: (product) => <Num>{formatMoney(product.price)}</Num>,
    },
    {
      key: 'status',
      header: 'Stock status',
      width: 'w-32',
      sortValue: (product) => stock(state, product.id).available,
      cell: (product) => (
        <StockBadge
          available={stock(state, product.id).available}
          reorderPoint={product.reorderPoint}
          active={product.active}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products"
        description={`${state.products.length} catalogue items. Stock is derived from the movement ledger.`}
        actions={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <Plus size={14} aria-hidden="true" />
            New product
          </Button>
        }
      />

      <Panel>
        <Toolbar>
          <div className="w-full sm:w-60">
            <label htmlFor="product-search" className="sr-only">
              Search products
            </label>
            <TextInput
              id="product-search"
              type="search"
              placeholder="SKU, name, brand…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <InlineField label="Category" htmlFor="product-category-filter">
            <Select
              id="product-category-filter"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All</option>
              {categories.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </InlineField>

          <InlineField label="Supplier" htmlFor="product-supplier-filter">
            <Select
              id="product-supplier-filter"
              value={supplier}
              onChange={(event) => setSupplier(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All</option>
              {state.suppliers.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </InlineField>

          <InlineField label="Stock" htmlFor="product-level-filter">
            <Select
              id="product-level-filter"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All levels</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
              <option value="healthy">Above reorder point</option>
            </Select>
          </InlineField>

          {filtered && (
            <Button size="sm" onClick={clear}>
              Clear filters
            </Button>
          )}

          <span className="ml-auto text-[0.75rem] text-muted tabular-nums">
            {rows.length} of {state.products.length}
          </span>
        </Toolbar>

        <Records
          caption="Products"
          rows={rows}
          columns={columns}
          href={(product) => paths.product(product.id)}
          defaultSort={{ key: 'available', direction: 'asc' }}
          cardSkip={['product']}
          cardTitle={(product) => `${product.sku} — ${product.name}`}
          empty={
            <EmptyState
              title="No products match these filters."
              action={<Button onClick={clear}>Clear filters</Button>}
            />
          }
        />
      </Panel>

      {formOpen && <ProductForm open onClose={() => setFormOpen(false)} />}
    </div>
  );
}

// ---------------------------------------------------------- product detail

const PRODUCT_TABS = [
  { id: 'stock', label: 'Stock by warehouse' },
  { id: 'movements', label: 'Movements' },
  { id: 'details', label: 'Details' },
];

export function ProductDetail({ productId }: { productId: string }) {
  const state = useWorkspace();
  const [tab, setTab] = useState('stock');
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const product = state.products.find((entry) => entry.id === productId);

  if (!product) {
    return (
      <EmptyState
        title="That product is not in this workspace"
        action={<LinkButton href={paths.module('products')}>Back to products</LinkButton>}
      />
    );
  }

  const position = stock(state, product.id);
  const byWarehouse = stockByWarehouse(state, product.id);
  const movements = movementsFor(state, { productId: product.id });
  const supplier = getSupplier(state, product.supplierId);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <a href={paths.module('products')} className="hover:text-copper transition-colors">
            Products
          </a>
        }
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StockBadge
              available={position.available}
              reorderPoint={product.reorderPoint}
              active={product.active}
            />
            <span className="font-mono text-muted">{product.sku}</span>
            <span className="text-muted">
              · {product.category} · {product.unit}
            </span>
          </span>
        }
        actions={
          <>
            <Button onClick={() => setTransferOpen(true)}>Transfer</Button>
            <Button onClick={() => setAdjustOpen(true)}>Adjust stock</Button>
            <Button variant="primary" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Metric label="On hand" value={position.onHand} />
        <Metric label="Allocated" value={position.allocated} meta="Committed to orders" />
        <Metric
          label="Available"
          value={position.available}
          tone={position.available <= 0 ? 'danger' : position.available <= product.reorderPoint ? 'warning' : 'default'}
          meta={`Reorder at ${product.reorderPoint}`}
        />
        <Metric label="Cost" value={formatMoney(product.cost)} meta="Per unit" />
        <Metric label="Price" value={formatMoney(product.price)} meta="Per unit" />
      </div>

      <Panel>
        <Tabs tabs={PRODUCT_TABS} active={tab} onChange={setTab} label="Product sections" />

        {tab === 'stock' && (
          <ul className="divide-y divide-app-border">
            {byWarehouse.map((row) => (
              <li key={row.warehouse.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <a
                    href={paths.warehouse(row.warehouse.id)}
                    className="text-[0.9375rem] text-charcoal hover:text-copper transition-colors"
                  >
                    {row.warehouse.name}
                  </a>
                  <StockFigures onHand={row.onHand} allocated={row.allocated} available={row.available} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === 'movements' && (
          <MovementLedger movements={movements} />
        )}

        {tab === 'details' && (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Detail label="Brand">{product.brand || '—'}</Detail>
            <Detail label="Unit of measure">{product.unit}</Detail>
            <Detail label="Reorder point">{product.reorderPoint}</Detail>
            <Detail label="Preferred supplier">
              {supplier ? (
                <a href={paths.supplier(supplier.id)} className="hover:text-copper transition-colors">
                  {supplier.name}
                </a>
              ) : (
                'None'
              )}
            </Detail>
            <Detail label="Status">{product.active ? 'Active' : 'Inactive'}</Detail>
            <Detail label="Stock value">
              <Num>{formatMoney(position.onHand * product.cost)}</Num>
            </Detail>
            {product.description && (
              <div className="col-span-2 sm:col-span-3">
                <Detail label="Description">{product.description}</Detail>
              </div>
            )}
          </div>
        )}
      </Panel>

      {editOpen && <ProductForm open onClose={() => setEditOpen(false)} product={product} />}
      {adjustOpen && <AdjustmentForm open onClose={() => setAdjustOpen(false)} productId={product.id} />}
      {transferOpen && <TransferForm open onClose={() => setTransferOpen(false)} productId={product.id} />}
    </div>
  );
}

// -------------------------------------------------------------- warehouses

export function WarehousesPage() {
  const state = useWorkspace();
  const rows = warehouseSummary(state);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Warehouses"
        description={`${state.warehouses.length} facilities. Stock is tracked separately at each location.`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {rows.map((row) => (
          <Panel key={row.warehouse.id}>
            <PanelHeader
              title={
                <a href={paths.warehouse(row.warehouse.id)} className="hover:text-copper transition-colors">
                  {row.warehouse.name}
                </a>
              }
              meta={row.warehouse.short}
            />
            <div className="p-4 space-y-3">
              <p className="text-[0.8125rem] text-muted">{formatAddress(row.warehouse.address)}</p>
              <dl className="grid grid-cols-3 gap-3">
                <Detail label="Units">
                  <Num>{row.units}</Num>
                </Detail>
                <Detail label="Value">
                  <Num>{formatMoneyWhole(row.value)}</Num>
                </Detail>
                <Detail label="Low stock">
                  <Num tone={row.lowStock > 0 ? 'danger' : 'muted'}>{row.lowStock}</Num>
                </Detail>
              </dl>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

export function WarehouseDetail({ warehouseId }: { warehouseId: string }) {
  const state = useWorkspace();
  const [tab, setTab] = useState('stock');

  const warehouse = getWarehouse(state, warehouseId);

  if (!warehouse) {
    return (
      <EmptyState
        title="That warehouse is not in this workspace"
        action={<LinkButton href={paths.module('warehouses')}>Back to warehouses</LinkButton>}
      />
    );
  }

  const rows = state.products
    .map((product) => ({ product, ...stock(state, product.id, warehouse.id) }))
    .filter((row) => row.onHand !== 0 || row.allocated !== 0);

  const inbound = state.purchaseOrders.filter(
    (po) => po.warehouseId === warehouse.id && po.status === 'Approved',
  );
  const outbound = state.orders.filter(
    (order) => order.warehouseId === warehouse.id && order.status === 'Confirmed',
  );
  const transfers = state.transfers.filter(
    (transfer) => transfer.from === warehouse.id || transfer.to === warehouse.id,
  );
  const movements = movementsFor(state, { warehouseId: warehouse.id });

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <a href={paths.module('warehouses')} className="hover:text-copper transition-colors">
            Warehouses
          </a>
        }
        title={warehouse.name}
        description={
          <span className="text-muted">
            {warehouse.short} · {formatAddress(warehouse.address)}
          </span>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric
          label="Stock value"
          value={formatMoneyWhole(inventoryValue(state, warehouse.id))}
          meta="At cost"
        />
        <Metric label="Product lines" value={rows.length} meta="With stock or commitments" />
        <Metric label="Incoming POs" value={inbound.length} href={paths.module('purchasing')} />
        <Metric label="Open orders" value={outbound.length} href={paths.module('orders')} />
      </div>

      <Panel>
        <Tabs
          tabs={[
            { id: 'stock', label: 'Inventory', count: rows.length },
            { id: 'movements', label: 'Movements', count: movements.length },
            { id: 'transfers', label: 'Transfers', count: transfers.length },
          ]}
          active={tab}
          onChange={setTab}
          label="Warehouse sections"
        />

        {tab === 'stock' && (
          <Records
            caption={`Inventory at ${warehouse.name}`}
            rows={rows.map((row) => ({ ...row, id: row.product.id }))}
            href={(row) => paths.product(row.product.id)}
            cardTitle={(row) => `${row.product.sku} — ${row.product.name}`}
            cardSkip={['product']}
            columns={[
              {
                key: 'product',
                header: 'Product',
                sortValue: (row) => row.product.sku,
                cell: (row) => (
                  <>
                    <span className="text-charcoal">{row.product.name}</span>
                    <span className="mt-0.5 block font-mono text-[0.75rem] text-muted">
                      {row.product.sku}
                    </span>
                  </>
                ),
              },
              {
                key: 'onHand',
                header: 'On hand',
                width: 'w-24',
                align: 'right',
                sortValue: (row) => row.onHand,
                cell: (row) => <Num>{row.onHand}</Num>,
              },
              {
                key: 'allocated',
                header: 'Allocated',
                width: 'w-24',
                align: 'right',
                sortValue: (row) => row.allocated,
                cell: (row) => <Num tone="muted">{row.allocated}</Num>,
              },
              {
                key: 'available',
                header: 'Available',
                width: 'w-24',
                align: 'right',
                sortValue: (row) => row.available,
                cell: (row) => (
                  <Num tone={row.available <= 0 ? 'danger' : undefined}>{row.available}</Num>
                ),
              },
            ]}
            empty={<EmptyState title="No stock at this warehouse" />}
          />
        )}

        {tab === 'movements' && <MovementLedger movements={movements} />}

        {tab === 'transfers' && (
          <div className="p-4">
            {transfers.length === 0 ? (
              <EmptyState title="No transfers involve this warehouse" />
            ) : (
              <ul className="divide-y divide-app-border -my-2.5">
                {transfers.map((transfer) => (
                  <li key={transfer.id} className="flex items-baseline justify-between gap-2 py-2.5">
                    <span className="text-[0.875rem] text-charcoal">
                      {transfer.code} · {transfer.quantity} units
                    </span>
                    <span className="text-[0.75rem] text-muted">
                      {getWarehouse(state, transfer.from)?.short} →{' '}
                      {getWarehouse(state, transfer.to)?.short} · {transfer.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

// --------------------------------------------------------------- inventory

export function InventoryPage() {
  const state = useWorkspace();
  const [tab, setTab] = useState('warehouse');
  const [warehouse, setWarehouse] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [query, setQuery] = useState('');
  const [adjustOpen, setAdjustOpen] = useState(false);

  const positions = useMemo(
    () =>
      state.products
        .flatMap((product) =>
          state.warehouses
            .filter((entry) => warehouse === ALL || entry.id === warehouse)
            .map((entry) => ({
              id: `${product.id}-${entry.id}`,
              product,
              warehouse: entry,
              ...stock(state, product.id, entry.id),
            })),
        )
        .filter((row) => matches(query, row.product.sku, row.product.name))
        .filter((row) => row.onHand !== 0 || row.allocated !== 0),
    [state, warehouse, query],
  );

  const movements = useMemo(
    () =>
      movementsFor(state, { warehouseId: warehouse === ALL ? undefined : warehouse })
        .filter((row) => type === ALL || row.type === type)
        .filter((row) => {
          const product = state.products.find((entry) => entry.id === row.productId);
          return matches(query, product?.sku, product?.name, row.source, row.note);
        }),
    [state, warehouse, type, query],
  );

  const low = state.products.filter((product) => lowStock(state, product));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory"
        description="Physical stock, commitments and the immutable movement history behind them."
        actions={
          <Button variant="primary" onClick={() => setAdjustOpen(true)}>
            Adjust stock
          </Button>
        }
      />

      <Panel>
        <Tabs
          tabs={[
            { id: 'warehouse', label: 'By warehouse', count: positions.length },
            { id: 'low', label: 'Low stock', count: low.length },
            { id: 'movements', label: 'Movement history', count: movements.length },
          ]}
          active={tab}
          onChange={setTab}
          label="Inventory views"
        />

        <Toolbar>
          <div className="w-full sm:w-56">
            <label htmlFor="inventory-search" className="sr-only">
              Search inventory
            </label>
            <TextInput
              id="inventory-search"
              type="search"
              placeholder="SKU, product, reference…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <InlineField label="Warehouse" htmlFor="inventory-warehouse">
            <Select
              id="inventory-warehouse"
              value={warehouse}
              onChange={(event) => setWarehouse(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All</option>
              {state.warehouses.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </InlineField>

          {tab === 'movements' && (
            <InlineField label="Movement" htmlFor="inventory-movement-type">
              <Select
                id="inventory-movement-type"
                value={type}
                onChange={(event) => setType(event.target.value)}
                className="w-auto"
              >
                <option value={ALL}>All</option>
                {MOVEMENT_TYPES.map((entry) => (
                  <option key={entry} value={entry}>
                    {movementLabel(entry)}
                  </option>
                ))}
              </Select>
            </InlineField>
          )}

          {(query || warehouse !== ALL || type !== ALL) && (
            <Button
              size="sm"
              onClick={() => {
                setQuery('');
                setWarehouse(ALL);
                setType(ALL);
              }}
            >
              Clear filters
            </Button>
          )}
        </Toolbar>

        {tab === 'warehouse' && (
          <Records
            caption="Stock by warehouse"
            rows={positions}
            href={(row) => paths.product(row.product.id)}
            cardTitle={(row) => `${row.product.sku} — ${row.warehouse.short}`}
            cardSkip={['product']}
            defaultSort={{ key: 'available', direction: 'asc' }}
            columns={[
              {
                key: 'product',
                header: 'Product',
                sortValue: (row) => row.product.sku,
                cell: (row) => (
                  <>
                    <span className="text-charcoal">{row.product.name}</span>
                    <span className="mt-0.5 block font-mono text-[0.75rem] text-muted">
                      {row.product.sku}
                    </span>
                  </>
                ),
              },
              {
                key: 'warehouse',
                header: 'Warehouse',
                width: 'w-48',
                sortValue: (row) => row.warehouse.name,
                cell: (row) => <span className="text-muted">{row.warehouse.name}</span>,
              },
              {
                key: 'onHand',
                header: 'On hand',
                width: 'w-24',
                align: 'right',
                sortValue: (row) => row.onHand,
                cell: (row) => <Num>{row.onHand}</Num>,
              },
              {
                key: 'allocated',
                header: 'Allocated',
                width: 'w-24',
                align: 'right',
                sortValue: (row) => row.allocated,
                cell: (row) => <Num tone="muted">{row.allocated}</Num>,
              },
              {
                key: 'available',
                header: 'Available',
                width: 'w-24',
                align: 'right',
                sortValue: (row) => row.available,
                cell: (row) => (
                  <Num tone={row.available <= 0 ? 'danger' : undefined}>{row.available}</Num>
                ),
              },
            ]}
            empty={<EmptyState title="No stock matches these filters." />}
          />
        )}

        {tab === 'low' && (
          <Records
            caption="Low stock"
            rows={low}
            href={(product) => paths.product(product.id)}
            cardTitle={(product) => `${product.sku} — ${product.name}`}
            cardSkip={['product']}
            columns={[
              {
                key: 'product',
                header: 'Product',
                sortValue: (product) => product.sku,
                cell: (product) => (
                  <>
                    <span className="text-charcoal">{product.name}</span>
                    <span className="mt-0.5 block font-mono text-[0.75rem] text-muted">
                      {product.sku}
                    </span>
                  </>
                ),
              },
              {
                key: 'available',
                header: 'Available',
                width: 'w-24',
                align: 'right',
                sortValue: (product) => stock(state, product.id).available,
                cell: (product) => {
                  const available = stock(state, product.id).available;
                  return <Num tone={available <= 0 ? 'danger' : undefined}>{available}</Num>;
                },
              },
              {
                key: 'reorder',
                header: 'Reorder point',
                width: 'w-28',
                align: 'right',
                sortValue: (product) => product.reorderPoint,
                cell: (product) => <Num tone="muted">{product.reorderPoint}</Num>,
              },
              {
                key: 'supplier',
                header: 'Preferred supplier',
                hideBelow: 'md',
                cell: (product) => (
                  <span className="text-muted">
                    {getSupplier(state, product.supplierId)?.name ?? '—'}
                  </span>
                ),
              },
            ]}
            empty={
              <EmptyState
                title="Everything is above its reorder point"
                description="Nothing needs replenishing right now."
              />
            }
          />
        )}

        {tab === 'movements' && <MovementLedger movements={movements} showProduct />}
      </Panel>

      {adjustOpen && <AdjustmentForm open onClose={() => setAdjustOpen(false)} />}
    </div>
  );
}

/**
 * The movement ledger.
 *
 * Append-only: a later transaction never edits or deletes an earlier movement,
 * which is what makes this a usable audit trail rather than a summary.
 */
export function MovementLedger({
  movements,
  showProduct = true,
}: {
  movements: Movement[];
  showProduct?: boolean;
}) {
  const state = useWorkspace();

  return (
    <Records
      caption="Inventory movements"
      rows={movements}
      cardTitle={(movement) =>
        `${state.products.find((p) => p.id === movement.productId)?.sku ?? ''} · ${movementLabel(movement.type)}`
      }
      cardSkip={['type']}
      columns={[
        {
          key: 'date',
          header: 'Date',
          width: 'w-40',
          sortValue: (movement) => movement.at,
          cell: (movement) => <span className="text-muted">{formatDateTime(movement.at)}</span>,
        },
        {
          key: 'type',
          header: 'Movement',
          width: 'w-40',
          sortValue: (movement) => movement.type,
          cell: (movement) => <MovementBadge type={movement.type} />,
        },
        ...(showProduct
          ? [
              {
                key: 'product',
                header: 'Product',
                sortValue: (movement: Movement) => movement.productId,
                cell: (movement: Movement) => {
                  const product = state.products.find((entry) => entry.id === movement.productId);
                  return product ? (
                    <a
                      href={paths.product(product.id)}
                      className="text-charcoal hover:text-copper transition-colors"
                    >
                      {product.sku}
                    </a>
                  ) : (
                    <span className="text-muted">—</span>
                  );
                },
              },
            ]
          : []),
        {
          key: 'warehouse',
          header: 'Warehouse',
          width: 'w-32',
          hideBelow: 'md',
          sortValue: (movement) => movement.warehouseId,
          cell: (movement) => (
            <span className="text-muted">{getWarehouse(state, movement.warehouseId)?.short}</span>
          ),
        },
        {
          key: 'quantity',
          header: 'Change',
          width: 'w-24',
          align: 'right',
          sortValue: (movement) => movement.quantity,
          cell: (movement) => (
            <Num tone={movement.quantity < 0 ? 'danger' : undefined}>
              {movement.quantity > 0 ? '+' : ''}
              {movement.quantity}
            </Num>
          ),
        },
        {
          key: 'source',
          header: 'Reference',
          hideBelow: 'lg',
          cell: (movement) => (
            <span className="text-muted">
              {movement.source}
              {movement.note && <span className="block text-[0.75rem]">{movement.note}</span>}
            </span>
          ),
        },
      ]}
      empty={<EmptyState title="No movements recorded yet" />}
    />
  );
}
