import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import {
  LINE_ITEM_KINDS,
  UNITS,
  type LineItem,
  type LineItemKind,
  type Unit,
} from '../contractor.types';
import { centsToInput, createId, dollarsToCents, formatMoney } from '../contractor.utils';
import { documentTotals, lineTotal } from '../contractor.selectors';
import { Button, IconButton, Select, TextInput } from './AppUI';
import { MoneyInput, NumberInput } from '../forms/formUtils';

/**
 * Line item editor, shared by estimates and invoices.
 *
 * Both documents are priced the same way, so they use the same editor and the
 * same totals function — an invoice raised from an estimate can never compute
 * a different figure from the quote the customer accepted.
 *
 * Reordering is buttons rather than drag-and-drop: it works identically with a
 * mouse, a keyboard and a touch screen, which a drag handle would not.
 */

export function createEmptyItem(): LineItem {
  return {
    id: createId('li'),
    kind: 'Labor',
    description: '',
    quantity: 1,
    unit: 'each',
    unitPrice: 0,
  };
}

interface LineItemEditorProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  taxRate: number;
  onTaxRateChange: (rate: number) => void;
  discount: number;
  onDiscountChange: (discount: number) => void;
  error?: string;
}

export function LineItemEditor({
  items,
  onChange,
  taxRate,
  onTaxRateChange,
  discount,
  onDiscountChange,
  error,
}: LineItemEditorProps) {
  const totals = documentTotals({ items, taxRate, discount });

  const update = (id: string, patch: Partial<LineItem>) =>
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const remove = (id: string) => onChange(items.filter((item) => item.id !== id));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-[0.875rem]">
          <caption className="sr-only">Line items</caption>
          <thead>
            <tr className="border-b border-app-border">
              <th scope="col" className="w-32 px-2 py-2 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                Type
              </th>
              <th scope="col" className="px-2 py-2 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                Description
              </th>
              <th scope="col" className="w-20 px-2 py-2 text-right text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                Qty
              </th>
              <th scope="col" className="w-28 px-2 py-2 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                Unit
              </th>
              <th scope="col" className="w-32 px-2 py-2 text-right text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                Unit price
              </th>
              <th scope="col" className="w-28 px-2 py-2 text-right text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                Total
              </th>
              <th scope="col" className="w-24 px-2 py-2">
                <span className="sr-only">Row actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} className="border-b border-app-border/70">
                <td className="px-2 py-1.5">
                  <label htmlFor={`item-kind-${item.id}`} className="sr-only">
                    Item {index + 1} type
                  </label>
                  <Select
                    id={`item-kind-${item.id}`}
                    value={item.kind}
                    onChange={(event) => update(item.id, { kind: event.target.value as LineItemKind })}
                    className="h-8"
                  >
                    {LINE_ITEM_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-2 py-1.5">
                  <label htmlFor={`item-desc-${item.id}`} className="sr-only">
                    Item {index + 1} description
                  </label>
                  <TextInput
                    id={`item-desc-${item.id}`}
                    value={item.description}
                    placeholder="What is being supplied or performed"
                    onChange={(event) => update(item.id, { description: event.target.value })}
                    className="h-8"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <label htmlFor={`item-qty-${item.id}`} className="sr-only">
                    Item {index + 1} quantity
                  </label>
                  <NumberInput
                    id={`item-qty-${item.id}`}
                    step="0.25"
                    value={String(item.quantity)}
                    onChange={(value) => update(item.id, { quantity: Math.max(0, Number(value) || 0) })}
                    className="h-8"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <label htmlFor={`item-unit-${item.id}`} className="sr-only">
                    Item {index + 1} unit
                  </label>
                  <Select
                    id={`item-unit-${item.id}`}
                    value={item.unit}
                    onChange={(event) => update(item.id, { unit: event.target.value as Unit })}
                    className="h-8"
                  >
                    {UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-2 py-1.5">
                  <label htmlFor={`item-price-${item.id}`} className="sr-only">
                    Item {index + 1} unit price
                  </label>
                  <MoneyInput
                    id={`item-price-${item.id}`}
                    value={centsToInput(item.unitPrice)}
                    onChange={(value) => update(item.id, { unitPrice: dollarsToCents(value) })}
                    className="h-8"
                  />
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-charcoal">
                  {formatMoney(lineTotal(item))}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center justify-end gap-0.5">
                    <IconButton
                      label={`Move item ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      className="!w-7 !h-7"
                    >
                      <ChevronUp size={14} aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={`Move item ${index + 1} down`}
                      disabled={index === items.length - 1}
                      onClick={() => move(index, 1)}
                      className="!w-7 !h-7"
                    >
                      <ChevronDown size={14} aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={`Remove item ${index + 1}`}
                      onClick={() => remove(item.id)}
                      className="!w-7 !h-7 hover:!text-danger"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}

            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-6 text-center text-[0.875rem] text-muted">
                  No line items yet. Add the labor, materials and fees that make up this
                  document.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error && (
        <p role="alert" className="mt-2 px-2 text-[0.75rem] text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4 border-t border-app-border px-2 pt-3">
        <Button size="sm" onClick={() => onChange([...items, createEmptyItem()])}>
          <Plus size={13} aria-hidden="true" />
          Add line item
        </Button>

        <dl className="w-full sm:w-auto sm:min-w-[18rem] space-y-1.5" data-print="keep-together">
          <div className="flex items-center justify-between gap-6 text-[0.875rem]">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular-nums text-charcoal">{formatMoney(totals.subtotal)}</dd>
          </div>

          <div className="flex items-center justify-between gap-6 text-[0.875rem]">
            <dt>
              <label htmlFor="document-discount" className="text-muted">
                Discount
              </label>
            </dt>
            <dd className="w-28">
              <MoneyInput
                id="document-discount"
                value={centsToInput(discount)}
                onChange={(value) => onDiscountChange(dollarsToCents(value))}
                className="h-8"
              />
            </dd>
          </div>

          <div className="flex items-center justify-between gap-6 text-[0.875rem]">
            <dt>
              <label htmlFor="document-tax" className="text-muted">
                Tax rate (%)
              </label>
            </dt>
            <dd className="w-28">
              <NumberInput
                id="document-tax"
                max="25"
                step="0.01"
                value={String(taxRate)}
                onChange={(value) => onTaxRateChange(Math.max(0, Number(value) || 0))}
                className="h-8"
              />
            </dd>
          </div>

          <div className="flex items-center justify-between gap-6 text-[0.875rem]">
            <dt className="text-muted">Tax</dt>
            <dd className="tabular-nums text-charcoal">{formatMoney(totals.tax)}</dd>
          </div>

          <div className="flex items-center justify-between gap-6 border-t border-app-border pt-1.5">
            <dt className="font-semibold text-charcoal">Total</dt>
            <dd className="font-heading font-semibold text-[1.0625rem] tabular-nums text-charcoal">
              {formatMoney(totals.total)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

/** Read-only totals block for detail and print views. */
export function TotalsSummary({
  items,
  taxRate,
  discount,
  paid,
  balance,
}: {
  items: LineItem[];
  taxRate: number;
  discount: number;
  paid?: number;
  balance?: number;
}) {
  const totals = documentTotals({ items, taxRate, discount });

  return (
    <dl className="w-full sm:max-w-[20rem] sm:ml-auto space-y-1.5" data-print="keep-together">
      <div className="flex justify-between gap-6 text-[0.875rem]">
        <dt className="text-muted">Subtotal</dt>
        <dd className="tabular-nums text-charcoal">{formatMoney(totals.subtotal)}</dd>
      </div>
      {totals.discount > 0 && (
        <div className="flex justify-between gap-6 text-[0.875rem]">
          <dt className="text-muted">Discount</dt>
          <dd className="tabular-nums text-charcoal">−{formatMoney(totals.discount)}</dd>
        </div>
      )}
      <div className="flex justify-between gap-6 text-[0.875rem]">
        <dt className="text-muted">Tax ({taxRate}%)</dt>
        <dd className="tabular-nums text-charcoal">{formatMoney(totals.tax)}</dd>
      </div>
      <div className="flex justify-between gap-6 border-t border-app-border pt-1.5">
        <dt className="font-semibold text-charcoal">Total</dt>
        <dd className="font-heading font-semibold text-[1.0625rem] tabular-nums text-charcoal">
          {formatMoney(totals.total)}
        </dd>
      </div>
      {paid !== undefined && (
        <div className="flex justify-between gap-6 text-[0.875rem]">
          <dt className="text-muted">Paid to date</dt>
          <dd className="tabular-nums text-success">−{formatMoney(paid)}</dd>
        </div>
      )}
      {balance !== undefined && (
        <div className="flex justify-between gap-6 border-t border-app-border pt-1.5">
          <dt className="font-semibold text-charcoal">Balance due</dt>
          <dd
            className={`font-heading font-semibold text-[1.0625rem] tabular-nums ${
              balance <= 0 ? 'text-success' : 'text-charcoal'
            }`}
          >
            {formatMoney(Math.max(0, balance))}
          </dd>
        </div>
      )}
    </dl>
  );
}

/** Read-only line item table for detail and print views. */
export function LineItemTable({ items }: { items: LineItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-[0.875rem]">
        <caption className="sr-only">Line items</caption>
        <thead>
          <tr className="border-b border-app-border">
            <th scope="col" className="px-3 py-2 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
              Description
            </th>
            <th scope="col" className="w-24 px-3 py-2 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
              Type
            </th>
            <th scope="col" className="w-28 px-3 py-2 text-right text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
              Qty
            </th>
            <th scope="col" className="w-28 px-3 py-2 text-right text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
              Unit price
            </th>
            <th scope="col" className="w-28 px-3 py-2 text-right text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-app-border/70 last:border-b-0">
              <td className="px-3 py-2 text-charcoal">{item.description}</td>
              <td className="px-3 py-2 text-muted text-[0.8125rem]">{item.kind}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted">
                {item.quantity} {item.unit}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted">
                {formatMoney(item.unitPrice)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-charcoal">
                {formatMoney(lineTotal(item))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
