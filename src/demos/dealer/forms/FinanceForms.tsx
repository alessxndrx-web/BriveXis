import { useMemo } from 'react';
import { Info, ShieldAlert } from 'lucide-react';
import { useDealer } from '../DealerProvider';
import type { FinancingApplication, PaymentKind, PaymentMethod } from '../dealer.types';
import { FINANCING_STATUSES, PAYMENT_METHODS, TERM_PREFERENCES } from '../dealer.types';
import { dealTotals, getDeal, getVehicle } from '../dealer.selectors';
import {
  centsToInput,
  dollarsToCents,
  formatMoney,
  toDateOnly,
  vehicleTitle,
} from '../dealer.utils';
import { track } from '../../../lib/analytics';
import { Button, FormField, Select, TextArea, TextInput } from '../../shared/ui/AppUI';
import { Dialog } from '../../shared/ui/Dialog';
import { MoneyInput, useForm, validPositiveAmount, type Errors } from '../../shared/ui/formControls';

/**
 * Money and financing.
 *
 * Both are operational records. Nothing here processes a payment, contacts a
 * lender, or decides anything: an amount is written down because somebody took
 * it, and a financing status changes because somebody recorded what a lender
 * said. The notices in the UI say so plainly rather than relying on the visitor
 * to infer it.
 */

const DEMO_PAYMENT_NOTICE = 'Demo only — no real transaction is processed.';

// ---------------------------------------------------------------- payments

interface PaymentFormValues {
  amount: string;
  method: PaymentMethod;
  receivedAt: string;
  reference: string;
}

interface PaymentFormProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  kind: PaymentKind;
  dealId?: string;
  reservationId?: string;
  /** Pre-fills the amount, e.g. the outstanding balance. */
  suggestedAmount?: number;
  /** Rejects anything above this, e.g. the balance on a deal. */
  maximum?: number;
  title?: string;
}

export function PaymentForm({
  open,
  onClose,
  customerId,
  kind,
  dealId,
  reservationId,
  suggestedAmount = 0,
  maximum,
  title,
}: PaymentFormProps) {
  const { dispatch, notify } = useDealer();

  const initial = useMemo<PaymentFormValues>(
    () => ({
      amount: suggestedAmount ? centsToInput(suggestedAmount) : '',
      method: 'Card',
      receivedAt: toDateOnly(new Date()),
      reference: '',
    }),
    [suggestedAmount],
  );

  const form = useForm<PaymentFormValues>(initial);

  const validate = (values: PaymentFormValues): Errors<PaymentFormValues> => {
    const errors: Errors<PaymentFormValues> = {};
    errors.amount = validPositiveAmount(values.amount, 'Amount');

    if (!errors.amount && maximum !== undefined) {
      const entered = dollarsToCents(values.amount);
      if (entered > maximum) {
        errors.amount = `That is more than the ${formatMoney(maximum)} still outstanding.`;
      }
    }
    return errors;
  };

  const submit = () => {
    if (!form.validate(validate)) return;

    dispatch({
      type: 'payment/record',
      input: {
        customerId,
        kind,
        amount: dollarsToCents(form.values.amount),
        method: form.values.method,
        receivedAt: form.values.receivedAt,
        reference: form.values.reference.trim(),
        dealId,
        reservationId,
      },
    });

    // Method is a category; the amount and reference are never sent.
    track('demo_payment_recorded', { kind, method: form.values.method });
    notify('Payment recorded.', 'success');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title ?? `Record ${kind.toLowerCase()}`}
      description={DEMO_PAYMENT_NOTICE}
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
          This records a payment that was taken elsewhere. No card details are collected and
          nothing is charged.
        </p>

        <FormField label="Amount" htmlFor="payment-amount" error={form.errors.amount}>
          <MoneyInput
            id="payment-amount"
            value={form.values.amount}
            invalid={Boolean(form.errors.amount)}
            onChange={(value) => form.set('amount', value)}
          />
        </FormField>

        {maximum !== undefined && maximum > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => form.set('amount', centsToInput(maximum))}>
              Pay full balance
            </Button>
            <Button size="sm" onClick={() => form.set('amount', centsToInput(Math.round(maximum / 2)))}>
              Half
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Received on" htmlFor="payment-received">
            <TextInput
              id="payment-received"
              type="date"
              value={form.values.receivedAt}
              onChange={(event) => form.set('receivedAt', event.target.value)}
            />
          </FormField>

          <FormField label="Method" htmlFor="payment-method-field">
            <Select
              id="payment-method-field"
              value={form.values.method}
              onChange={(event) => form.set('method', event.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField label="Reference" htmlFor="payment-reference" optional>
          <TextInput
            id="payment-reference"
            placeholder="Check number, receipt number…"
            value={form.values.reference}
            onChange={(event) => form.set('reference', event.target.value)}
          />
        </FormField>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Record
        </button>
      </form>
    </Dialog>
  );
}

// --------------------------------------------------------------- financing

const COMPLIANCE_NOTICE =
  'Demo workflow only — no real credit decision or financing submission is performed.';

interface FinancingFormValues {
  amountRequested: string;
  downPayment: string;
  termMonths: string;
  lenderCategory: string;
  financeContactId: string;
}

const LENDER_CATEGORIES = [
  'Bank partner',
  'Credit union partner',
  'Captive finance',
  'Powersports lender',
  'Commercial lender',
];

/** Opens the operational tracker for a deal that is being financed. */
export function FinancingForm({
  open,
  onClose,
  dealId,
}: {
  open: boolean;
  onClose: () => void;
  dealId: string;
}) {
  const { state, dispatch, notify } = useDealer();
  const deal = getDeal(state, dealId);
  const totals = deal ? dealTotals(state, deal) : undefined;

  const initial = useMemo<FinancingFormValues>(
    () => ({
      amountRequested: totals ? centsToInput(Math.max(0, totals.total - (deal?.downPayment ?? 0))) : '',
      downPayment: deal ? centsToInput(deal.downPayment) : '',
      termMonths: '60',
      lenderCategory: LENDER_CATEGORIES[0],
      financeContactId:
        state.salespeople.find((person) => person.role === 'finance')?.id ?? state.salespeople[0].id,
    }),
    [deal, totals, state.salespeople],
  );

  const form = useForm<FinancingFormValues>(initial);

  if (!deal) return null;
  const vehicle = getVehicle(state, deal.vehicleId);

  const validate = (values: FinancingFormValues): Errors<FinancingFormValues> => ({
    amountRequested: validPositiveAmount(values.amountRequested, 'Amount requested'),
  });

  const submit = () => {
    if (!form.validate(validate)) return;

    dispatch({
      type: 'financing/create',
      input: {
        customerId: deal.customerId,
        dealId: deal.id,
        vehicleId: deal.vehicleId,
        amountRequested: dollarsToCents(form.values.amountRequested),
        downPayment: dollarsToCents(form.values.downPayment || '0'),
        termMonths: Number(form.values.termMonths) as FinancingApplication['termMonths'],
        lenderCategory: form.values.lenderCategory,
        financeContactId: form.values.financeContactId,
      },
    });
    notify('Financing application opened.', 'success');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Financing application — ${deal.code}`}
      description={COMPLIANCE_NOTICE}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Open application
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
          <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-copper" />
          This tracks where an application is in the process. It does not assess credit, contact a
          lender, or produce a decision — a person records the outcome when one arrives. No Social
          Security number, bank credentials or account details are collected.
        </p>

        {vehicle && (
          <p className="text-[0.8125rem] text-muted">
            {vehicle.code} — {vehicleTitle(vehicle)} · Deal total{' '}
            {totals ? formatMoney(totals.total) : '—'}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label="Amount requested"
            htmlFor="financing-amount"
            error={form.errors.amountRequested}
          >
            <MoneyInput
              id="financing-amount"
              value={form.values.amountRequested}
              invalid={Boolean(form.errors.amountRequested)}
              onChange={(value) => form.set('amountRequested', value)}
            />
          </FormField>

          <FormField label="Down payment" htmlFor="financing-down">
            <MoneyInput
              id="financing-down"
              value={form.values.downPayment}
              onChange={(value) => form.set('downPayment', value)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Term preference" htmlFor="financing-term">
            <Select
              id="financing-term"
              value={form.values.termMonths}
              onChange={(event) => form.set('termMonths', event.target.value)}
            >
              {TERM_PREFERENCES.map((option) => (
                <option key={option} value={String(option)}>
                  {option} months
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Lender category" htmlFor="financing-lender">
            <Select
              id="financing-lender"
              value={form.values.lenderCategory}
              onChange={(event) => form.set('lenderCategory', event.target.value)}
            >
              {LENDER_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Finance contact" htmlFor="financing-contact">
            <Select
              id="financing-contact"
              value={form.values.financeContactId}
              onChange={(event) => form.set('financeContactId', event.target.value)}
            >
              {state.salespeople.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Open
        </button>
      </form>
    </Dialog>
  );
}

/** Records what a lender said. The demo never decides this for anyone. */
export function FinancingStatusForm({
  open,
  onClose,
  application,
}: {
  open: boolean;
  onClose: () => void;
  application: FinancingApplication;
}) {
  const { dispatch, notify } = useDealer();

  const form = useForm({
    status: application.status,
    notes: application.decisionNotes,
  });

  const submit = () => {
    dispatch({
      type: 'financing/status',
      id: application.id,
      status: form.values.status,
      notes: form.values.notes.trim(),
    });
    track('financing_status_changed', { status: form.values.status });
    notify(`${application.code} recorded as ${form.values.status}.`, 'success');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Update ${application.code}`}
      description={COMPLIANCE_NOTICE}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Record status
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
        <FormField label="Application status" htmlFor="financing-status">
          <Select
            id="financing-status"
            value={form.values.status}
            onChange={(event) =>
              form.set('status', event.target.value as FinancingApplication['status'])
            }
          >
            {FINANCING_STATUSES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Notes from the finance desk" htmlFor="financing-notes" optional>
          <TextArea
            id="financing-notes"
            rows={3}
            placeholder="What the lender said, any conditions attached…"
            value={form.values.notes}
            onChange={(event) => form.set('notes', event.target.value)}
          />
        </FormField>

        <p className="text-[0.75rem] text-muted">
          Recording an approval moves the deal on to its documents. It never closes the sale — that
          stays a decision somebody makes.
        </p>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Record
        </button>
      </form>
    </Dialog>
  );
}

export { DEMO_PAYMENT_NOTICE, COMPLIANCE_NOTICE };
