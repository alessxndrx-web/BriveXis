import { useMemo, useState } from 'react';
import { Dialog } from '../components/Dialog';
import { Button, Checkbox, FormField, TextArea, TextInput } from '../components/AppUI';
import {
  AddressFields,
  emptyAddress,
  required,
  useForm,
  validEmail,
  validPhone,
  validateAddress,
} from './formUtils';
import { useContractor } from '../ContractorProvider';
import type { Address, Customer } from '../contractor.types';
import { createId } from '../contractor.utils';

/**
 * Create or edit a customer.
 *
 * On creation the dialog also establishes a service location, because a
 * customer without one cannot be quoted or scheduled. By default that is the
 * billing address; unchecking the box reveals a separate service address,
 * which is the normal case for property managers and absentee owners.
 */

interface CustomerFormValues {
  name: string;
  company: string;
  phone: string;
  email: string;
  notes: string;
  billingAddress: Address;
  serviceSameAsBilling: boolean;
  serviceLocationLabel: string;
  serviceAddress: Address;
}

interface CustomerFormProps {
  open: boolean;
  onClose: () => void;
  customer?: Customer;
  /** Pre-fills the form, e.g. when converting a lead. */
  prefill?: Partial<CustomerFormValues>;
  /** Receives both ids so the caller can select the new customer *and* its location. */
  onCreated?: (customerId: string, locationId: string) => void;
}

export function CustomerForm({ open, onClose, customer, prefill, onCreated }: CustomerFormProps) {
  const { dispatch, notify } = useContractor();

  const initial = useMemo<CustomerFormValues>(
    () => ({
      name: customer?.name ?? '',
      company: customer?.company ?? '',
      phone: customer?.phone ?? '',
      email: customer?.email ?? '',
      notes: customer?.notes ?? '',
      billingAddress: customer?.billingAddress ?? emptyAddress,
      serviceSameAsBilling: true,
      serviceLocationLabel: 'Primary location',
      serviceAddress: emptyAddress,
      ...prefill,
    }),
    [customer, prefill],
  );

  const form = useForm<CustomerFormValues>(initial);
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});
  const [seededFor, setSeededFor] = useState<string | undefined>(customer?.id);

  if (open && seededFor !== customer?.id) {
    setSeededFor(customer?.id);
    form.reset(initial);
    setAddressErrors({});
  }

  const submit = () => {
    const issues = {
      ...validateAddress(form.values.billingAddress, 'billing'),
      ...(form.values.serviceSameAsBilling
        ? {}
        : validateAddress(form.values.serviceAddress, 'service')),
    };
    setAddressErrors(issues);

    const valid = form.validate((values) => ({
      name: required(values.name, 'Customer name'),
      phone: required(values.phone, 'Phone') ?? validPhone(values.phone),
      email: validEmail(values.email),
    }));

    if (!valid) return;
    if (Object.keys(issues).length > 0) {
      document.getElementById(Object.keys(issues)[0])?.focus();
      return;
    }

    const base = {
      name: form.values.name.trim(),
      company: form.values.company.trim() || undefined,
      phone: form.values.phone.trim(),
      email: form.values.email.trim(),
      notes: form.values.notes.trim(),
      billingAddress: form.values.billingAddress,
    };

    if (customer) {
      dispatch({ type: 'customer/update', id: customer.id, patch: base });
      notify(`${base.name} updated.`, 'success');
      onClose();
      return;
    }

    const newId = createId('cus');
    // The location id is generated here rather than in the reducer: the caller
    // needs it in this same tick, before the new state has been committed.
    const newLocationId = createId('loc');
    dispatch({
      type: 'customer/create',
      id: newId,
      locationId: newLocationId,
      input: {
        ...base,
        notes: base.notes,
        serviceLocationLabel: form.values.serviceLocationLabel.trim() || 'Primary location',
        serviceAddress: form.values.serviceSameAsBilling
          ? undefined
          : form.values.serviceAddress,
      },
    });
    notify('Customer created.', 'success');
    onClose();
    onCreated?.(newId, newLocationId);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={customer ? `Edit ${customer.name}` : 'New customer'}
      description={
        customer
          ? 'Update contact and billing details.'
          : 'Customers need a service location before work can be scheduled.'
      }
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            {customer ? 'Save changes' : 'Create customer'}
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
          <FormField label="Customer name" htmlFor="customer-name" error={form.errors.name}>
            <TextInput
              id="customer-name"
              value={form.values.name}
              invalid={Boolean(form.errors.name)}
              onChange={(event) => form.set('name', event.target.value)}
            />
          </FormField>

          <FormField label="Company" htmlFor="customer-company" optional>
            <TextInput
              id="customer-company"
              value={form.values.company}
              autoComplete="organization"
              onChange={(event) => form.set('company', event.target.value)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Phone" htmlFor="customer-phone" error={form.errors.phone}>
            <TextInput
              id="customer-phone"
              type="tel"
              value={form.values.phone}
              invalid={Boolean(form.errors.phone)}
              placeholder="(303) 555-0100"
              onChange={(event) => form.set('phone', event.target.value)}
            />
          </FormField>

          <FormField label="Email" htmlFor="customer-email" error={form.errors.email} optional>
            <TextInput
              id="customer-email"
              type="email"
              value={form.values.email}
              invalid={Boolean(form.errors.email)}
              onChange={(event) => form.set('email', event.target.value)}
            />
          </FormField>
        </div>

        <div className="pt-3 border-t border-app-border">
          <AddressFields
            prefix="billing"
            legend="Billing address"
            value={form.values.billingAddress}
            errors={addressErrors}
            onChange={(address) => {
              form.set('billingAddress', address);
              setAddressErrors({});
            }}
          />
        </div>

        {!customer && (
          <div className="pt-3 border-t border-app-border space-y-3">
            <FormField label="Service location name" htmlFor="customer-service-location">
              <TextInput
                id="customer-service-location"
                value={form.values.serviceLocationLabel}
                placeholder="e.g. Residence, Building 2, Main office"
                onChange={(event) => form.set('serviceLocationLabel', event.target.value)}
              />
            </FormField>

            <Checkbox
              id="customer-service-same"
              label="Work happens at the billing address"
              checked={form.values.serviceSameAsBilling}
              onChange={(event) => form.set('serviceSameAsBilling', event.target.checked)}
            />

            {!form.values.serviceSameAsBilling && (
              <AddressFields
                prefix="service"
                legend="Service address"
                value={form.values.serviceAddress}
                errors={addressErrors}
                onChange={(address) => {
                  form.set('serviceAddress', address);
                  setAddressErrors({});
                }}
              />
            )}
          </div>
        )}

        <FormField label="Notes" htmlFor="customer-notes" optional>
          <TextArea
            id="customer-notes"
            rows={2}
            value={form.values.notes}
            placeholder="Access instructions, billing preferences, approval requirements…"
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
