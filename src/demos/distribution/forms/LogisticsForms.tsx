import { useMemo, useState } from 'react';
import { useCommand, useWorkspace } from '../DistributionProvider';
import type { ReturnRecord } from '../distribution.types';
import { createId, toDateOnly } from '../distribution.utils';
import { getOrder, stock } from '../distribution.selectors';
import { returnedQuantity } from '../domain/logistics';
import { track } from '../../../lib/analytics';
import { Button, FormField, Select, TextInput } from '../../shared/ui/AppUI';
import { Dialog } from '../../shared/ui/Dialog';
import { NumberInput, useForm } from '../../shared/ui/formControls';
import { Num } from '../components/DataViews';

/**
 * Warehouse transfers and customer returns.
 *
 * Both post movements, so both go through the domain rather than touching a
 * quantity. The transfer form only offers unallocated stock, because units
 * already promised to a customer order cannot quietly move buildings.
 */

// -------------------------------------------------------------- transfers

export function TransferForm({
  open,
  onClose,
  productId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  productId?: string;
  onSaved?: () => void;
}) {
  const state = useWorkspace();
  const run = useCommand();
  const [error, setError] = useState('');

  const form = useForm({
    productId: productId ?? state.products[0]?.id ?? '',
    from: state.warehouses[0]?.id ?? '',
    to: state.warehouses[1]?.id ?? '',
    quantity: '1',
    note: '',
  });

  const source = stock(state, form.values.productId, form.values.from);

  const submit = () => {
    const failure = run(
      {
        type: 'transfer/save',
        transfer: {
          id: createId('transfer'),
          code: '',
          productId: form.values.productId,
          from: form.values.from,
          to: form.values.to,
          quantity: Number(form.values.quantity) || 0,
          status: 'Draft',
          date: toDateOnly(new Date()),
          note: form.values.note.trim(),
        },
      },
      'Transfer drafted. Ship it to move the stock.',
    );

    if (failure) {
      setError(failure);
      return;
    }
    setError('');
    onClose();
    onSaved?.();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New warehouse transfer"
      description="A draft moves nothing. Shipping it takes stock out; receiving it puts stock in."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Create transfer
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
        <FormField label="Product" htmlFor="transfer-product">
          <Select
            id="transfer-product"
            value={form.values.productId}
            onChange={(event) => form.set('productId', event.target.value)}
          >
            {state.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} — {product.name}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="From" htmlFor="transfer-from">
            <Select
              id="transfer-from"
              value={form.values.from}
              onChange={(event) => form.set('from', event.target.value)}
            >
              {state.warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="To" htmlFor="transfer-to">
            <Select
              id="transfer-to"
              value={form.values.to}
              onChange={(event) => form.set('to', event.target.value)}
            >
              {state.warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Quantity" htmlFor="transfer-quantity">
            <NumberInput
              id="transfer-quantity"
              min="1"
              max={String(Math.max(0, source.available))}
              value={form.values.quantity}
              onChange={(value) => form.set('quantity', value)}
            />
          </FormField>
        </div>

        <p className="text-[0.8125rem] text-muted">
          <Num>{source.available}</Num> available at the source warehouse. Allocated stock cannot be
          transferred — it is already promised to a customer order.
        </p>

        <FormField label="Note" htmlFor="transfer-note" optional>
          <TextInput
            id="transfer-note"
            placeholder="Rebalancing, branch request, seasonal move…"
            value={form.values.note}
            onChange={(event) => form.set('note', event.target.value)}
          />
        </FormField>

        {error && (
          <p role="alert" className="text-[0.8125rem] text-app-danger">
            {error}
          </p>
        )}

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Create
        </button>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------- returns

/**
 * Posting a customer return.
 *
 * The disposition is the decision that matters: sellable goods post a movement
 * and come back into stock, damaged goods are recorded but post nothing, so
 * they can never be allocated or shipped to the next customer.
 */
export function ReturnForm({
  open,
  onClose,
  shipmentId,
  onPosted,
}: {
  open: boolean;
  onClose: () => void;
  shipmentId: string;
  onPosted?: () => void;
}) {
  const state = useWorkspace();
  const run = useCommand();
  const [error, setError] = useState('');

  const shipment = state.shipments.find((entry) => entry.id === shipmentId);
  const order = getOrder(state, shipment?.orderId);

  const returnable = useMemo(() => {
    if (!shipment || !order) return [];
    return shipment.lines
      .map((line) => {
        const ordered = order.lines.find((entry) => entry.id === line.lineId);
        const already = returnedQuantity(state, shipment.id, line.lineId);
        return {
          lineId: line.lineId,
          product: state.products.find((entry) => entry.id === ordered?.productId),
          shipped: line.quantity,
          remaining: line.quantity - already,
        };
      })
      .filter((row) => row.remaining > 0);
  }, [shipment, order, state]);

  const [rows, setRows] = useState<Record<string, { quantity: string; disposition: string }>>({});

  const form = useForm({ date: toDateOnly(new Date()), reason: '' });

  if (!shipment || !order) return null;

  const rowFor = (lineId: string) => rows[lineId] ?? { quantity: '0', disposition: 'Return to Stock' };

  const submit = () => {
    const lines = returnable
      .map((row) => {
        const entry = rowFor(row.lineId);
        return {
          lineId: row.lineId,
          quantity: Number(entry.quantity) || 0,
          disposition: entry.disposition as ReturnRecord['disposition'],
          reason: form.values.reason.trim(),
        };
      })
      .filter((row) => row.quantity > 0);

    if (lines.length === 0) {
      setError('Enter at least one quantity to return.');
      return;
    }

    const failure = run(
      { type: 'return/post', shipmentId: shipment.id, lines, date: form.values.date },
      'Return posted.',
    );

    if (failure) {
      setError(failure);
      return;
    }
    setError('');
    track('customer_return_posted', { lines: lines.length });
    onClose();
    onPosted?.();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Return against ${shipment.code}`}
      description="A return is its own event. The original shipment stays posted."
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={returnable.length === 0}>
            Post return
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Return date" htmlFor="return-date">
            <TextInput
              id="return-date"
              type="date"
              value={form.values.date}
              onChange={(event) => form.set('date', event.target.value)}
            />
          </FormField>

          <FormField label="Reason" htmlFor="return-reason">
            <TextInput
              id="return-reason"
              placeholder="Over-ordered, damaged in transit, wrong item…"
              value={form.values.reason}
              onChange={(event) => form.set('reason', event.target.value)}
            />
          </FormField>
        </div>

        {returnable.length === 0 ? (
          <p className="text-[0.8125rem] text-muted">
            Everything on this shipment has already been returned.
          </p>
        ) : (
          <ul className="divide-y divide-app-border border-y border-app-border">
            {returnable.map((row) => (
              <li key={row.lineId} className="py-3 flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.875rem] text-charcoal">
                    {row.product?.sku} — {row.product?.name}
                  </p>
                  <p className="text-[0.75rem] text-muted">
                    {row.shipped} shipped · <Num>{row.remaining}</Num> still returnable
                  </p>
                </div>

                <div className="w-24">
                  <label
                    htmlFor={`return-qty-${row.lineId}`}
                    className="block text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted mb-1"
                  >
                    Quantity
                  </label>
                  <NumberInput
                    id={`return-qty-${row.lineId}`}
                    min="0"
                    max={String(row.remaining)}
                    value={rowFor(row.lineId).quantity}
                    onChange={(value) =>
                      setRows((current) => ({
                        ...current,
                        [row.lineId]: { ...rowFor(row.lineId), quantity: value },
                      }))
                    }
                  />
                </div>

                <div className="w-48">
                  <label
                    htmlFor={`return-disposition-${row.lineId}`}
                    className="block text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted mb-1"
                  >
                    Disposition
                  </label>
                  <Select
                    id={`return-disposition-${row.lineId}`}
                    value={rowFor(row.lineId).disposition}
                    onChange={(event) =>
                      setRows((current) => ({
                        ...current,
                        [row.lineId]: { ...rowFor(row.lineId), disposition: event.target.value },
                      }))
                    }
                  >
                    <option value="Return to Stock">Return to stock</option>
                    <option value="Damaged">Damaged — do not restock</option>
                  </Select>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-[0.75rem] text-muted">
          Stock returns and financial refunds are separate processes in this demo. Posting a return
          moves inventory; it does not credit the customer.
        </p>

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
