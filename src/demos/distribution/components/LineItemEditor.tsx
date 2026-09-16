import { Plus, Trash2 } from 'lucide-react';
import type { Line, Product } from '../distribution.types';
import { centsToInput, dollarsToCents, formatMoney, totals } from '../distribution.utils';
import { Button, IconButton, Select } from '../../shared/ui/AppUI';
import { MoneyInput, NumberInput } from '../../shared/ui/formControls';
import { Num } from './DataViews';

/**
 * Line editing for purchase orders and sales orders.
 *
 * Both documents are priced the same way — quantity times unit amount, then one
 * discount, one tax rate and freight applied to the document rather than the
 * line — so they share this editor. What differs is the price a line starts at
 * (cost inbound, list price outbound) and whether stock is shown, which is why
 * those are props rather than two copies of the component.
 */

export interface StockSnapshot {
  onHand: number;
  allocated: number;
  available: number;
}

interface LineItemEditorProps {
  lines: Line[];
  products: Product[];
  onChange: (lines: Line[]) => void;
  /** Unit amount for a freshly chosen product. */
  defaultPrice: (product: Product) => number;
  /**
   * Stock at the document's warehouse. Supplied for sales orders, where a
   * quantity the warehouse cannot cover has to be visible while it is typed —
   * not discovered later at allocation.
   */
  stockFor?: (productId: string) => StockSnapshot;
  error?: string;
}

export function LineItemEditor({
  lines,
  products,
  onChange,
  defaultPrice,
  stockFor,
  error,
}: LineItemEditorProps) {
  const used = new Set(lines.map((line) => line.productId));
  const available = products.filter((product) => product.active);

  const addLine = () => {
    const next = available.find((product) => !used.has(product.id)) ?? available[0];
    if (!next) return;
    onChange([
      ...lines,
      {
        id: `line-${Date.now().toString(36)}-${lines.length}`,
        productId: next.id,
        quantity: 1,
        unitPrice: defaultPrice(next),
      },
    ]);
  };

  const update = (id: string, patch: Partial<Line>) => {
    onChange(lines.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const figures = totals({ lines, discount: 0, taxBps: 0, freight: 0 });

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-[0.8125rem]">
          <caption className="sr-only">Document lines</caption>
          <thead>
            <tr className="border-b border-app-border text-[0.6875rem] uppercase tracking-[0.1em] text-muted">
              <th scope="col" className="py-2 text-left font-semibold">
                Product
              </th>
              {stockFor && (
                <th scope="col" className="py-2 text-right font-semibold w-40">
                  Stock
                </th>
              )}
              <th scope="col" className="py-2 text-right font-semibold w-24">
                Qty
              </th>
              <th scope="col" className="py-2 text-right font-semibold w-32">
                Unit
              </th>
              <th scope="col" className="py-2 text-right font-semibold w-28">
                Amount
              </th>
              <th scope="col" className="py-2 w-10">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const product = products.find((entry) => entry.id === line.productId);
              const snapshot = stockFor?.(line.productId);
              const short = snapshot ? line.quantity - snapshot.available : 0;

              return (
                <tr key={line.id} className="border-b border-app-border last:border-b-0">
                  <td className="py-2 pr-2">
                    <label className="sr-only" htmlFor={`line-product-${index}`}>
                      Product for line {index + 1}
                    </label>
                    <Select
                      id={`line-product-${index}`}
                      value={line.productId}
                      onChange={(event) => {
                        const chosen = products.find((entry) => entry.id === event.target.value);
                        update(line.id, {
                          productId: event.target.value,
                          unitPrice: chosen ? defaultPrice(chosen) : line.unitPrice,
                        });
                      }}
                    >
                      {available.map((entry) => (
                        <option
                          key={entry.id}
                          value={entry.id}
                          disabled={entry.id !== line.productId && used.has(entry.id)}
                        >
                          {entry.sku} — {entry.name}
                        </option>
                      ))}
                    </Select>
                  </td>

                  {stockFor && (
                    <td className="py-2 px-2 text-right">
                      {snapshot ? (
                        <>
                          <Num tone={snapshot.available <= 0 ? 'danger' : undefined}>
                            {snapshot.available} available
                          </Num>
                          <span className="block text-[0.6875rem] text-muted">
                            {snapshot.onHand} on hand · {snapshot.allocated} allocated
                          </span>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  )}

                  <td className="py-2 px-2">
                    <label className="sr-only" htmlFor={`line-quantity-${index}`}>
                      Quantity for line {index + 1}
                    </label>
                    <NumberInput
                      id={`line-quantity-${index}`}
                      min="1"
                      value={String(line.quantity)}
                      onChange={(value) => update(line.id, { quantity: Number(value) || 0 })}
                    />
                  </td>

                  <td className="py-2 px-2">
                    <label className="sr-only" htmlFor={`line-price-${index}`}>
                      Unit amount for line {index + 1}
                    </label>
                    <MoneyInput
                      id={`line-price-${index}`}
                      value={centsToInput(line.unitPrice)}
                      onChange={(value) => update(line.id, { unitPrice: dollarsToCents(value) })}
                    />
                  </td>

                  <td className="py-2 px-2 text-right">
                    <Num>{formatMoney(line.quantity * line.unitPrice)}</Num>
                    {short > 0 && (
                      <span className="block text-[0.6875rem] text-app-warning">
                        {short} short — will backorder
                      </span>
                    )}
                  </td>

                  <td className="py-2 text-right">
                    {lines.length > 1 && (
                      <IconButton
                        label={`Remove ${product?.name ?? 'line'}`}
                        onClick={() => onChange(lines.filter((entry) => entry.id !== line.id))}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </IconButton>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" onClick={addLine} disabled={used.size >= available.length}>
          <Plus size={13} aria-hidden="true" />
          Add line
        </Button>
        <span className="text-[0.8125rem] text-muted">
          Lines subtotal <Num>{formatMoney(figures.subtotal)}</Num>
        </span>
      </div>

      {error && (
        <p role="alert" className="text-[0.8125rem] text-app-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Discount, tax and freight, applied once to the whole document. */
export function DocumentTotals({
  lines,
  discount,
  taxBps,
  freight,
  onChange,
  editable = true,
}: {
  lines: Line[];
  discount: number;
  taxBps: number;
  freight: number;
  onChange?: (patch: { discount?: number; taxBps?: number; freight?: number }) => void;
  editable?: boolean;
}) {
  const figures = totals({ lines, discount, taxBps, freight });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {editable && onChange && (
        <div className="space-y-3">
          <div>
            <label
              htmlFor="document-discount"
              className="block text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted mb-1"
            >
              Discount
            </label>
            <MoneyInput
              id="document-discount"
              value={centsToInput(discount)}
              onChange={(value) => onChange({ discount: dollarsToCents(value) })}
            />
          </div>
          <div>
            <label
              htmlFor="document-tax"
              className="block text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted mb-1"
            >
              Tax rate %
            </label>
            <NumberInput
              id="document-tax"
              min="0"
              max="25"
              step="0.01"
              value={(taxBps / 100).toFixed(2)}
              onChange={(value) => onChange({ taxBps: Math.round((Number(value) || 0) * 100) })}
            />
          </div>
          <div>
            <label
              htmlFor="document-freight"
              className="block text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted mb-1"
            >
              Freight
            </label>
            <MoneyInput
              id="document-freight"
              value={centsToInput(freight)}
              onChange={(value) => onChange({ freight: dollarsToCents(value) })}
            />
          </div>
        </div>
      )}

      <dl className="space-y-1.5 text-[0.875rem] sm:col-start-2">
        <Row label="Subtotal" value={formatMoney(figures.subtotal)} />
        {discount > 0 && <Row label="Discount" value={`− ${formatMoney(discount)}`} />}
        <Row label={`Tax (${(taxBps / 100).toFixed(2)}%)`} value={formatMoney(figures.tax)} />
        {freight > 0 && <Row label="Freight" value={formatMoney(freight)} />}
        <div className="flex items-baseline justify-between gap-3 border-t border-app-border pt-2 font-medium">
          <dt className="text-charcoal">Total</dt>
          <dd className="tabular-nums text-charcoal">{formatMoney(figures.total)}</dd>
        </div>
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums text-charcoal">{value}</dd>
    </div>
  );
}
