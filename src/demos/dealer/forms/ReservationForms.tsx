import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useDealer } from '../DealerProvider';
import type { Reservation } from '../dealer.types';
import {
  availableVehicles,
  checkVehicleAvailability,
  depositPaid,
  getReservation,
  getVehicle,
} from '../dealer.selectors';
import {
  addDays,
  centsToInput,
  dayOffset,
  dollarsToCents,
  formatMoney,
  toDateOnly,
  vehicleTitle,
} from '../dealer.utils';
import { track } from '../../../lib/analytics';
import { Button, FormField, Select, TextArea, TextInput } from '../../shared/ui/AppUI';
import { ConfirmDialog, Dialog } from '../../shared/ui/Dialog';
import {
  MoneyInput,
  useForm,
  validPositiveAmount,
  type Errors,
} from '../../shared/ui/formControls';
import { PaymentForm } from './FinanceForms';

/**
 * Reservations — the point where a vehicle stops being available.
 *
 * The availability rule is checked here as well as in the reducer, so a
 * salesperson sees why a vehicle cannot be held before they fill the form in
 * rather than after they submit it.
 */

interface ReservationFormValues {
  customerId: string;
  vehicleId: string;
  salespersonId: string;
  reservedAt: string;
  expiresAt: string;
  requestedDeposit: string;
  notes: string;
}

interface ReservationFormProps {
  open: boolean;
  onClose: () => void;
  /** Pre-selects a vehicle, e.g. from its detail screen. */
  vehicleId?: string;
  customerId?: string;
  onCreated?: (reservationId: string) => void;
}

export function ReservationForm({
  open,
  onClose,
  vehicleId,
  customerId,
  onCreated,
}: ReservationFormProps) {
  const { state, dispatch, notify } = useDealer();

  const today = toDateOnly(new Date());

  const initial = useMemo<ReservationFormValues>(
    () => ({
      customerId: customerId ?? '',
      vehicleId: vehicleId ?? '',
      salespersonId: state.salespeople[3]?.id ?? state.salespeople[0].id,
      reservedAt: today,
      expiresAt: dayOffset(new Date(), state.settings.reservationHoldDays),
      requestedDeposit: centsToInput(state.settings.defaultDeposit),
      notes: '',
    }),
    [customerId, vehicleId, state.salespeople, state.settings, today],
  );

  const form = useForm<ReservationFormValues>(initial);

  const options = useMemo(() => availableVehicles(state), [state]);
  const chosen = getVehicle(state, form.values.vehicleId);
  const availability = form.values.vehicleId
    ? checkVehicleAvailability(state, form.values.vehicleId)
    : undefined;

  const validate = (values: ReservationFormValues): Errors<ReservationFormValues> => {
    const errors: Errors<ReservationFormValues> = {};
    if (!values.customerId) errors.customerId = 'Choose the customer holding the vehicle.';
    if (!values.vehicleId) errors.vehicleId = 'Choose a vehicle.';
    errors.requestedDeposit = validPositiveAmount(values.requestedDeposit, 'Deposit');
    if (values.expiresAt && values.expiresAt < values.reservedAt) {
      errors.expiresAt = 'The hold cannot expire before it starts.';
    }
    return errors;
  };

  const submit = () => {
    if (!form.validate(validate)) return;

    const check = checkVehicleAvailability(state, form.values.vehicleId);
    if (!check.available) {
      form.setErrors({ vehicleId: check.reason });
      return;
    }

    const id = `res_${Date.now().toString(36)}`;
    dispatch({
      type: 'reservation/create',
      id,
      input: {
        customerId: form.values.customerId,
        vehicleId: form.values.vehicleId,
        salespersonId: form.values.salespersonId,
        reservedAt: form.values.reservedAt,
        expiresAt: form.values.expiresAt,
        requestedDeposit: dollarsToCents(form.values.requestedDeposit),
        notes: form.values.notes.trim(),
      },
    });
    track('reservation_created');
    notify('Reservation created. The vehicle is now held.', 'success');
    onClose();
    onCreated?.(id);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New reservation"
      description="Holding a vehicle takes it out of available inventory until the hold ends."
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Create reservation
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
        <FormField label="Customer" htmlFor="reservation-customer" error={form.errors.customerId}>
          <Select
            id="reservation-customer"
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

        <FormField label="Vehicle" htmlFor="reservation-vehicle" error={form.errors.vehicleId}>
          <Select
            id="reservation-vehicle"
            value={form.values.vehicleId}
            invalid={Boolean(form.errors.vehicleId)}
            onChange={(event) => form.set('vehicleId', event.target.value)}
          >
            <option value="">Select an available vehicle</option>
            {options.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.code} — {vehicleTitle(vehicle)} · {formatMoney(vehicle.listPrice)}
              </option>
            ))}
          </Select>
        </FormField>

        {availability && !availability.available && (
          <p className="flex items-start gap-2 text-[0.8125rem] text-app-danger">
            <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            {availability.reason}
          </p>
        )}

        {chosen && availability?.available && (
          <p className="text-[0.8125rem] text-muted">
            List price {formatMoney(chosen.listPrice)} · {chosen.status}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Reserved on" htmlFor="reservation-from">
            <TextInput
              id="reservation-from"
              type="date"
              value={form.values.reservedAt}
              onChange={(event) => form.set('reservedAt', event.target.value)}
            />
          </FormField>

          <FormField label="Hold expires" htmlFor="reservation-until" error={form.errors.expiresAt}>
            <TextInput
              id="reservation-until"
              type="date"
              value={form.values.expiresAt}
              invalid={Boolean(form.errors.expiresAt)}
              onChange={(event) => form.set('expiresAt', event.target.value)}
            />
          </FormField>

          <FormField
            label="Deposit requested"
            htmlFor="reservation-deposit"
            error={form.errors.requestedDeposit}
          >
            <MoneyInput
              id="reservation-deposit"
              value={form.values.requestedDeposit}
              invalid={Boolean(form.errors.requestedDeposit)}
              onChange={(value) => form.set('requestedDeposit', value)}
            />
          </FormField>
        </div>

        <FormField label="Salesperson" htmlFor="reservation-salesperson">
          <Select
            id="reservation-salesperson"
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

        <FormField label="Notes" htmlFor="reservation-notes" optional>
          <TextArea
            id="reservation-notes"
            rows={2}
            value={form.values.notes}
            onChange={(event) => form.set('notes', event.target.value)}
          />
        </FormField>

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Save
        </button>
      </form>
    </Dialog>
  );
}

/** Records the deposit that turns a pending hold into a confirmed one. */
export function ReservationDepositForm({
  open,
  onClose,
  reservation,
}: {
  open: boolean;
  onClose: () => void;
  reservation: Reservation;
}) {
  const { state } = useDealer();
  const alreadyPaid = depositPaid(state, reservation.id);
  const outstanding = Math.max(0, reservation.requestedDeposit - alreadyPaid);

  return (
    <PaymentForm
      open={open}
      onClose={onClose}
      customerId={reservation.customerId}
      reservationId={reservation.id}
      kind="Reservation Deposit"
      suggestedAmount={outstanding || reservation.requestedDeposit}
      title={`Record deposit — ${reservation.code}`}
    />
  );
}

/** Cancelling a hold releases the vehicle, so it asks first. */
export function CancelReservationDialog({
  open,
  onClose,
  reservationId,
}: {
  open: boolean;
  onClose: () => void;
  reservationId: string;
}) {
  const { state, dispatch, notify } = useDealer();
  const reservation = getReservation(state, reservationId);
  const vehicle = getVehicle(state, reservation?.vehicleId);

  return (
    <ConfirmDialog
      open={open}
      onCancel={onClose}
      onConfirm={() => {
        dispatch({ type: 'reservation/cancel', id: reservationId });
        notify(`${reservation?.code ?? 'Reservation'} cancelled. The vehicle is available again.`, 'success');
        onClose();
      }}
      title="Cancel this reservation?"
      confirmLabel="Cancel reservation"
      tone="danger"
      description={
        <>
          <p>
            {vehicle ? `${vehicle.code} — ${vehicleTitle(vehicle)}` : 'The vehicle'} will go back
            into available inventory and can be reserved by someone else.
          </p>
          <p className="mt-2 text-muted">
            Any deposit already recorded stays on the customer&rsquo;s history; refund it separately
            if that is what was agreed.
          </p>
        </>
      }
    />
  );
}

/** Suggested expiry, used when a screen offers a quick reservation. */
export const defaultExpiry = (holdDays: number) => toDateOnly(addDays(new Date(), holdDays));

/** Small helper the reservation list uses to flag a hold that has run out. */
export function isExpired(reservation: Reservation, now = new Date()): boolean {
  return (
    (reservation.status === 'Pending' || reservation.status === 'Confirmed') &&
    reservation.expiresAt < toDateOnly(now)
  );
}
