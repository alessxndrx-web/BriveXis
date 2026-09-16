import { useEffect, type ReactNode } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { useWorkspace } from '../DistributionProvider';
import type { DocumentAmounts } from '../distribution.types';
import { paths } from '../distribution.routes';
import {
  getCustomer,
  getOrder,
  getProduct,
  getSupplier,
  getWarehouse,
  invoiceBalance,
  invoicePaid,
  invoicePayments,
  receivedQuantity,
} from '../distribution.selectors';
import {
  formatAddress,
  formatDate,
  formatMoney,
  formatPhone,
  totals,
} from '../distribution.utils';
import { Button, EmptyState, LinkButton } from '../../shared/ui/AppUI';

/**
 * Printable purchase order, packing slip and invoice.
 *
 * The browser's own print pipeline produces these, driven by the print rules in
 * the global stylesheet. That keeps the text selectable, the page breaks sane
 * and the bundle free of a PDF library. Application chrome marks itself
 * `data-print="hide"` and disappears on paper.
 *
 * Each document says plainly that it came out of a demonstration, because a
 * printed page outlives the screen it came from.
 */

interface ShellProps {
  title: string;
  backHref: string;
  children: ReactNode;
}

function DocumentShell({ title, backHref, children }: ShellProps) {
  const { settings } = useWorkspace();

  useEffect(() => {
    document.title = `${title} — ${settings.companyName}`;
    return () => {
      document.title = 'Distribution Operations Demo | BriveXis';
    };
  }, [title, settings.companyName]);

  return (
    <div className="min-h-screen bg-app-bg">
      <div
        data-print="hide"
        className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 bg-midnight px-4 py-2.5"
      >
        <LinkButton
          href={backHref}
          variant="ghost"
          size="sm"
          className="!text-muted-dark hover:!text-white-surface"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to record
        </LinkButton>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[0.75rem] text-muted-dark">
            Demo document — fictional company, trading partners and figures
          </span>
          <Button size="sm" onClick={() => window.print()}>
            <Printer size={14} aria-hidden="true" />
            Print
          </Button>
        </div>
      </div>

      <div
        data-print="document"
        className="mx-auto my-6 max-w-[52rem] bg-white-surface border border-app-border print:my-0 print:max-w-none print:border-0"
      >
        <div className="px-6 sm:px-8 py-8 sm:py-10 print:px-0 print:py-0">{children}</div>
      </div>
    </div>
  );
}

function Letterhead({
  documentLabel,
  code,
  meta,
}: {
  documentLabel: string;
  code: string;
  meta: ReactNode;
}) {
  const { settings } = useWorkspace();

  return (
    <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-charcoal pb-5">
      <div>
        <p className="font-heading font-bold text-[1.375rem] text-charcoal">
          {settings.companyName}
        </p>
        <p className="mt-1 text-[0.8125rem] text-muted">{formatAddress(settings.address)}</p>
        <p className="text-[0.8125rem] text-muted">
          {formatPhone(settings.phone)} · {settings.email}
        </p>
        <p className="mt-1 text-[0.75rem] text-muted">{settings.legalLine}</p>
      </div>
      <div className="text-right">
        <p className="font-heading font-semibold uppercase tracking-[0.18em] text-[1rem] text-charcoal">
          {documentLabel}
        </p>
        <p className="mt-1 font-mono text-[0.9375rem] text-charcoal">{code}</p>
        <div className="mt-2 space-y-0.5 text-[0.8125rem]">{meta}</div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <p>
      <span className="text-muted">{label} </span>
      <span className="text-charcoal">{value}</span>
    </p>
  );
}

function Party({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted mb-1.5">
        {heading}
      </p>
      {children}
    </div>
  );
}

function Footnote({ extra }: { extra?: string }) {
  const { settings } = useWorkspace();

  return (
    <p className="mt-10 border-t border-app-border pt-4 text-[0.75rem] leading-relaxed text-muted">
      This document was produced by a BriveXis product demonstration. {settings.companyName}, its
      suppliers, its customers and all figures shown are fictional. It is not an offer, a contract
      or a demand for payment.
      {extra ? ` ${extra}` : ''}
    </p>
  );
}

/** Money summary block, shared by the purchase order and the invoice. */
function Totals({ document }: { document: DocumentAmounts }) {
  const amounts = totals(document);

  const rows: [string, number, boolean?][] = [
    ['Subtotal', amounts.subtotal],
    ['Discount', -document.discount],
    [`Tax (${(document.taxBps / 100).toFixed(2)}%)`, amounts.tax],
    ['Freight', document.freight],
  ];

  return (
    <div data-print="keep-together" className="mt-6 flex justify-end">
      <dl className="w-full sm:w-72 space-y-1.5 text-[0.875rem]">
        {rows.map(([label, value]) =>
          value === 0 && label !== 'Subtotal' ? null : (
            <div key={label} className="flex justify-between gap-6">
              <dt className="text-muted">{label}</dt>
              <dd className="tabular-nums text-charcoal">{formatMoney(value)}</dd>
            </div>
          ),
        )}
        <div className="flex justify-between gap-6 border-t border-charcoal pt-1.5 font-medium">
          <dt className="text-charcoal">Total</dt>
          <dd className="tabular-nums text-charcoal">{formatMoney(amounts.total)}</dd>
        </div>
      </dl>
    </div>
  );
}

const TH = 'py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted';
const TD = 'py-2.5 align-top text-[0.875rem] text-charcoal';

// ------------------------------------------------------- purchase order

export function PurchaseOrderPrint({ purchaseOrderId }: { purchaseOrderId: string }) {
  const state = useWorkspace();
  const po = state.purchaseOrders.find((entry) => entry.id === purchaseOrderId);

  if (!po) {
    return (
      <EmptyState
        title="That purchase order is not in this workspace"
        action={<LinkButton href={paths.module('purchasing')}>Back to purchasing</LinkButton>}
      />
    );
  }

  const supplier = getSupplier(state, po.supplierId);
  const warehouse = getWarehouse(state, po.warehouseId);

  return (
    <DocumentShell title={`Purchase Order ${po.code}`} backHref={paths.purchaseOrder(po.id)}>
      <Letterhead
        documentLabel="Purchase Order"
        code={po.code}
        meta={
          <>
            <MetaRow label="Ordered" value={formatDate(po.date)} />
            <MetaRow label="Expected" value={formatDate(po.expectedDate)} />
            <MetaRow label="Status" value={po.status} />
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-6">
        <Party heading="Supplier">
          {supplier ? (
            <>
              <p className="font-medium text-charcoal">{supplier.name}</p>
              <p className="text-[0.8125rem] text-muted">{formatAddress(supplier.address)}</p>
              {supplier.contact && (
                <p className="text-[0.8125rem] text-muted">
                  Attn: {supplier.contact}
                  {supplier.phone ? ` · ${formatPhone(supplier.phone)}` : ''}
                </p>
              )}
            </>
          ) : (
            <p className="text-muted">—</p>
          )}
        </Party>

        <Party heading="Deliver to">
          {warehouse ? (
            <>
              <p className="font-medium text-charcoal">{warehouse.name}</p>
              <p className="text-[0.8125rem] text-muted">{formatAddress(warehouse.address)}</p>
            </>
          ) : (
            <p className="text-muted">—</p>
          )}
        </Party>
      </div>

      <table className="w-full border-t border-app-border">
        <caption className="sr-only">Purchase order lines</caption>
        <thead>
          <tr className="border-b border-app-border text-left">
            <th scope="col" className={TH}>
              Item
            </th>
            <th scope="col" className={`${TH} text-right w-20`}>
              Ordered
            </th>
            <th scope="col" className={`${TH} text-right w-24`}>
              Received
            </th>
            <th scope="col" className={`${TH} text-right w-28`}>
              Unit cost
            </th>
            <th scope="col" className={`${TH} text-right w-28`}>
              Amount
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-app-border">
          {po.lines.map((line) => {
            const product = getProduct(state, line.productId);
            return (
              <tr key={line.id}>
                <td className={TD}>
                  <span className="font-mono text-[0.8125rem]">{product?.sku}</span>
                  <span className="block text-[0.8125rem] text-muted">{product?.name}</span>
                </td>
                <td className={`${TD} text-right tabular-nums`}>{line.quantity}</td>
                <td className={`${TD} text-right tabular-nums text-muted`}>
                  {receivedQuantity(state, po.id, line.id)}
                </td>
                <td className={`${TD} text-right tabular-nums`}>{formatMoney(line.unitPrice)}</td>
                <td className={`${TD} text-right tabular-nums`}>
                  {formatMoney(line.quantity * line.unitPrice)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Totals document={po} />

      {po.notes && (
        <div className="mt-6">
          <Party heading="Notes">
            <p className="text-[0.875rem] text-charcoal whitespace-pre-line">{po.notes}</p>
          </Party>
        </div>
      )}

      <Footnote extra="Quantities are confirmed at receiving; stock is only recorded when goods physically arrive." />
    </DocumentShell>
  );
}

// --------------------------------------------------------- packing slip

export function PackingSlipPrint({ shipmentId }: { shipmentId: string }) {
  const state = useWorkspace();
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
  const units = shipment.lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <DocumentShell title={`Packing Slip ${shipment.code}`} backHref={paths.shipment(shipment.id)}>
      <Letterhead
        documentLabel="Packing Slip"
        code={shipment.code}
        meta={
          <>
            <MetaRow label="Shipped" value={formatDate(shipment.date)} />
            <MetaRow label="Order" value={order?.code ?? '—'} />
            <MetaRow label="Carrier" value={shipment.carrier} />
            {shipment.tracking && <MetaRow label="Tracking" value={shipment.tracking} />}
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-6">
        <Party heading="Ship to">
          <p className="font-medium text-charcoal">{customer?.name}</p>
          <p className="text-[0.8125rem] text-muted whitespace-pre-line">
            {order?.shippingAddress}
          </p>
        </Party>

        <Party heading="Shipped from">
          {warehouse ? (
            <>
              <p className="font-medium text-charcoal">{warehouse.name}</p>
              <p className="text-[0.8125rem] text-muted">{formatAddress(warehouse.address)}</p>
            </>
          ) : (
            <p className="text-muted">—</p>
          )}
        </Party>
      </div>

      <table className="w-full border-t border-app-border">
        <caption className="sr-only">Packing slip lines</caption>
        <thead>
          <tr className="border-b border-app-border text-left">
            <th scope="col" className={TH}>
              Item
            </th>
            <th scope="col" className={`${TH} text-right w-24`}>
              Ordered
            </th>
            <th scope="col" className={`${TH} text-right w-24`}>
              Shipped
            </th>
            <th scope="col" className={`${TH} text-right w-28`}>
              Backordered
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-app-border">
          {shipment.lines.map((line) => {
            const orderLine = order?.lines.find((entry) => entry.id === line.lineId);
            const product = getProduct(state, orderLine?.productId);
            const remaining = Math.max(0, (orderLine?.quantity ?? 0) - line.quantity);
            return (
              <tr key={line.lineId}>
                <td className={TD}>
                  <span className="font-mono text-[0.8125rem]">{product?.sku}</span>
                  <span className="block text-[0.8125rem] text-muted">{product?.name}</span>
                </td>
                <td className={`${TD} text-right tabular-nums text-muted`}>
                  {orderLine?.quantity ?? 0}
                </td>
                <td className={`${TD} text-right tabular-nums`}>{line.quantity}</td>
                <td className={`${TD} text-right tabular-nums text-muted`}>
                  {remaining === 0 ? '—' : remaining}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div data-print="keep-together" className="mt-6 flex justify-end">
        <p className="text-[0.875rem] text-charcoal">
          <span className="text-muted">Total units in this shipment </span>
          <span className="tabular-nums font-medium">{units}</span>
        </p>
      </div>

      <p className="mt-6 text-[0.75rem] text-muted">
        No prices appear on a packing slip. Amounts are billed separately on the invoice.
      </p>

      <Footnote />
    </DocumentShell>
  );
}

// -------------------------------------------------------------- invoice

export function InvoicePrint({ invoiceId }: { invoiceId: string }) {
  const state = useWorkspace();
  const invoice = state.invoices.find((entry) => entry.id === invoiceId);

  if (!invoice) {
    return (
      <EmptyState
        title="That invoice is not in this workspace"
        action={<LinkButton href={paths.module('invoices')}>Back to invoices</LinkButton>}
      />
    );
  }

  const customer = getCustomer(state, invoice.customerId);
  const order = getOrder(state, invoice.orderId);
  const payments = invoicePayments(state, invoice.id);
  const paid = invoicePaid(state, invoice.id);
  const balance = invoice.status === 'Void' ? 0 : invoiceBalance(state, invoice);

  return (
    <DocumentShell title={`Invoice ${invoice.code}`} backHref={paths.invoice(invoice.id)}>
      <Letterhead
        documentLabel={invoice.status === 'Void' ? 'Invoice (Void)' : 'Invoice'}
        code={invoice.code}
        meta={
          <>
            <MetaRow label="Issued" value={formatDate(invoice.date)} />
            <MetaRow label="Due" value={formatDate(invoice.dueDate)} />
            <MetaRow label="Order" value={order?.code ?? '—'} />
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-6">
        <Party heading="Bill to">
          {customer ? (
            <>
              <p className="font-medium text-charcoal">{customer.name}</p>
              <p className="text-[0.8125rem] text-muted">{formatAddress(customer.address)}</p>
              {customer.phone && (
                <p className="text-[0.8125rem] text-muted">{formatPhone(customer.phone)}</p>
              )}
            </>
          ) : (
            <p className="text-muted">—</p>
          )}
        </Party>

        <Party heading="Ship to">
          <p className="text-[0.8125rem] text-muted whitespace-pre-line">
            {order?.shippingAddress ?? '—'}
          </p>
          <p className="mt-1.5 text-[0.8125rem] text-muted">Terms: {customer?.terms ?? '—'}</p>
        </Party>
      </div>

      <table className="w-full border-t border-app-border">
        <caption className="sr-only">Invoice lines</caption>
        <thead>
          <tr className="border-b border-app-border text-left">
            <th scope="col" className={TH}>
              Item
            </th>
            <th scope="col" className={`${TH} text-right w-24`}>
              Quantity
            </th>
            <th scope="col" className={`${TH} text-right w-28`}>
              Unit price
            </th>
            <th scope="col" className={`${TH} text-right w-28`}>
              Amount
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-app-border">
          {invoice.lines.map((line) => {
            const product = getProduct(state, line.productId);
            return (
              <tr key={line.id}>
                <td className={TD}>
                  <span className="font-mono text-[0.8125rem]">{product?.sku}</span>
                  <span className="block text-[0.8125rem] text-muted">{product?.name}</span>
                </td>
                <td className={`${TD} text-right tabular-nums`}>{line.quantity}</td>
                <td className={`${TD} text-right tabular-nums`}>{formatMoney(line.unitPrice)}</td>
                <td className={`${TD} text-right tabular-nums`}>
                  {formatMoney(line.quantity * line.unitPrice)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Totals document={invoice} />

      {payments.length > 0 && (
        <div data-print="keep-together" className="mt-6 flex justify-end">
          <dl className="w-full sm:w-72 space-y-1.5 text-[0.875rem]">
            {payments.map((payment) => (
              <div key={payment.id} className="flex justify-between gap-6">
                <dt className="text-muted">
                  {formatDate(payment.date)} · {payment.method}
                </dt>
                <dd className="tabular-nums text-charcoal">-{formatMoney(payment.amount)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-6 border-t border-charcoal pt-1.5 font-medium">
              <dt className="text-charcoal">Balance due</dt>
              <dd className="tabular-nums text-charcoal">{formatMoney(balance)}</dd>
            </div>
          </dl>
        </div>
      )}

      {payments.length === 0 && (
        <p className="mt-4 text-right text-[0.875rem] text-charcoal">
          <span className="text-muted">Balance due </span>
          <span className="tabular-nums font-medium">{formatMoney(balance)}</span>
        </p>
      )}

      <p className="mt-6 text-[0.75rem] text-muted">
        Billed for shipped quantities only. {paid > 0 ? `${formatMoney(paid)} recorded as paid. ` : ''}
        Demo only — no real transaction is processed and no payment can be made against this
        document.
      </p>

      <Footnote />
    </DocumentShell>
  );
}
