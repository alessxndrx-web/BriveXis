import { useMemo } from 'react';
import { useDealer } from '../DealerProvider';
import type { DealerLead } from '../dealer.types';
import {
  APPOINTMENT_KINDS,
  CONTACT_PREFERENCES,
  LEAD_SOURCES,
  LEAD_STAGES,
} from '../dealer.types';
import { availableVehicles } from '../dealer.selectors';
import { dollarsToCents, centsToInput, vehicleTitle, formatMoneyWhole } from '../dealer.utils';
import { track } from '../../../lib/analytics';
import { Button, Checkbox, FormField, Select, TextArea, TextInput } from '../../shared/ui/AppUI';
import { Dialog } from '../../shared/ui/Dialog';
import {
  MoneyInput,
  required,
  useForm,
  validAmount,
  validEmail,
  validPhone,
  type Errors,
} from '../../shared/ui/formControls';

/**
 * Lead capture and editing.
 *
 * The vehicle of interest is optional: plenty of shoppers arrive before they
 * know what they want, and forcing a choice would make the record wrong rather
 * than complete.
 */

interface LeadFormValues {
  name: string;
  phone: string;
  email: string;
  source: DealerLead['source'];
  stage: DealerLead['stage'];
  vehicleId: string;
  budgetMin: string;
  budgetMax: string;
  contactPreference: DealerLead['contactPreference'];
  hasTradeIn: boolean;
  salespersonId: string;
  appointmentAt: string;
  appointmentKind: string;
  nextFollowUpAt: string;
  notes: string;
}

function validate(values: LeadFormValues): Errors<LeadFormValues> {
  const errors: Errors<LeadFormValues> = {};

  errors.name = required(values.name, 'a name');
  errors.phone = validPhone(values.phone);
  if (values.email.trim()) errors.email = validEmail(values.email);
  errors.budgetMin = validAmount(values.budgetMin, 'Budget from');
  errors.budgetMax = validAmount(values.budgetMax, 'Budget to');

  if (!errors.budgetMin && !errors.budgetMax && values.budgetMin && values.budgetMax) {
    if (dollarsToCents(values.budgetMax) < dollarsToCents(values.budgetMin)) {
      errors.budgetMax = 'The top of the budget cannot be below the bottom.';
    }
  }

  return errors;
}

interface LeadFormProps {
  open: boolean;
  onClose: () => void;
  lead?: DealerLead;
  /** Pre-selects a vehicle, e.g. when starting from an inventory record. */
  vehicleId?: string;
  onCreated?: (leadId: string) => void;
}

export function LeadForm({ open, onClose, lead, vehicleId, onCreated }: LeadFormProps) {
  const { state, dispatch, notify } = useDealer();

  const initial = useMemo<LeadFormValues>(
    () => ({
      name: lead?.name ?? '',
      phone: lead?.phone ?? '',
      email: lead?.email ?? '',
      source: lead?.source ?? 'Website',
      stage: lead?.stage ?? 'New',
      vehicleId: lead?.vehicleId ?? vehicleId ?? '',
      budgetMin: lead?.budgetMin ? centsToInput(lead.budgetMin) : '',
      budgetMax: lead?.budgetMax ? centsToInput(lead.budgetMax) : '',
      contactPreference: lead?.contactPreference ?? 'Phone',
      hasTradeIn: lead?.hasTradeIn ?? false,
      salespersonId: lead?.salespersonId ?? state.salespeople[3]?.id ?? state.salespeople[0].id,
      appointmentAt: lead?.appointmentAt ? lead.appointmentAt.slice(0, 16) : '',
      appointmentKind: lead?.appointmentKind ?? '',
      nextFollowUpAt: lead?.nextFollowUpAt ?? '',
      notes: lead?.notes ?? '',
    }),
    [lead, vehicleId, state.salespeople],
  );

  const form = useForm<LeadFormValues>(initial);

  // A vehicle already attached to this lead stays selectable even if it has
  // since been reserved, so editing does not silently drop it.
  const vehicleOptions = useMemo(() => {
    const open = availableVehicles(state);
    const current = state.vehicles.find((entry) => entry.id === form.values.vehicleId);
    return current && !open.some((entry) => entry.id === current.id) ? [current, ...open] : open;
  }, [state, form.values.vehicleId]);

  const submit = () => {
    if (!form.validate(validate)) return;

    const payload = {
      name: form.values.name.trim(),
      phone: form.values.phone.trim(),
      email: form.values.email.trim(),
      source: form.values.source,
      stage: form.values.stage,
      vehicleId: form.values.vehicleId || undefined,
      budgetMin: form.values.budgetMin ? dollarsToCents(form.values.budgetMin) : undefined,
      budgetMax: form.values.budgetMax ? dollarsToCents(form.values.budgetMax) : undefined,
      contactPreference: form.values.contactPreference,
      hasTradeIn: form.values.hasTradeIn,
      salespersonId: form.values.salespersonId,
      appointmentAt: form.values.appointmentAt
        ? new Date(form.values.appointmentAt).toISOString()
        : undefined,
      appointmentKind: (form.values.appointmentKind || undefined) as DealerLead['appointmentKind'],
      nextFollowUpAt: form.values.nextFollowUpAt || undefined,
      notes: form.values.notes.trim(),
    };

    if (lead) {
      dispatch({ type: 'lead/update', id: lead.id, patch: payload });
      notify(`${lead.code} updated.`, 'success');
      onClose();
      return;
    }

    const id = `lead_${Date.now().toString(36)}`;
    dispatch({ type: 'lead/create', id, input: payload });
    // Categorical metadata only — never the name, contact details or notes.
    track('lead_created', { source: payload.source, hasVehicle: Boolean(payload.vehicleId) });
    notify('Lead created.', 'success');
    onClose();
    onCreated?.(id);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={lead ? `Edit ${lead.code}` : 'New lead'}
      description={
        lead ? 'Update the opportunity.' : 'Capture a new opportunity and where it came from.'
      }
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            {lead ? 'Save changes' : 'Create lead'}
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
          <FormField label="Name" htmlFor="lead-name" error={form.errors.name}>
            <TextInput
              id="lead-name"
              value={form.values.name}
              invalid={Boolean(form.errors.name)}
              onChange={(event) => form.set('name', event.target.value)}
            />
          </FormField>

          <FormField label="Phone" htmlFor="lead-phone" error={form.errors.phone}>
            <TextInput
              id="lead-phone"
              type="tel"
              placeholder="(303) 555-0100"
              value={form.values.phone}
              invalid={Boolean(form.errors.phone)}
              onChange={(event) => form.set('phone', event.target.value)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Email" htmlFor="lead-email" error={form.errors.email} optional>
            <TextInput
              id="lead-email"
              type="email"
              value={form.values.email}
              invalid={Boolean(form.errors.email)}
              onChange={(event) => form.set('email', event.target.value)}
            />
          </FormField>

          <FormField label="Preferred contact" htmlFor="lead-contact">
            <Select
              id="lead-contact"
              value={form.values.contactPreference}
              onChange={(event) =>
                form.set('contactPreference', event.target.value as LeadFormValues['contactPreference'])
              }
            >
              {CONTACT_PREFERENCES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Source" htmlFor="lead-source">
            <Select
              id="lead-source"
              value={form.values.source}
              onChange={(event) => form.set('source', event.target.value as DealerLead['source'])}
            >
              {LEAD_SOURCES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Stage" htmlFor="lead-stage-field">
            <Select
              id="lead-stage-field"
              value={form.values.stage}
              onChange={(event) => form.set('stage', event.target.value as DealerLead['stage'])}
            >
              {LEAD_STAGES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Salesperson" htmlFor="lead-salesperson">
            <Select
              id="lead-salesperson"
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

        <FormField label="Vehicle of interest" htmlFor="lead-vehicle" optional>
          <Select
            id="lead-vehicle"
            value={form.values.vehicleId}
            onChange={(event) => form.set('vehicleId', event.target.value)}
          >
            <option value="">Not decided yet</option>
            {vehicleOptions.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.code} — {vehicleTitle(vehicle)} · {formatMoneyWhole(vehicle.listPrice)}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Budget from" htmlFor="lead-budget-min" error={form.errors.budgetMin} optional>
            <MoneyInput
              id="lead-budget-min"
              value={form.values.budgetMin}
              invalid={Boolean(form.errors.budgetMin)}
              onChange={(value) => form.set('budgetMin', value)}
            />
          </FormField>

          <FormField label="Budget to" htmlFor="lead-budget-max" error={form.errors.budgetMax} optional>
            <MoneyInput
              id="lead-budget-max"
              value={form.values.budgetMax}
              invalid={Boolean(form.errors.budgetMax)}
              onChange={(value) => form.set('budgetMax', value)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Appointment" htmlFor="lead-appointment" optional>
            <TextInput
              id="lead-appointment"
              type="datetime-local"
              value={form.values.appointmentAt}
              onChange={(event) => form.set('appointmentAt', event.target.value)}
            />
          </FormField>

          <FormField label="Appointment type" htmlFor="lead-appointment-kind" optional>
            <Select
              id="lead-appointment-kind"
              value={form.values.appointmentKind}
              onChange={(event) => form.set('appointmentKind', event.target.value)}
            >
              <option value="">—</option>
              {APPOINTMENT_KINDS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Next follow-up" htmlFor="lead-follow-up" optional>
            <TextInput
              id="lead-follow-up"
              type="date"
              value={form.values.nextFollowUpAt}
              onChange={(event) => form.set('nextFollowUpAt', event.target.value)}
            />
          </FormField>
        </div>

        <Checkbox
          id="lead-trade-in"
          label="Has a vehicle to trade in"
          checked={form.values.hasTradeIn}
          onChange={(event) => form.set('hasTradeIn', event.target.checked)}
        />

        <FormField label="Notes" htmlFor="lead-notes" optional>
          <TextArea
            id="lead-notes"
            rows={3}
            placeholder="What they are looking for, what was discussed, anything to remember…"
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
