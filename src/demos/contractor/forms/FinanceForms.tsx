import { useMemo, useState } from 'react';
import { Dialog } from '../components/Dialog';
import { Button, FormField, Select, TextInput } from '../components/AppUI';
import { MoneyInput, required, useForm, validPositiveAmount } from './formUtils';
import { useContractor } from '../ContractorProvider';
import {
  FOLLOW_UP_TYPES,
  PAYMENT_METHODS,
  type EntityRef,
  type FollowUpType,
  type Invoice,
  type PaymentMethod,
} from '../contractor.types';
import { invoiceBalance, invoiceTotal } from '../contractor.selectors';
import { centsToInput, dollarsToCents, formatMoney, toDateOnly } from '../contractor.utils';
import { track } from '../../../lib/analytics';

/**
 * Recording a payment and scheduling a follow-up.
 *
 * No real money moves anywhere. This records that a payment was received —
 * which is what a contractor's office actually does after a check arrives — so
 * the form never asks for card details and says so plainly.
 */

interface PaymentValues {
  amount: string;
  receivedAt: string;
  method: PaymentMethod;
  reference: string;
}

export function PaymentForm({
  open,
  onClose,
  invoice,
}: {
  open: boolean;
  onClose: () => void;
  invoice: Invoice;
}) {
  const { state, dispatch, notify } = useContractor();

  const balance = invoiceBalance(state, invoice);
  const total = invoiceTotal(invoice);

  const initial = useMemo<PaymentValues>(
    () => ({
      amount: centsToInput(balance),
      receivedAt: toDateOnly(new Date()),
      method: 'Check',
      reference: '',
    }),
    [balance],
  );

  const form = useForm<PaymentValues>(initial);
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const key = `${invoice.id}:${balance}`;
  if (open && seededFor !== key) {
    setSeededFor(key);
    form.reset(initial);
  }

  const entered = dollarsToCents(form.values.amount || '0');
  const remaining = Math.max(0, balance - entered);

  const submit = () => {
    const valid = form.validate((values) => {
      const errors: Record<string, string | undefined> = {
        amount: validPositiveAmount(values.amount, 'Payment amount'),
        receivedAt: required(values.receivedAt, 'Date received'),
      };
      // Overpayment would put the invoice into a credit balance the product
      // has no way to represent, so it is rejected rather than silently capped.
      if (!errors.amount && dollarsToCents(values.amount) > balance) {
        errors.amount = `Payment cannot exceed the ${formatMoney(balance)} balance.`;
      }
      return errors as never;
    });
    if (!valid) return;

    dispatch({
      type: 'payment/record',
      input: {
        invoiceId: invoice.id,
        amount: entered,
        receivedAt: form.values.receivedAt,
        method: form.values.method,
        reference: form.values.reference.trim() || undefined,
      },
    });

    track('demo_payment_recorded', {
      method: form.values.method,
      settlesInvoice: entered >= balance,
    });
    notify(
      entered >= balance
        ? `Payment recorded. ${invoice.code} is now paid in full.`
        : `Payment recorded against ${invoice.code}.`,
      'success',
    );
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Record payment — ${invoice.code}`}
      description="Demo only — no real transaction is processed and no card details are collected."
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
        <dl className="grid grid-cols-3 gap-3 border border-app-border rounded-[3px] px-3 py-2.5 bg-app-hover">
          <div>
            <dt className="text-[0.6875rem] uppercase tracking-[0.08em] text-muted">Invoice total</dt>
            <dd className="mt-0.5 text-[0.875rem] tabular-nums text-charcoal">{formatMoney(total)}</dd>
          </div>
          <div>
            <dt className="text-[0.6875rem] uppercase tracking-[0.08em] text-muted">Balance due</dt>
            <dd className="mt-0.5 text-[0.875rem] tabular-nums font-semibold text-charcoal">
              {formatMoney(balance)}
            </dd>
          </div>
          <div>
            <dt className="text-[0.6875rem] uppercase tracking-[0.08em] text-muted">
              After this payment
            </dt>
            <dd
              className={`mt-0.5 text-[0.875rem] tabular-nums ${
                remaining === 0 ? 'text-success font-semibold' : 'text-charcoal'
              }`}
            >
              {formatMoney(remaining)}
              {remaining === 0 && ' · Paid'}
            </dd>
          </div>
        </dl>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Payment amount" htmlFor="amount" error={form.errors.amount}>
            <MoneyInput
              id="amount"
              value={form.values.amount}
              invalid={Boolean(form.errors.amount)}
              onChange={(value) => form.set('amount', value)}
            />
          </FormField>

          <FormField label="Date received" htmlFor="receivedAt" error={form.errors.receivedAt}>
            <TextInput
              id="receivedAt"
              type="date"
              value={form.values.receivedAt}
              invalid={Boolean(form.errors.receivedAt)}
              onChange={(event) => form.set('receivedAt', event.target.value)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Method" htmlFor="method">
            <Select
              id="method"
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

          <FormField label="Reference" htmlFor="reference" optional hint="Check number, ACH trace…">
            <TextInput
              id="reference"
              value={form.values.reference}
              onChange={(event) => form.set('reference', event.target.value)}
            />
          </FormField>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => form.set('amount', centsToInput(balance))}
          >
            Pay full balance
          </Button>
          <Button
            size="sm"
            onClick={() => form.set('amount', centsToInput(Math.round(balance / 2)))}
          >
            Half
          </Button>
        </div>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Record
        </button>
      </form>
    </Dialog>
  );
}

// ------------------------------------------------------------- follow-ups

interface FollowUpValues {
  type: FollowUpType;
  title: string;
  dueAt: string;
}

export function FollowUpForm({
  open,
  onClose,
  relatesTo,
  defaultTitle = '',
}: {
  open: boolean;
  onClose: () => void;
  relatesTo: EntityRef;
  defaultTitle?: string;
}) {
  const { state, dispatch, notify } = useContractor();

  const initial = useMemo<FollowUpValues>(
    () => ({
      type: 'Call customer',
      title: defaultTitle,
      dueAt: toDateOnly(new Date(Date.now() + 86_400_000)),
    }),
    [defaultTitle],
  );

  const form = useForm<FollowUpValues>(initial);
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (open && seededFor !== relatesTo.id) {
    setSeededFor(relatesTo.id);
    form.reset(initial);
  }

  const submit = () => {
    const valid = form.validate((values) => ({
      title: required(values.title, 'Task'),
      dueAt: required(values.dueAt, 'Due date'),
    }));
    if (!valid) return;

    dispatch({
      type: 'followUp/create',
      input: {
        type: form.values.type,
        title: form.values.title.trim(),
        dueAt: form.values.dueAt,
        relatesTo,
        assignedUserId: state.users[1]?.id ?? 'usr-2',
      },
    });
    notify('Follow-up scheduled.', 'success');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Schedule follow-up"
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Schedule
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
        <FormField label="Type" htmlFor="type">
          <Select
            id="type"
            value={form.values.type}
            onChange={(event) => {
              const type = event.target.value as FollowUpType;
              form.set('type', type);
              if (!form.values.title.trim() || FOLLOW_UP_TYPES.includes(form.values.title as FollowUpType)) {
                form.set('title', type);
              }
            }}
          >
            {FOLLOW_UP_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Task" htmlFor="title" error={form.errors.title}>
          <TextInput
            id="title"
            value={form.values.title}
            invalid={Boolean(form.errors.title)}
            placeholder="What needs to happen?"
            onChange={(event) => form.set('title', event.target.value)}
          />
        </FormField>

        <FormField label="Due" htmlFor="dueAt" error={form.errors.dueAt}>
          <TextInput
            id="dueAt"
            type="date"
            value={form.values.dueAt}
            invalid={Boolean(form.errors.dueAt)}
            onChange={(event) => form.set('dueAt', event.target.value)}
          />
        </FormField>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Schedule
        </button>
      </form>
    </Dialog>
  );
}
