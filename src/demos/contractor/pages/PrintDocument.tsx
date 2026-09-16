import { useEffect } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { useContractor } from '../ContractorProvider';
import { paths } from '../contractor.routes';
import {
  getCustomer,
  getJob,
  getLocation,
  invoiceBalance,
  invoicePaidAmount,
  invoicePayments,
  invoiceStatus,
} from '../contractor.selectors';
import { formatAddress, formatDate, formatMoney, formatPhone } from '../contractor.utils';
import { Button, EmptyState, LinkButton } from '../components/AppUI';
import { LineItemTable, TotalsSummary } from '../components/LineItemEditor';
import type { LineItem } from '../contractor.types';

/**
 * Printable estimate and invoice.
 *
 * A real print stylesheet rather than a PDF library: the browser's own print
 * pipeline produces the document, which keeps selectable text, correct page
 * breaks and no extra dependency. Everything that is application chrome is
 * marked `data-print="hide"` and disappears on paper.
 */

interface DocumentShellProps {
  title: string;
  backHref: string;
  children: React.ReactNode;
}

function DocumentShell({ title, backHref, children }: DocumentShellProps) {
  // The visitor arrived here to print, so the dialog is offered immediately —
  // but only once, and it can be dismissed to read the document on screen.
  useEffect(() => {
    document.title = `${title} — Northline Contracting`;
    return () => {
      document.title = 'Contractor Operations Demo | BriveXis';
    };
  }, [title]);

  return (
    <div className="min-h-screen bg-app-bg">
      <div
        data-print="hide"
        className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 bg-midnight px-4 py-2.5"
      >
        <LinkButton href={backHref} variant="ghost" size="sm" className="!text-muted-dark hover:!text-white-surface">
          <ArrowLeft size={14} aria-hidden="true" />
          Back to record
        </LinkButton>
        <div className="flex items-center gap-2">
          <span className="text-[0.75rem] text-muted-dark">
            Demo document — fictional company and customer
          </span>
          <Button size="sm" onClick={() => window.print()}>
            <Printer size={14} aria-hidden="true" />
            Print
          </Button>
        </div>
      </div>

      <div className="px-3 sm:px-6 py-6">
        <article
          data-print="document"
          className="mx-auto max-w-[52rem] bg-white border border-app-border rounded-[3px] p-6 sm:p-10"
        >
          {children}
        </article>
      </div>
    </div>
  );
}

interface LetterheadProps {
  documentLabel: string;
  documentCode: string;
  issuedLabel: string;
  issuedValue: string;
  secondLabel: string;
  secondValue: string;
  statusLabel: string;
}

function Letterhead({
  documentLabel,
  documentCode,
  issuedLabel,
  issuedValue,
  secondLabel,
  secondValue,
  statusLabel,
}: LetterheadProps) {
  const { state } = useContractor();
  const { settings } = state;

  return (
    <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-charcoal pb-5">
      <div>
        <p className="font-heading font-bold text-[1.375rem] tracking-tight text-charcoal">
          {settings.companyName}
        </p>
        <p className="mt-1 text-[0.8125rem] text-muted leading-relaxed">
          {formatAddress(settings.address)}
          <br />
          {formatPhone(settings.phone)} · {settings.email}
          <br />
          License {settings.license}
        </p>
      </div>

      <div className="text-right">
        <p className="font-heading font-bold text-[1.125rem] uppercase tracking-[0.1em] text-charcoal">
          {documentLabel}
        </p>
        <p className="mt-1 text-[0.9375rem] tabular-nums text-charcoal">{documentCode}</p>
        <dl className="mt-3 text-[0.8125rem] leading-relaxed">
          <div className="flex justify-end gap-3">
            <dt className="text-muted">{issuedLabel}</dt>
            <dd className="text-charcoal tabular-nums">{issuedValue}</dd>
          </div>
          <div className="flex justify-end gap-3">
            <dt className="text-muted">{secondLabel}</dt>
            <dd className="text-charcoal tabular-nums">{secondValue}</dd>
          </div>
          <div className="flex justify-end gap-3">
            <dt className="text-muted">Status</dt>
            <dd className="text-charcoal">{statusLabel}</dd>
          </div>
        </dl>
      </div>
    </header>
  );
}

function PartyBlock({
  label,
  name,
  lines,
}: {
  label: string;
  name: string;
  lines: string[];
}) {
  return (
    <div>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
      <p className="mt-1.5 text-[0.9375rem] font-medium text-charcoal">{name}</p>
      {lines.map((line) => (
        <p key={line} className="text-[0.8125rem] text-muted leading-relaxed">
          {line}
        </p>
      ))}
    </div>
  );
}

function DemoFooter() {
  return (
    <footer className="mt-8 border-t border-app-border pt-4">
      <p className="text-[0.75rem] text-muted">
        This document was produced by a BriveXis product demonstration. Northline Contracting,
        its customers and all figures shown are fictional.
      </p>
    </footer>
  );
}

// ------------------------------------------------------------- estimate

export function EstimatePrint({ estimateId }: { estimateId: string }) {
  const { state } = useContractor();
  const estimate = state.estimates.find((candidate) => candidate.id === estimateId);

  if (!estimate) {
    return (
      <EmptyState
        title="Estimate not found"
        action={<LinkButton href={paths.module('estimates')}>Back to estimates</LinkButton>}
      />
    );
  }

  const customer = getCustomer(state, estimate.customerId);
  const location = getLocation(state, estimate.locationId);

  return (
    <DocumentShell title={`Estimate ${estimate.code}`} backHref={paths.estimate(estimate.id)}>
      <Letterhead
        documentLabel="Estimate"
        documentCode={estimate.code}
        issuedLabel="Issued"
        issuedValue={formatDate(estimate.issuedAt)}
        secondLabel="Valid until"
        secondValue={formatDate(estimate.expiresAt)}
        statusLabel={estimate.status}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-5">
        <PartyBlock
          label="Prepared for"
          name={customer?.name ?? 'Customer'}
          lines={
            customer
              ? [
                  ...(customer.company ? [customer.company] : []),
                  formatAddress(customer.billingAddress),
                  formatPhone(customer.phone),
                ]
              : []
          }
        />
        <PartyBlock
          label="Service location"
          name={location?.label ?? 'Location'}
          lines={location ? [formatAddress(location.address)] : []}
        />
      </div>

      <h1 className="font-heading font-semibold text-[1.125rem] text-charcoal border-t border-app-border pt-5">
        {estimate.title}
      </h1>

      {estimate.scope && (
        <section className="mt-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
            Scope of work
          </p>
          <p className="mt-1.5 text-[0.875rem] text-charcoal leading-relaxed whitespace-pre-line">
            {estimate.scope}
          </p>
        </section>
      )}

      <section className="mt-6">
        <LineItemTable items={estimate.items} />
      </section>

      <section className="mt-5">
        <TotalsSummary
          items={estimate.items}
          taxRate={estimate.taxRate}
          discount={estimate.discount}
        />
      </section>

      {(estimate.notes || estimate.terms) && (
        <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-app-border pt-5">
          {estimate.notes && (
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
                Notes
              </p>
              <p className="mt-1.5 text-[0.8125rem] text-charcoal leading-relaxed">
                {estimate.notes}
              </p>
            </div>
          )}
          {estimate.terms && (
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
                Terms
              </p>
              <p className="mt-1.5 text-[0.8125rem] text-muted leading-relaxed">{estimate.terms}</p>
            </div>
          )}
        </section>
      )}

      <section className="mt-8 grid grid-cols-2 gap-8" data-print="keep-together">
        <div>
          <div className="h-10 border-b border-charcoal" />
          <p className="mt-1.5 text-[0.75rem] text-muted">Customer acceptance</p>
        </div>
        <div>
          <div className="h-10 border-b border-charcoal" />
          <p className="mt-1.5 text-[0.75rem] text-muted">Date</p>
        </div>
      </section>

      <DemoFooter />
    </DocumentShell>
  );
}

// -------------------------------------------------------------- invoice

export function InvoicePrint({ invoiceId }: { invoiceId: string }) {
  const { state } = useContractor();
  const invoice = state.invoices.find((candidate) => candidate.id === invoiceId);

  if (!invoice) {
    return (
      <EmptyState
        title="Invoice not found"
        action={<LinkButton href={paths.module('invoices')}>Back to invoices</LinkButton>}
      />
    );
  }

  const customer = getCustomer(state, invoice.customerId);
  const job = getJob(state, invoice.jobId);
  const location = getLocation(state, job?.locationId);
  const payments = invoicePayments(state, invoice.id);
  const paid = invoicePaidAmount(state, invoice.id);
  const balance = invoiceBalance(state, invoice);

  return (
    <DocumentShell title={`Invoice ${invoice.code}`} backHref={paths.invoice(invoice.id)}>
      <Letterhead
        documentLabel="Invoice"
        documentCode={invoice.code}
        issuedLabel="Issued"
        issuedValue={formatDate(invoice.issuedAt)}
        secondLabel="Due"
        secondValue={formatDate(invoice.dueAt)}
        statusLabel={invoiceStatus(state, invoice)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-5">
        <PartyBlock
          label="Bill to"
          name={customer?.name ?? 'Customer'}
          lines={
            customer
              ? [
                  ...(customer.company ? [customer.company] : []),
                  formatAddress(customer.billingAddress),
                  formatPhone(customer.phone),
                ]
              : []
          }
        />
        {location && (
          <PartyBlock
            label="Work performed at"
            name={location.label}
            lines={[formatAddress(location.address)]}
          />
        )}
      </div>

      {job && (
        <p className="border-t border-app-border pt-5 text-[0.875rem] text-charcoal">
          <span className="text-muted">For: </span>
          {job.title}
          <span className="text-muted"> ({job.code})</span>
        </p>
      )}

      <section className="mt-5">
        <LineItemTable items={invoice.items as LineItem[]} />
      </section>

      <section className="mt-5">
        <TotalsSummary
          items={invoice.items}
          taxRate={invoice.taxRate}
          discount={invoice.discount}
          paid={paid}
          balance={balance}
        />
      </section>

      {payments.length > 0 && (
        <section className="mt-8 border-t border-app-border pt-5" data-print="keep-together">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
            Payments received
          </p>
          <ul className="mt-2 space-y-1">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex justify-between gap-6 text-[0.8125rem] text-charcoal"
              >
                <span>
                  {formatDate(payment.receivedAt)} · {payment.method}
                  {payment.reference && ` · ${payment.reference}`}
                </span>
                <span className="tabular-nums">{formatMoney(payment.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {invoice.terms && (
        <section className="mt-8 border-t border-app-border pt-5">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
            Terms
          </p>
          <p className="mt-1.5 text-[0.8125rem] text-muted leading-relaxed">{invoice.terms}</p>
        </section>
      )}

      <DemoFooter />
    </DocumentShell>
  );
}
