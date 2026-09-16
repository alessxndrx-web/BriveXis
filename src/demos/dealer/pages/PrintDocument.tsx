import { ReactNode, useEffect } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { useWorkspace } from '../DealerProvider';
import { paths } from '../dealer.routes';
import {
  dealPayments,
  dealTotals,
  depositPaid,
  getCustomer,
  getDeal,
  getPayment,
  getReservation,
  getVehicle,
  salespersonName,
} from '../dealer.selectors';
import {
  formatAddress,
  formatDate,
  formatMileage,
  formatMoney,
  formatPhone,
  vehicleTitle,
} from '../dealer.utils';
import { Button, EmptyState, LinkButton } from '../../shared/ui/AppUI';

/**
 * Printable reservation receipt, deal summary and payment receipt.
 *
 * A real print stylesheet rather than a PDF library: the browser's own print
 * pipeline produces the document, which keeps selectable text, correct page
 * breaks and no extra dependency. Application chrome is marked
 * `data-print="hide"` and disappears on paper.
 *
 * The deal document is called a Demo Deal Summary, not a buyer order. It is a
 * record of the figures, and it says so — it is not a contract and nothing in
 * it should be read as one.
 */

interface ShellProps {
  title: string;
  backHref: string;
  children: ReactNode;
}

function DocumentShell({ title, backHref, children }: ShellProps) {
  useEffect(() => {
    document.title = `${title} — Summit Auto & Motors`;
    return () => {
      document.title = 'Dealer Operations Demo | BriveXis';
    };
  }, [title]);

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
          <span className="text-[0.75rem] text-muted-dark">
            Demo document — fictional dealership, customer and vehicle
          </span>
          <Button size="sm" onClick={() => window.print()}>
            <Printer size={14} aria-hidden="true" />
            Print
          </Button>
        </div>
      </div>

      <div className="mx-auto my-6 max-w-[52rem] bg-white-surface border border-app-border print:my-0 print:max-w-none print:border-0">
        <div className="px-8 py-10 print:px-0 print:py-0">{children}</div>
      </div>
    </div>
  );
}

function Letterhead({ documentLabel, code, meta }: { documentLabel: string; code: string; meta: ReactNode }) {
  const state = useWorkspace();
  const { settings } = state;

  return (
    <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-charcoal pb-5">
      <div>
        <p className="font-heading font-bold text-[1.375rem] text-charcoal">{settings.companyName}</p>
        <p className="mt-1 text-[0.8125rem] text-muted">{formatAddress(settings.address)}</p>
        <p className="text-[0.8125rem] text-muted">
          {settings.phone} · {settings.email}
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

function Footnote() {
  return (
    <p className="mt-10 border-t border-app-border pt-4 text-[0.75rem] leading-relaxed text-muted">
      This document was produced by a BriveXis product demonstration. Summit Auto &amp; Motors, its
      customers, its vehicles and all figures shown are fictional. It is not an offer, a contract
      or a financing agreement.
    </p>
  );
}

// -------------------------------------------------------- reservation receipt

export function ReservationPrint({ reservationId }: { reservationId: string }) {
  const state = useWorkspace();
  const reservation = getReservation(state, reservationId);

  if (!reservation) {
    return (
      <EmptyState
        title="That reservation is not in this workspace"
        action={<LinkButton href={paths.module('reservations')}>Back to reservations</LinkButton>}
      />
    );
  }

  const customer = getCustomer(state, reservation.customerId);
  const vehicle = getVehicle(state, reservation.vehicleId);
  const paid = depositPaid(state, reservation.id);

  return (
    <DocumentShell title={`Reservation ${reservation.code}`} backHref={paths.reservation(reservation.id)}>
      <Letterhead
        documentLabel="Reservation"
        code={reservation.code}
        meta={
          <>
            <MetaRow label="Reserved" value={formatDate(reservation.reservedAt)} />
            <MetaRow label="Expires" value={formatDate(reservation.expiresAt)} />
            <MetaRow label="Status" value={reservation.status} />
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-6">
        <Party heading="Reserved for">
          <p className="font-medium text-charcoal">{customer?.name}</p>
          {customer && (
            <>
              <p className="text-[0.8125rem] text-muted">{formatAddress(customer.address)}</p>
              <p className="text-[0.8125rem] text-muted">{formatPhone(customer.phone)}</p>
            </>
          )}
        </Party>

        <Party heading="Vehicle">
          {vehicle ? (
            <>
              <p className="font-medium text-charcoal">{vehicleTitle(vehicle)}</p>
              <p className="text-[0.8125rem] text-muted">
                Stock {vehicle.code} · {formatMileage(vehicle.mileage)}
              </p>
              <p className="font-mono text-[0.75rem] text-muted">VIN {vehicle.vin}</p>
            </>
          ) : (
            <p className="text-muted">—</p>
          )}
        </Party>
      </div>

      <table className="w-full border-t border-app-border">
        <caption className="sr-only">Reservation amounts</caption>
        <tbody className="text-[0.875rem]">
          <tr className="border-b border-app-border">
            <th scope="row" className="py-2.5 text-left font-normal text-muted">
              Vehicle list price
            </th>
            <td className="py-2.5 text-right tabular-nums text-charcoal">
              {vehicle ? formatMoney(vehicle.listPrice) : '—'}
            </td>
          </tr>
          <tr className="border-b border-app-border">
            <th scope="row" className="py-2.5 text-left font-normal text-muted">
              Deposit requested
            </th>
            <td className="py-2.5 text-right tabular-nums text-charcoal">
              {formatMoney(reservation.requestedDeposit)}
            </td>
          </tr>
          <tr>
            <th scope="row" className="py-2.5 text-left font-medium text-charcoal">
              Deposit received
            </th>
            <td className="py-2.5 text-right tabular-nums font-medium text-charcoal">
              {formatMoney(paid)}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="mt-6 text-[0.8125rem] leading-relaxed text-muted">
        This reservation holds the vehicle above until {formatDate(reservation.expiresAt)}. The
        deposit is recorded against the sale if the reservation converts to a deal.
      </p>

      <div className="mt-10 grid grid-cols-2 gap-10">
        <div>
          <div className="border-t border-charcoal pt-1.5 text-[0.75rem] text-muted">
            Customer signature
          </div>
        </div>
        <div>
          <div className="border-t border-charcoal pt-1.5 text-[0.75rem] text-muted">Date</div>
        </div>
      </div>

      <Footnote />
    </DocumentShell>
  );
}

// ------------------------------------------------------------- deal summary

export function DealPrint({ dealId }: { dealId: string }) {
  const state = useWorkspace();
  const deal = getDeal(state, dealId);

  if (!deal) {
    return (
      <EmptyState
        title="That deal is not in this workspace"
        action={<LinkButton href={paths.module('deals')}>Back to deals</LinkButton>}
      />
    );
  }

  const customer = getCustomer(state, deal.customerId);
  const vehicle = getVehicle(state, deal.vehicleId);
  const totals = dealTotals(state, deal);
  const payments = dealPayments(state, deal.id);

  return (
    <DocumentShell title={`Deal summary ${deal.code}`} backHref={paths.deal(deal.id)}>
      <Letterhead
        documentLabel="Demo Deal Summary"
        code={deal.code}
        meta={
          <>
            <MetaRow label="Opened" value={formatDate(deal.openedAt)} />
            {deal.closedAt && <MetaRow label="Closed" value={formatDate(deal.closedAt)} />}
            <MetaRow label="Status" value={deal.status} />
            <MetaRow label="Plan" value={deal.plan} />
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-6">
        <Party heading="Purchaser">
          <p className="font-medium text-charcoal">{customer?.name}</p>
          {customer && (
            <>
              <p className="text-[0.8125rem] text-muted">{formatAddress(customer.address)}</p>
              <p className="text-[0.8125rem] text-muted">{formatPhone(customer.phone)}</p>
            </>
          )}
        </Party>

        <Party heading="Vehicle">
          {vehicle ? (
            <>
              <p className="font-medium text-charcoal">{vehicleTitle(vehicle)}</p>
              <p className="text-[0.8125rem] text-muted">
                Stock {vehicle.code} · {formatMileage(vehicle.mileage)} · {vehicle.condition}
              </p>
              <p className="font-mono text-[0.75rem] text-muted">VIN {vehicle.vin}</p>
            </>
          ) : (
            <p className="text-muted">—</p>
          )}
        </Party>
      </div>

      <table className="w-full border-t border-app-border">
        <caption className="sr-only">Deal figures</caption>
        <tbody className="text-[0.875rem]">
          <Line label="Sale price" value={formatMoney(deal.salePrice)} />
          {deal.discount > 0 && <Line label="Discount" value={`− ${formatMoney(deal.discount)}`} />}
          {deal.tradeIn && (
            <Line
              label={`Trade-in credit — ${deal.tradeIn.year} ${deal.tradeIn.make} ${deal.tradeIn.model} (dealer-entered estimate)`}
              value={`− ${formatMoney(totals.tradeCredit)}`}
            />
          )}
          <Line label={`Sales tax (${deal.taxRate}%)`} value={formatMoney(totals.tax)} />
          {deal.fees.map((fee) => (
            <Line key={fee.id} label={fee.label} value={formatMoney(fee.amount)} />
          ))}
          <tr className="border-t-2 border-charcoal">
            <th scope="row" className="py-3 text-left font-semibold text-charcoal">
              Total
            </th>
            <td className="py-3 text-right tabular-nums font-semibold text-charcoal">
              {formatMoney(totals.total)}
            </td>
          </tr>
          <Line label="Recorded payments" value={formatMoney(totals.paid)} />
          <tr className="border-t border-app-border">
            <th scope="row" className="py-2.5 text-left font-medium text-charcoal">
              Balance
            </th>
            <td className="py-2.5 text-right tabular-nums font-medium text-charcoal">
              {formatMoney(totals.balance)}
            </td>
          </tr>
          {deal.plan === 'Financing' && (
            <Line label="To be financed" value={formatMoney(totals.financedAmount)} />
          )}
        </tbody>
      </table>

      {payments.length > 0 && (
        <div className="mt-6">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted mb-2">
            Payments recorded
          </p>
          <table className="w-full text-[0.8125rem]">
            <caption className="sr-only">Payments recorded against this deal</caption>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-app-border last:border-b-0">
                  <td className="py-2 text-muted">
                    {formatDate(payment.receivedAt)} · {payment.kind} · {payment.method}
                  </td>
                  <td className="py-2 text-right tabular-nums text-charcoal">
                    {formatMoney(payment.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted mb-1.5">
          Terms
        </p>
        <p className="text-[0.8125rem] leading-relaxed text-muted">{state.settings.dealTerms}</p>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-10">
        <div className="border-t border-charcoal pt-1.5 text-[0.75rem] text-muted">
          Purchaser acknowledgement
        </div>
        <div className="border-t border-charcoal pt-1.5 text-[0.75rem] text-muted">Date</div>
      </div>

      <Footnote />
    </DocumentShell>
  );
}

// ---------------------------------------------------------- payment receipt

export function PaymentPrint({ paymentId }: { paymentId: string }) {
  const state = useWorkspace();
  const payment = getPayment(state, paymentId);

  if (!payment) {
    return (
      <EmptyState
        title="That payment is not in this workspace"
        action={<LinkButton href={paths.module('payments')}>Back to payments</LinkButton>}
      />
    );
  }

  const customer = getCustomer(state, payment.customerId);
  const deal = getDeal(state, payment.dealId);
  const reservation = getReservation(state, payment.reservationId);

  return (
    <DocumentShell title={`Receipt ${payment.code}`} backHref={paths.module('payments')}>
      <Letterhead
        documentLabel="Payment Receipt"
        code={payment.code}
        meta={
          <>
            <MetaRow label="Received" value={formatDate(payment.receivedAt)} />
            <MetaRow label="Method" value={payment.method} />
            <MetaRow label="Type" value={payment.kind} />
          </>
        }
      />

      <div className="py-6">
        <Party heading="Received from">
          <p className="font-medium text-charcoal">{customer?.name}</p>
          {customer && <p className="text-[0.8125rem] text-muted">{formatPhone(customer.phone)}</p>}
        </Party>
      </div>

      <table className="w-full border-t border-app-border">
        <caption className="sr-only">Payment amount</caption>
        <tbody className="text-[0.875rem]">
          {deal && <Line label="Applied to deal" value={deal.code} />}
          {reservation && <Line label="Applied to reservation" value={reservation.code} />}
          {payment.reference && <Line label="Reference" value={payment.reference} />}
          <tr className="border-t-2 border-charcoal">
            <th scope="row" className="py-3 text-left font-semibold text-charcoal">
              Amount
            </th>
            <td className="py-3 text-right tabular-nums font-semibold text-charcoal">
              {formatMoney(payment.amount)}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="mt-6 text-[0.8125rem] text-muted">
        Recorded by {salespersonName(state, state.salespeople[2]?.id)}. This is a demonstration
        record — no real transaction was processed.
      </p>

      <Footnote />
    </DocumentShell>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-app-border">
      <th scope="row" className="py-2.5 text-left font-normal text-muted">
        {label}
      </th>
      <td className="py-2.5 text-right tabular-nums text-charcoal">{value}</td>
    </tr>
  );
}
