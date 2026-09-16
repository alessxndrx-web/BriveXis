import { useMemo, useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { useDealer } from '../DealerProvider';
import type { Deal, PaymentPlan } from '../dealer.types';
import { DELIVERY_CHECKS, PAYMENT_PLANS } from '../dealer.types';
import {
  availableVehicles,
  checkVehicleAvailability,
  closeReadiness,
  dealTotals,
  deliveryReadiness,
  getDeal,
  getReservation,
  getVehicle,
} from '../dealer.selectors';
import {
  centsToInput,
  dollarsToCents,
  formatMoney,
  vehicleTitle,
} from '../dealer.utils';
import { track } from '../../../lib/analytics';
import {
  Button,
  Checkbox,
  FormField,
  Select,
  TextArea,
  TextInput,
} from '../../shared/ui/AppUI';
import { ConfirmDialog, Dialog } from '../../shared/ui/Dialog';
import {
  MoneyInput,
  NumberInput,
  useForm,
  validAmount,
  validPositiveAmount,
  type Errors,
} from '../../shared/ui/formControls';

/**
 * Deals — pricing, trade-in, closing and delivery.
 *
 * The close dialog asks the same readiness question the deal screen shows, so
 * what the visitor is told and what the reducer enforces are the same rule.
 */

/**
 * A blank optional money field means zero.
 *
 * `validAmount` rejects a blank, which is right for an amount that must be
 * given and wrong for one that need not be: a cash deal has no down payment,
 * and making somebody type "0" to get past the form is a dead end.
 */
const optionalAmount = (value: string, label: string) =>
  value.trim() ? validAmount(value, label) : undefined;

// -------------------------------------------------------------- create deal

interface DealFormValues {
  customerId: string;
  vehicleId: string;
  salespersonId: string;
  plan: PaymentPlan;
  salePrice: string;
  discount: string;
  downPayment: string;
  notes: string;
}

interface DealFormProps {
  open: boolean;
  onClose: () => void;
  /** Starts the deal from a reservation, carrying its customer and vehicle. */
  reservationId?: string;
  vehicleId?: string;
  customerId?: string;
  onCreated?: (dealId: string) => void;
}

export function DealForm({
  open,
  onClose,
  reservationId,
  vehicleId,
  customerId,
  onCreated,
}: DealFormProps) {
  const { state, dispatch, notify } = useDealer();
  const reservation = getReservation(state, reservationId);

  const sourceVehicleId = reservation?.vehicleId ?? vehicleId ?? '';
  const sourceVehicle = getVehicle(state, sourceVehicleId);

  const initial = useMemo<DealFormValues>(
    () => ({
      customerId: reservation?.customerId ?? customerId ?? '',
      vehicleId: sourceVehicleId,
      salespersonId:
        reservation?.salespersonId ?? state.salespeople[1]?.id ?? state.salespeople[0].id,
      plan: 'Financing',
      salePrice: sourceVehicle ? centsToInput(sourceVehicle.listPrice) : '',
      discount: '0',
      downPayment: '',
      notes: '',
    }),
    [reservation, customerId, sourceVehicleId, sourceVehicle, state.salespeople],
  );

  const form = useForm<DealFormValues>(initial);

  // A vehicle held by the reservation this deal comes from is legitimately
  // "unavailable", so it stays selectable here.
  const options = useMemo(() => {
    const open = availableVehicles(state);
    const current = getVehicle(state, form.values.vehicleId);
    return current && !open.some((entry) => entry.id === current.id) ? [current, ...open] : open;
  }, [state, form.values.vehicleId]);

  const validate = (values: DealFormValues): Errors<DealFormValues> => {
    const errors: Errors<DealFormValues> = {};
    if (!values.customerId) errors.customerId = 'Choose the customer buying the vehicle.';
    if (!values.vehicleId) errors.vehicleId = 'Choose a vehicle.';
    errors.salePrice = validPositiveAmount(values.salePrice, 'Sale price');
    errors.discount = optionalAmount(values.discount, 'Discount');
    errors.downPayment = optionalAmount(values.downPayment, 'Down payment');

    if (!errors.salePrice && !errors.discount) {
      if (dollarsToCents(values.discount || '0') > dollarsToCents(values.salePrice)) {
        errors.discount = 'A discount cannot be larger than the sale price.';
      }
    }
    return errors;
  };

  const submit = () => {
    if (!form.validate(validate)) return;

    // A vehicle already committed elsewhere cannot start a second deal.
    if (!reservation) {
      const check = checkVehicleAvailability(state, form.values.vehicleId);
      if (!check.available) {
        form.setErrors({ vehicleId: check.reason });
        return;
      }
    }

    const id = `deal_${Date.now().toString(36)}`;
    dispatch({
      type: 'deal/create',
      id,
      input: {
        customerId: form.values.customerId,
        vehicleId: form.values.vehicleId,
        salespersonId: form.values.salespersonId,
        reservationId,
        plan: form.values.plan,
        salePrice: dollarsToCents(form.values.salePrice),
        discount: dollarsToCents(form.values.discount || '0'),
        taxRate: state.settings.defaultTaxRate,
        downPayment: dollarsToCents(form.values.downPayment || '0'),
        notes: form.values.notes.trim(),
      },
    });
    track('deal_created', { plan: form.values.plan, fromReservation: Boolean(reservationId) });
    notify('Deal opened.', 'success');
    onClose();
    onCreated?.(id);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New deal"
      description={
        reservation
          ? `Converting ${reservation.code} into a deal.`
          : 'Open a deal against a vehicle and a customer.'
      }
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Create deal
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
          <FormField label="Customer" htmlFor="deal-customer" error={form.errors.customerId}>
            <Select
              id="deal-customer"
              value={form.values.customerId}
              invalid={Boolean(form.errors.customerId)}
              onChange={(event) => form.set('customerId', event.target.value)}
            >
              <option value="">Select a customer</option>
              {state.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} — {customer.code}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Vehicle" htmlFor="deal-vehicle" error={form.errors.vehicleId}>
            <Select
              id="deal-vehicle"
              value={form.values.vehicleId}
              invalid={Boolean(form.errors.vehicleId)}
              onChange={(event) => {
                form.set('vehicleId', event.target.value);
                const next = getVehicle(state, event.target.value);
                if (next) form.set('salePrice', centsToInput(next.listPrice));
              }}
            >
              <option value="">Select a vehicle</option>
              {options.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.code} — {vehicleTitle(vehicle)}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Payment plan" htmlFor="deal-plan">
            <Select
              id="deal-plan"
              value={form.values.plan}
              onChange={(event) => form.set('plan', event.target.value as PaymentPlan)}
            >
              {PAYMENT_PLANS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Salesperson" htmlFor="deal-salesperson">
            <Select
              id="deal-salesperson"
              value={form.values.salespersonId}
              onChange={(event) => form.set('salespersonId', event.target.value)}
            >
              {state.salespeople.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Sale price" htmlFor="deal-price" error={form.errors.salePrice}>
            <MoneyInput
              id="deal-price"
              value={form.values.salePrice}
              invalid={Boolean(form.errors.salePrice)}
              onChange={(value) => form.set('salePrice', value)}
            />
          </FormField>

          <FormField label="Discount" htmlFor="deal-discount" error={form.errors.discount} optional>
            <MoneyInput
              id="deal-discount"
              value={form.values.discount}
              invalid={Boolean(form.errors.discount)}
              onChange={(value) => form.set('discount', value)}
            />
          </FormField>

          <FormField label="Down payment" htmlFor="deal-down" error={form.errors.downPayment} optional>
            <MoneyInput
              id="deal-down"
              value={form.values.downPayment}
              invalid={Boolean(form.errors.downPayment)}
              onChange={(value) => form.set('downPayment', value)}
            />
          </FormField>
        </div>

        <FormField label="Notes" htmlFor="deal-notes" optional>
          <TextArea
            id="deal-notes"
            rows={2}
            value={form.values.notes}
            onChange={(event) => form.set('notes', event.target.value)}
          />
        </FormField>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Create
        </button>
      </form>
    </Dialog>
  );
}

// ------------------------------------------------------------ pricing edit

export function DealPricingForm({
  open,
  onClose,
  deal,
}: {
  open: boolean;
  onClose: () => void;
  deal: Deal;
}) {
  const { dispatch, notify } = useDealer();

  const form = useForm({
    salePrice: centsToInput(deal.salePrice),
    discount: centsToInput(deal.discount),
    downPayment: centsToInput(deal.downPayment),
    taxRate: String(deal.taxRate),
    plan: deal.plan,
  });

  const validate = (values: typeof form.values) => {
    const errors: Errors<typeof form.values> = {};
    errors.salePrice = validPositiveAmount(values.salePrice, 'Sale price');
    errors.discount = optionalAmount(values.discount, 'Discount');
    errors.downPayment = optionalAmount(values.downPayment, 'Down payment');

    if (!errors.salePrice && !errors.discount) {
      if (dollarsToCents(values.discount || '0') > dollarsToCents(values.salePrice)) {
        errors.discount = 'A discount cannot be larger than the sale price.';
      }
    }
    const rate = Number(values.taxRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 25) {
      errors.taxRate = 'Enter a tax rate between 0 and 25.';
    }
    return errors;
  };

  const submit = () => {
    if (!form.validate(validate)) return;
    dispatch({
      type: 'deal/update',
      id: deal.id,
      patch: {
        salePrice: dollarsToCents(form.values.salePrice),
        discount: dollarsToCents(form.values.discount || '0'),
        downPayment: dollarsToCents(form.values.downPayment || '0'),
        taxRate: Number(form.values.taxRate),
        plan: form.values.plan,
      },
    });
    notify(`${deal.code} pricing updated.`, 'success');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Pricing — ${deal.code}`}
      description="Figures are recalculated from these values everywhere they appear."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Save pricing
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
          <FormField label="Sale price" htmlFor="pricing-price" error={form.errors.salePrice}>
            <MoneyInput
              id="pricing-price"
              value={form.values.salePrice}
              invalid={Boolean(form.errors.salePrice)}
              onChange={(value) => form.set('salePrice', value)}
            />
          </FormField>

          <FormField label="Discount" htmlFor="pricing-discount" error={form.errors.discount}>
            <MoneyInput
              id="pricing-discount"
              value={form.values.discount}
              invalid={Boolean(form.errors.discount)}
              onChange={(value) => form.set('discount', value)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Down payment" htmlFor="pricing-down" error={form.errors.downPayment}>
            <MoneyInput
              id="pricing-down"
              value={form.values.downPayment}
              invalid={Boolean(form.errors.downPayment)}
              onChange={(value) => form.set('downPayment', value)}
            />
          </FormField>

          <FormField label="Tax rate %" htmlFor="pricing-tax" error={form.errors.taxRate}>
            <NumberInput
              id="pricing-tax"
              step="0.01"
              max="25"
              value={form.values.taxRate}
              onChange={(value) => form.set('taxRate', value)}
            />
          </FormField>

          <FormField label="Plan" htmlFor="pricing-plan">
            <Select
              id="pricing-plan"
              value={form.values.plan}
              onChange={(event) => form.set('plan', event.target.value as PaymentPlan)}
            >
              {PAYMENT_PLANS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Save
        </button>
      </form>
    </Dialog>
  );
}

// -------------------------------------------------------------------- fee

export function DealFeeForm({
  open,
  onClose,
  dealId,
}: {
  open: boolean;
  onClose: () => void;
  dealId: string;
}) {
  const { dispatch, notify } = useDealer();
  const form = useForm({ label: '', amount: '' });

  const submit = () => {
    const valid = form.validate((values) => ({
      label: values.label.trim() ? undefined : 'Give the fee a name.',
      amount: validPositiveAmount(values.amount, 'Amount'),
    }));
    if (!valid) return;

    dispatch({
      type: 'deal/addFee',
      id: dealId,
      label: form.values.label.trim(),
      amount: dollarsToCents(form.values.amount),
    });
    notify('Fee added.', 'success');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a fee"
      description="Fees are added after tax."
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Add fee
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
        <FormField label="Description" htmlFor="fee-label" error={form.errors.label}>
          <TextInput
            id="fee-label"
            placeholder="Dealer handling, title and registration…"
            value={form.values.label}
            invalid={Boolean(form.errors.label)}
            onChange={(event) => form.set('label', event.target.value)}
          />
        </FormField>

        <FormField label="Amount" htmlFor="fee-amount" error={form.errors.amount}>
          <MoneyInput
            id="fee-amount"
            value={form.values.amount}
            invalid={Boolean(form.errors.amount)}
            onChange={(value) => form.set('amount', value)}
          />
        </FormField>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Add
        </button>
      </form>
    </Dialog>
  );
}

// --------------------------------------------------------------- trade-in

export function TradeInForm({
  open,
  onClose,
  deal,
}: {
  open: boolean;
  onClose: () => void;
  deal: Deal;
}) {
  const { dispatch, notify } = useDealer();

  const form = useForm({
    year: String(deal.tradeIn?.year ?? new Date().getFullYear() - 6),
    make: deal.tradeIn?.make ?? '',
    model: deal.tradeIn?.model ?? '',
    mileage: String(deal.tradeIn?.mileage ?? ''),
    vin: deal.tradeIn?.vin ?? '',
    allowance: deal.tradeIn ? centsToInput(deal.tradeIn.allowance) : '',
    payoff: deal.tradeIn ? centsToInput(deal.tradeIn.payoff) : '0',
  });

  const submit = () => {
    const valid = form.validate((values) => ({
      make: values.make.trim() ? undefined : 'Enter the make.',
      model: values.model.trim() ? undefined : 'Enter the model.',
      allowance: validPositiveAmount(values.allowance, 'Allowance'),
      payoff: validAmount(values.payoff, 'Payoff'),
    }));
    if (!valid) return;

    dispatch({
      type: 'deal/tradeIn',
      id: deal.id,
      tradeIn: {
        year: Number(form.values.year) || new Date().getFullYear(),
        make: form.values.make.trim(),
        model: form.values.model.trim(),
        mileage: Number(form.values.mileage) || 0,
        vin: form.values.vin.trim().toUpperCase(),
        allowance: dollarsToCents(form.values.allowance),
        payoff: dollarsToCents(form.values.payoff || '0'),
      },
    });
    notify('Trade-in recorded.', 'success');
    onClose();
  };

  const remove = () => {
    dispatch({ type: 'deal/tradeIn', id: deal.id, tradeIn: undefined });
    notify('Trade-in removed.', 'success');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={deal.tradeIn ? 'Edit trade-in' : 'Add a trade-in'}
      description="Every figure here is entered by the dealership. The demo does not value vehicles."
      size="lg"
      footer={
        <>
          {deal.tradeIn && (
            <Button variant="danger" onClick={remove}>
              Remove trade-in
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Save trade-in
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FormField label="Year" htmlFor="trade-year">
            <NumberInput
              id="trade-year"
              min="1950"
              max={String(new Date().getFullYear() + 1)}
              value={form.values.year}
              onChange={(value) => form.set('year', value)}
            />
          </FormField>

          <FormField label="Make" htmlFor="trade-make" error={form.errors.make}>
            <TextInput
              id="trade-make"
              value={form.values.make}
              invalid={Boolean(form.errors.make)}
              onChange={(event) => form.set('make', event.target.value)}
            />
          </FormField>

          <FormField label="Model" htmlFor="trade-model" error={form.errors.model}>
            <TextInput
              id="trade-model"
              value={form.values.model}
              invalid={Boolean(form.errors.model)}
              onChange={(event) => form.set('model', event.target.value)}
            />
          </FormField>

          <FormField label="Mileage" htmlFor="trade-mileage">
            <NumberInput
              id="trade-mileage"
              value={form.values.mileage}
              onChange={(value) => form.set('mileage', value)}
            />
          </FormField>
        </div>

        <FormField label="VIN" htmlFor="trade-vin" optional>
          <TextInput
            id="trade-vin"
            maxLength={17}
            className="font-mono uppercase"
            value={form.values.vin}
            onChange={(event) => form.set('vin', event.target.value)}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Allowance" htmlFor="trade-allowance" error={form.errors.allowance}>
            <MoneyInput
              id="trade-allowance"
              value={form.values.allowance}
              invalid={Boolean(form.errors.allowance)}
              onChange={(value) => form.set('allowance', value)}
            />
          </FormField>

          <FormField label="Payoff owed" htmlFor="trade-payoff" error={form.errors.payoff}>
            <MoneyInput
              id="trade-payoff"
              value={form.values.payoff}
              invalid={Boolean(form.errors.payoff)}
              onChange={(value) => form.set('payoff', value)}
            />
          </FormField>
        </div>

        <p className="text-[0.75rem] text-muted">
          Net credit is the allowance less the payoff, and it reduces the taxable amount. A trade
          worth less than what is owed on it contributes nothing rather than going negative.
        </p>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Save
        </button>
      </form>
    </Dialog>
  );
}

// ----------------------------------------------------------------- closing

export function CloseDealDialog({
  open,
  onClose,
  dealId,
}: {
  open: boolean;
  onClose: () => void;
  dealId: string;
}) {
  const { state, dispatch, notify } = useDealer();
  const [confirmed, setConfirmed] = useState(false);

  const deal = getDeal(state, dealId);
  if (!deal) return null;

  const readiness = closeReadiness(state, deal);
  const vehicle = getVehicle(state, deal.vehicleId);
  const totals = dealTotals(state, deal);

  const submit = () => {
    if (!readiness.ready || !confirmed) return;
    dispatch({ type: 'deal/close', id: deal.id });
    track('deal_closed', { plan: deal.plan, hadTradeIn: Boolean(deal.tradeIn) });
    notify(`${deal.code} closed. ${vehicle?.code ?? 'The vehicle'} is now sold.`, 'success');
    setConfirmed(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Close ${deal.code}`}
      description="Closing records the sale and takes the vehicle out of inventory."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!readiness.ready || !confirmed}>
            Close deal
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[0.875rem]">
          <dt className="text-muted">Vehicle</dt>
          <dd className="text-charcoal">
            {vehicle ? `${vehicle.code} — ${vehicleTitle(vehicle)}` : '—'}
          </dd>
          <dt className="text-muted">Deal total</dt>
          <dd className="tabular-nums text-charcoal">{formatMoney(totals.total)}</dd>
          <dt className="text-muted">Recorded</dt>
          <dd className="tabular-nums text-charcoal">{formatMoney(totals.paid)}</dd>
          <dt className="text-muted">Balance</dt>
          <dd className="tabular-nums text-charcoal">{formatMoney(totals.balance)}</dd>
        </dl>

        {readiness.ready ? (
          <p className="flex items-start gap-2 border border-app-border bg-app-bg rounded-[3px] px-3 py-2 text-[0.8125rem] text-charcoal">
            <Check size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-app-success" />
            Everything this deal needs is in place.
          </p>
        ) : (
          <div className="border border-app-warning/40 bg-app-warning/[0.06] rounded-[3px] px-3 py-2.5">
            <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-charcoal">
              <AlertTriangle size={14} aria-hidden="true" className="shrink-0 text-app-warning" />
              This deal is not ready to close
            </p>
            <ul className="mt-1.5 space-y-1">
              {readiness.blockers.map((blocker) => (
                <li key={blocker} className="text-[0.8125rem] text-muted">
                  {blocker}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Checkbox
          id="close-confirm"
          label="I confirm the sale is agreed and the paperwork is complete."
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
      </div>
    </Dialog>
  );
}

export function CancelDealDialog({
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

  return (
    <ConfirmDialog
      open={open}
      onCancel={onClose}
      onConfirm={() => {
        dispatch({ type: 'deal/cancel', id: dealId });
        notify(`${deal?.code ?? 'Deal'} cancelled. The vehicle is available again.`, 'success');
        onClose();
      }}
      title="Cancel this deal?"
      confirmLabel="Cancel deal"
      tone="danger"
      description={
        <>
          <p>The vehicle goes back into inventory and the deal stops counting as in progress.</p>
          <p className="mt-2 text-muted">
            Payments already recorded stay on the customer&rsquo;s history.
          </p>
        </>
      }
    />
  );
}

// ---------------------------------------------------------------- delivery

export function DeliveryForm({
  open,
  onClose,
  deal,
}: {
  open: boolean;
  onClose: () => void;
  deal: Deal;
}) {
  const { dispatch, notify } = useDealer();
  const delivery = deal.delivery;

  const form = useForm({ notes: delivery?.notes ?? '' });
  const readiness = deliveryReadiness(deal);

  const toggle = (key: keyof NonNullable<Deal['delivery']>, value: boolean) => {
    dispatch({ type: 'deal/delivery', id: deal.id, patch: { [key]: value } });
  };

  const complete = () => {
    if (!readiness.ready) return;
    dispatch({ type: 'deal/completeDelivery', id: deal.id, notes: form.values.notes.trim() });
    track('vehicle_delivered');
    notify('Delivery recorded. A post-sale follow-up has been scheduled.', 'success');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Delivery — ${deal.code}`}
      description="Work through the handover, then record it."
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={complete} disabled={!readiness.ready}>
            Complete delivery
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ul className="space-y-2">
          {DELIVERY_CHECKS.map((check) => (
            <li key={check.key}>
              <Checkbox
                id={`delivery-${check.key}`}
                label={check.label}
                checked={Boolean(delivery?.[check.key])}
                onChange={(event) =>
                  toggle(check.key as keyof NonNullable<Deal['delivery']>, event.target.checked)
                }
              />
            </li>
          ))}
        </ul>

        {!readiness.ready && (
          <p className="text-[0.8125rem] text-muted">
            Still outstanding: {readiness.outstanding.join(', ')}.
          </p>
        )}

        <FormField label="Delivery notes" htmlFor="delivery-notes" optional>
          <TextArea
            id="delivery-notes"
            rows={2}
            placeholder="How the handover went, anything promised…"
            value={form.values.notes}
            onChange={(event) => form.set('notes', event.target.value)}
          />
        </FormField>
      </div>
    </Dialog>
  );
}
