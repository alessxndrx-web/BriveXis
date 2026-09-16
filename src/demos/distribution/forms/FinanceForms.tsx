import { useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useCommand, useWorkspace } from '../DistributionProvider';
import type { Invoice, PaymentMethod } from '../distribution.types';
import { PAYMENT_METHODS } from '../domain/finance';
import { centsToInput, dayOffset, dollarsToCents, formatMoney, toDateOnly } from '../distribution.utils';
import { invoiceBalance, orderShipments } from '../distribution.selectors';
import { track } from '../../../lib/analytics';
import { Button, FormField, Select, TextInput } from '../../shared/ui/AppUI';
import { Dialog } from '../../shared/ui/Dialog';
import { MoneyInput, useForm } from '../../shared/ui/formControls';

/**
 * Invoicing and payment recording.
 *
 * Both are operational records. Nothing here processes a payment or contacts a
 * bank: an amount is written down because somebody took it elsewhere. The
 * notice says so rather than leaving the visitor to infer it.
 *
 * The invoice covers shipped quantities only. Discount and freight are prorated
 * to the shipped subtotal, so a partially cancelled order never bills for units
 * that never left the building.
 */

const DEMO_NOTICE = 'Demo only — no real transaction is processed.';

export function InvoiceForm({
  open,
  onClose,
  orderId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  onCreated?: () => void;
}) {
  const state = useWorkspace();
  const run = useCommand();
  const [error, setError] = useState('');

  const order = state.orders.find((entry) => entry.id === orderId);
  const shipments = orderShipments(state, orderId);
  const latestShipDate = useMemo(
    () => shipments.map((shipment) => shipment.date).sort().at(-1) ?? toDateOnly(new Date()),
    [shipments],
  );

  const invoiceDate = latestShipDate > toDateOnly(new Date()) ? latestShipDate : toDateOnly(new Date());

  const form = useForm({
    date: invoiceDate,
    dueDate: dayOffset(new Date(invoiceDate + 'T00:00:00'), state.settings.paymentTermsDays),
  });

  if (!order) return null;

  const submit = () => {
    const failure = run(
      { type: 'invoice/create', orderId: order.id, date: form.values.date, dueDate: form.values.dueDate },
      'Invoice created for the shipped quantities.',
    );

    if (failure) {
      setError(failure);
      return;
    }
    setError('');
    track('invoice_created');
    onClose();
    onCreated?.();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Invoice ${order.code}`}
      description="Shipped quantities only. Discount and freight are prorated to what shipped."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Create invoice
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
          <FormField label="Invoice date" htmlFor="invoice-date">
            <TextInput
              id="invoice-date"
              type="date"
              value={form.values.date}
              onChange={(event) => form.set('date', event.target.value)}
            />
          </FormField>

          <FormField label="Due date" htmlFor="invoice-due">
            <TextInput
              id="invoice-due"
              type="date"
              value={form.values.dueDate}
              onChange={(event) => form.set('dueDate', event.target.value)}
            />
          </FormField>
        </div>

        <p className="text-[0.8125rem] text-muted">
          Payment status and fulfillment status are independent in this system. An invoice being
          paid does not ship anything, and a shipment does not collect anything.
        </p>

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

export function PaymentForm({
  open,
  onClose,
  invoice,
  onPosted,
}: {
  open: boolean;
  onClose: () => void;
  invoice: Invoice;
  onPosted?: () => void;
}) {
  const state = useWorkspace();
  const run = useCommand();
  const [error, setError] = useState('');

  const balance = invoiceBalance(state, invoice);

  const form = useForm({
    amount: centsToInput(balance),
    date: toDateOnly(new Date()),
    method: 'ACH' as PaymentMethod,
    reference: '',
  });

  const submit = () => {
    const failure = run(
      {
        type: 'payment/post',
        invoiceId: invoice.id,
        date: form.values.date,
        amount: dollarsToCents(form.values.amount || '0'),
        method: form.values.method,
        reference: form.values.reference.trim(),
      },
      'Payment recorded.',
    );

    if (failure) {
      setError(failure);
      return;
    }
    setError('');
    track('demo_payment_recorded', { method: form.values.method });
    onClose();
    onPosted?.();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Record payment — ${invoice.code}`}
      description={DEMO_NOTICE}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Record payment
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
        <p className="flex items-start gap-2 border border-app-border bg-app-bg rounded-[3px] px-3 py-2 text-[0.8125rem] text-muted">
          <ShieldAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-copper" />
          This records a payment taken elsewhere. No card, bank or account details are collected
          anywhere in this demo and nothing is charged.
        </p>

        <FormField label="Amount" htmlFor="payment-amount">
          <MoneyInput
            id="payment-amount"
            value={form.values.amount}
            onChange={(value) => form.set('amount', value)}
          />
        </FormField>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => form.set('amount', centsToInput(balance))}>
            Pay full balance
          </Button>
          <Button size="sm" onClick={() => form.set('amount', centsToInput(Math.round(balance / 2)))}>
            Half
          </Button>
          <span className="ml-auto self-center text-[0.8125rem] text-muted">
            Balance {formatMoney(balance)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Received on" htmlFor="payment-date">
            <TextInput
              id="payment-date"
              type="date"
              value={form.values.date}
              onChange={(event) => form.set('date', event.target.value)}
            />
          </FormField>

          <FormField label="Method" htmlFor="payment-method">
            <Select
              id="payment-method"
              value={form.values.method}
              onChange={(event) => form.set('method', event.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Reference" htmlFor="payment-reference" optional>
            <TextInput
              id="payment-reference"
              placeholder="Check or transfer reference"
              value={form.values.reference}
              onChange={(event) => form.set('reference', event.target.value)}
            />
          </FormField>
        </div>

        {error && (
          <p role="alert" className="text-[0.8125rem] text-app-danger">
            {error}
          </p>
        )}

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Record
        </button>
      </form>
    </Dialog>
  );
}

export { DEMO_NOTICE };
