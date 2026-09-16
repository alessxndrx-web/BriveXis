import { useMemo, useState } from 'react';
import { useCommand, useWorkspace } from '../DistributionProvider';
import type { Line, SalesOrder } from '../distribution.types';
import { createId, dayOffset, formatAddress, toDateOnly } from '../distribution.utils';
import { getCustomer, lineAllocation, shippedQuantity, stock } from '../distribution.selectors';
import { track } from '../../../lib/analytics';
import { Button, FormField, Select, TextArea, TextInput } from '../../shared/ui/AppUI';
import { Dialog } from '../../shared/ui/Dialog';
import { NumberInput, useForm } from '../../shared/ui/formControls';
import { DocumentTotals, LineItemEditor } from '../components/LineItemEditor';
import { Num } from '../components/DataViews';

/**
 * Sales orders and shipments.
 *
 * Order entry shows the stock position next to every quantity typed, so a line
 * the warehouse cannot cover is visible immediately. The order is still
 * accepted: the shortfall becomes a backorder rather than a rejection, which is
 * how a distributor actually trades.
 */

// ------------------------------------------------------------ sales orders

export function SalesOrderForm({
  open,
  onClose,
  order,
  customerId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  order?: SalesOrder;
  customerId?: string;
  onSaved?: (id: string) => void;
}) {
  const state = useWorkspace();
  const run = useCommand();
  const [error, setError] = useState('');

  const customers = state.customers.filter((customer) => customer.active);
  const firstProduct = state.products.find((product) => product.active);

  const [lines, setLines] = useState<Line[]>(
    order?.lines.map((line) => ({ ...line })) ??
      (firstProduct
        ? [{ id: 'line-1', productId: firstProduct.id, quantity: 1, unitPrice: firstProduct.price }]
        : []),
  );

  const initialCustomer = order?.customerId ?? customerId ?? customers[0]?.id ?? '';

  const form = useForm({
    customerId: initialCustomer,
    warehouseId: order?.warehouseId ?? state.warehouses[0]?.id ?? '',
    date: order?.date ?? toDateOnly(new Date()),
    requestedDate: order?.requestedDate ?? dayOffset(new Date(), 5),
    shippingAddress:
      order?.shippingAddress ??
      (() => {
        const customer = getCustomer(state, initialCustomer);
        const address = customer?.shippingAddress ?? customer?.address;
        return address ? formatAddress(address) : '';
      })(),
    discount: order?.discount ?? 0,
    taxBps: order?.taxBps ?? state.settings.defaultTaxBps,
    freight: order?.freight ?? 0,
    notes: order?.notes ?? '',
  });

  // Stock is read at the order's warehouse, which is where it would ship from.
  const stockFor = useMemo(
    () => (productId: string) => stock(state, productId, form.values.warehouseId),
    [state, form.values.warehouseId],
  );

  const submit = () => {
    const id = order?.id ?? createId('order');
    const failure = run(
      {
        type: 'order/save',
        order: {
          id,
          code: order?.code ?? '',
          customerId: form.values.customerId,
          warehouseId: form.values.warehouseId,
          date: form.values.date,
          requestedDate: form.values.requestedDate,
          shippingAddress: form.values.shippingAddress.trim(),
          notes: form.values.notes.trim(),
          status: 'Draft',
          lines,
          discount: form.values.discount,
          taxBps: form.values.taxBps,
          freight: form.values.freight,
        },
      },
      order ? 'Sales order updated.' : 'Sales order drafted.',
    );

    if (failure) {
      setError(failure);
      return;
    }
    setError('');
    if (!order) track('sales_order_created', { lines: lines.length });
    onClose();
    onSaved?.(id);
  };

  const shortfall = lines.reduce(
    (total, line) => total + Math.max(0, line.quantity - stockFor(line.productId).available),
    0,
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={order ? `Edit ${order.code}` : 'New sales order'}
      description="A draft commits no stock. Confirming makes it eligible for allocation."
      size="xl"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            {order ? 'Save draft' : 'Create sales order'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <FormField label="Customer" htmlFor="so-customer">
            <Select
              id="so-customer"
              value={form.values.customerId}
              onChange={(event) => {
                form.set('customerId', event.target.value);
                const customer = getCustomer(state, event.target.value);
                const address = customer?.shippingAddress ?? customer?.address;
                if (address) form.set('shippingAddress', formatAddress(address));
              }}
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Ship from" htmlFor="so-warehouse">
            <Select
              id="so-warehouse"
              value={form.values.warehouseId}
              onChange={(event) => form.set('warehouseId', event.target.value)}
            >
              {state.warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Order date" htmlFor="so-date">
            <TextInput
              id="so-date"
              type="date"
              value={form.values.date}
              onChange={(event) => form.set('date', event.target.value)}
            />
          </FormField>

          <FormField label="Requested ship" htmlFor="so-requested">
            <TextInput
              id="so-requested"
              type="date"
              value={form.values.requestedDate}
              onChange={(event) => form.set('requestedDate', event.target.value)}
            />
          </FormField>
        </div>

        <FormField label="Shipping address" htmlFor="so-address">
          <TextInput
            id="so-address"
            value={form.values.shippingAddress}
            onChange={(event) => form.set('shippingAddress', event.target.value)}
          />
        </FormField>

        <LineItemEditor
          lines={lines}
          products={state.products}
          onChange={setLines}
          defaultPrice={(product) => product.price}
          stockFor={stockFor}
        />

        {shortfall > 0 && (
          <p className="border border-app-warning/40 bg-app-warning/[0.06] rounded-[3px] px-3 py-2 text-[0.8125rem] text-charcoal">
            <Num>{shortfall}</Num> units exceed what is available at this warehouse. The order can
            still be taken — those units stay on backorder until stock arrives.
          </p>
        )}

        <DocumentTotals
          lines={lines}
          discount={form.values.discount}
          taxBps={form.values.taxBps}
          freight={form.values.freight}
          onChange={(patch) => {
            if (patch.discount !== undefined) form.set('discount', patch.discount);
            if (patch.taxBps !== undefined) form.set('taxBps', patch.taxBps);
            if (patch.freight !== undefined) form.set('freight', patch.freight);
          }}
        />

        <FormField label="Notes" htmlFor="so-notes" optional>
          <TextArea
            id="so-notes"
            rows={2}
            value={form.values.notes}
            onChange={(event) => form.set('notes', event.target.value)}
          />
        </FormField>

        {error && (
          <p role="alert" className="text-[0.8125rem] text-app-danger">
            {error}
          </p>
        )}

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Save
        </button>
      </form>
    </Dialog>
  );
}

// --------------------------------------------------------------- shipments

/**
 * Posting a shipment.
 *
 * This is the only action in the whole application that reduces physical stock,
 * and it can only ship what has been allocated, picked and packed. Each line
 * starts at the packed quantity, which is what is actually on the pallet.
 */
export function ShipmentForm({
  open,
  onClose,
  orderId,
  onPosted,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  onPosted?: () => void;
}) {
  const state = useWorkspace();
  const run = useCommand();
  const [error, setError] = useState('');

  const order = state.orders.find((entry) => entry.id === orderId);

  const shippable = useMemo(() => {
    if (!order) return [];
    return order.lines
      .map((line) => {
        const allocation = lineAllocation(state, order.id, line.id);
        const outstanding = line.quantity - shippedQuantity(state, order.id, line.id);
        const ready = Math.min(allocation?.packed ?? 0, outstanding);
        return { line, allocation, outstanding, ready };
      })
      .filter((row) => row.ready > 0);
  }, [order, state]);

  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const form = useForm({
    date: toDateOnly(new Date()),
    carrier: 'Regional Freight',
    tracking: '',
  });

  if (!order) return null;

  const valueFor = (lineId: string, ready: number) => quantities[lineId] ?? String(ready);

  const submit = () => {
    const lines = shippable
      .map((row) => ({
        lineId: row.line.id,
        quantity: Number(valueFor(row.line.id, row.ready)) || 0,
      }))
      .filter((row) => row.quantity > 0);

    if (lines.length === 0) {
      setError('Pack stock before posting a shipment.');
      return;
    }

    const failure = run(
      {
        type: 'shipment/post',
        orderId: order.id,
        lines,
        date: form.values.date,
        carrier: form.values.carrier.trim(),
        tracking: form.values.tracking.trim(),
      },
      'Shipment posted. Stock reduced and allocation released.',
    );

    if (failure) {
      setError(failure);
      return;
    }
    setError('');
    track('shipment_posted', { lines: lines.length });
    onClose();
    onPosted?.();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Post shipment — ${order.code}`}
      description="Posting reduces physical stock once and releases the matching allocation."
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={shippable.length === 0}>
            Post shipment
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Ship date" htmlFor="shipment-date">
            <TextInput
              id="shipment-date"
              type="date"
              value={form.values.date}
              onChange={(event) => form.set('date', event.target.value)}
            />
          </FormField>

          <FormField label="Carrier" htmlFor="shipment-carrier">
            <TextInput
              id="shipment-carrier"
              value={form.values.carrier}
              onChange={(event) => form.set('carrier', event.target.value)}
            />
          </FormField>

          <FormField label="Tracking" htmlFor="shipment-tracking" optional>
            <TextInput
              id="shipment-tracking"
              value={form.values.tracking}
              onChange={(event) => form.set('tracking', event.target.value)}
            />
          </FormField>
        </div>

        {shippable.length === 0 ? (
          <p className="text-[0.8125rem] text-muted">
            Nothing is packed on this order yet. Allocate, pick and pack it first.
          </p>
        ) : (
          <ul className="divide-y divide-app-border border-y border-app-border">
            {shippable.map((row) => {
              const product = state.products.find((entry) => entry.id === row.line.productId);
              return (
                <li key={row.line.id} className="py-3 flex flex-wrap items-end gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.875rem] text-charcoal">
                      {product?.sku} — {product?.name}
                    </p>
                    <p className="text-[0.75rem] text-muted">
                      {row.outstanding} outstanding · <Num>{row.ready}</Num> packed and ready
                    </p>
                  </div>
                  <div className="w-28">
                    <label
                      htmlFor={`shipment-qty-${row.line.id}`}
                      className="block text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted mb-1"
                    >
                      Shipping
                    </label>
                    <NumberInput
                      id={`shipment-qty-${row.line.id}`}
                      min="0"
                      max={String(row.ready)}
                      value={valueFor(row.line.id, row.ready)}
                      onChange={(value) =>
                        setQuantities((current) => ({ ...current, [row.line.id]: value }))
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {error && (
          <p role="alert" className="text-[0.8125rem] text-app-danger">
            {error}
          </p>
        )}

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Post
        </button>
      </form>
    </Dialog>
  );
}
