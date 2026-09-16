import { useMemo, useState } from 'react';
import { useCommand, useWorkspace } from '../DistributionProvider';
import type { Line, PurchaseOrder } from '../distribution.types';
import { createId, dayOffset, formatMoney, toDateOnly, totals } from '../distribution.utils';
import { getSupplier, receivedQuantity } from '../distribution.selectors';
import { track } from '../../../lib/analytics';
import { Button, FormField, Select, TextArea, TextInput } from '../../shared/ui/AppUI';
import { Dialog } from '../../shared/ui/Dialog';
import { NumberInput, useForm } from '../../shared/ui/formControls';
import { DocumentTotals, LineItemEditor } from '../components/LineItemEditor';
import { Num } from '../components/DataViews';

/**
 * Purchase orders and receiving.
 *
 * The important rule lives in the domain, not here: ordering, submitting and
 * approving move no stock at all, and only a posted receipt does. What this
 * screen adds is making the remaining quantity visible while somebody counts a
 * pallet, so a short delivery is entered as what actually arrived rather than
 * as what was expected.
 */

// -------------------------------------------------------- purchase orders

export function PurchaseOrderForm({
  open,
  onClose,
  purchaseOrder,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  purchaseOrder?: PurchaseOrder;
  onSaved?: (id: string) => void;
}) {
  const state = useWorkspace();
  const run = useCommand();
  const [error, setError] = useState('');

  const suppliers = state.suppliers.filter((supplier) => supplier.active);
  const firstProduct = state.products.find((product) => product.active);

  const [lines, setLines] = useState<Line[]>(
    purchaseOrder?.lines.map((line) => ({ ...line })) ??
      (firstProduct
        ? [{ id: 'line-1', productId: firstProduct.id, quantity: 1, unitPrice: firstProduct.cost }]
        : []),
  );

  const form = useForm({
    supplierId: purchaseOrder?.supplierId ?? suppliers[0]?.id ?? '',
    warehouseId: purchaseOrder?.warehouseId ?? state.warehouses[0]?.id ?? '',
    date: purchaseOrder?.date ?? toDateOnly(new Date()),
    expectedDate: purchaseOrder?.expectedDate ?? dayOffset(new Date(), 7),
    discount: purchaseOrder?.discount ?? 0,
    taxBps: purchaseOrder?.taxBps ?? 0,
    freight: purchaseOrder?.freight ?? 0,
    notes: purchaseOrder?.notes ?? '',
  });

  const submit = () => {
    const id = purchaseOrder?.id ?? createId('po');
    const failure = run(
      {
        type: 'po/save',
        po: {
          id,
          code: purchaseOrder?.code ?? '',
          supplierId: form.values.supplierId,
          warehouseId: form.values.warehouseId,
          date: form.values.date,
          expectedDate: form.values.expectedDate,
          notes: form.values.notes.trim(),
          status: 'Draft',
          lines,
          discount: form.values.discount,
          taxBps: form.values.taxBps,
          freight: form.values.freight,
        },
      },
      purchaseOrder ? 'Purchase order updated.' : 'Purchase order drafted.',
    );

    if (failure) {
      setError(failure);
      return;
    }
    setError('');
    if (!purchaseOrder) track('purchase_order_created', { lines: lines.length });
    onClose();
    onSaved?.(id);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={purchaseOrder ? `Edit ${purchaseOrder.code}` : 'New purchase order'}
      description="A draft moves no stock. Inventory only changes when goods are received."
      size="xl"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            {purchaseOrder ? 'Save draft' : 'Create purchase order'}
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
          <FormField label="Supplier" htmlFor="po-supplier">
            <Select
              id="po-supplier"
              value={form.values.supplierId}
              onChange={(event) => form.set('supplierId', event.target.value)}
            >
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Deliver to" htmlFor="po-warehouse">
            <Select
              id="po-warehouse"
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

          <FormField label="Order date" htmlFor="po-date">
            <TextInput
              id="po-date"
              type="date"
              value={form.values.date}
              onChange={(event) => form.set('date', event.target.value)}
            />
          </FormField>

          <FormField label="Expected" htmlFor="po-expected">
            <TextInput
              id="po-expected"
              type="date"
              value={form.values.expectedDate}
              onChange={(event) => form.set('expectedDate', event.target.value)}
            />
          </FormField>
        </div>

        <LineItemEditor
          lines={lines}
          products={state.products}
          onChange={setLines}
          defaultPrice={(product) => product.cost}
        />

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

        <FormField label="Notes" htmlFor="po-notes" optional>
          <TextArea
            id="po-notes"
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

// -------------------------------------------------------------- receiving

/**
 * Receiving a delivery.
 *
 * Every line starts at the quantity still outstanding, because that is what a
 * full delivery looks like — but each is editable, because a short delivery is
 * the normal case this screen exists for. The domain refuses anything above the
 * remainder, so the same receipt can never be posted twice.
 */
export function ReceiptForm({
  open,
  onClose,
  purchaseOrderId,
  onPosted,
}: {
  open: boolean;
  onClose: () => void;
  purchaseOrderId: string;
  onPosted?: () => void;
}) {
  const state = useWorkspace();
  const run = useCommand();
  const [error, setError] = useState('');

  const po = state.purchaseOrders.find((entry) => entry.id === purchaseOrderId);

  const outstanding = useMemo(
    () =>
      (po?.lines ?? []).map((line) => ({
        line,
        remaining: line.quantity - receivedQuantity(state, po!.id, line.id),
      })),
    [po, state],
  );

  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(outstanding.map((row) => [row.line.id, String(Math.max(0, row.remaining))])),
  );

  const form = useForm({
    date: toDateOnly(new Date()),
    reference: '',
    notes: '',
  });

  if (!po) return null;

  const submit = () => {
    const lines = outstanding
      .map((row) => ({ lineId: row.line.id, quantity: Number(quantities[row.line.id]) || 0 }))
      .filter((row) => row.quantity > 0);

    if (lines.length === 0) {
      setError('Enter at least one received quantity.');
      return;
    }

    const failure = run(
      {
        type: 'receipt/post',
        poId: po.id,
        lines,
        date: form.values.date,
        reference: form.values.reference.trim(),
        notes: form.values.notes.trim(),
      },
      'Receipt posted. Inventory updated.',
    );

    if (failure) {
      setError(failure);
      return;
    }
    setError('');
    track('receipt_posted', { lines: lines.length });
    onClose();
    onPosted?.();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Receive goods — ${po.code}`}
      description="Only the quantities entered here become stock."
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Post receipt
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
          <FormField label="Receipt date" htmlFor="receipt-date">
            <TextInput
              id="receipt-date"
              type="date"
              value={form.values.date}
              onChange={(event) => form.set('date', event.target.value)}
            />
          </FormField>

          <FormField label="Packing slip" htmlFor="receipt-reference" optional>
            <TextInput
              id="receipt-reference"
              placeholder="PS-00000"
              value={form.values.reference}
              onChange={(event) => form.set('reference', event.target.value)}
            />
          </FormField>
        </div>

        <ul className="divide-y divide-app-border border-y border-app-border">
          {outstanding.map((row) => {
            const product = state.products.find((entry) => entry.id === row.line.productId);
            return (
              <li key={row.line.id} className="py-3 flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.875rem] text-charcoal">
                    {product?.sku} — {product?.name}
                  </p>
                  <p className="text-[0.75rem] text-muted">
                    {row.line.quantity} ordered · <Num>{row.remaining}</Num> still outstanding
                  </p>
                </div>
                <div className="w-28">
                  <label
                    htmlFor={`receipt-qty-${row.line.id}`}
                    className="block text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted mb-1"
                  >
                    Received
                  </label>
                  <NumberInput
                    id={`receipt-qty-${row.line.id}`}
                    min="0"
                    max={String(Math.max(0, row.remaining))}
                    value={quantities[row.line.id] ?? '0'}
                    onChange={(value) =>
                      setQuantities((current) => ({ ...current, [row.line.id]: value }))
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>

        <FormField label="Notes" htmlFor="receipt-notes" optional>
          <TextArea
            id="receipt-notes"
            rows={2}
            placeholder="Short shipment, damage on arrival, anything worth recording…"
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
          Post
        </button>
      </form>
    </Dialog>
  );
}

/** Ordered value of a purchase order, used in lists and headers. */
export const purchaseOrderTotal = (po: PurchaseOrder) => formatMoney(totals(po).total);

export const supplierName = (state: ReturnType<typeof useWorkspace>, id: string) =>
  getSupplier(state, id)?.name ?? 'Unknown supplier';
