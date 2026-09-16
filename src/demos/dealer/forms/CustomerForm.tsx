import { useMemo, useState } from 'react';
import { useDealer } from '../DealerProvider';
import type { Address, Customer } from '../dealer.types';
import { Button, FormField, TextArea, TextInput } from '../../shared/ui/AppUI';
import { Dialog } from '../../shared/ui/Dialog';
import {
  AddressFields,
  emptyAddressIn,
  required,
  useForm,
  validEmail,
  validPhone,
  validateAddress,
  type Errors,
} from '../../shared/ui/formControls';

/**
 * Customer records.
 *
 * A dealership needs a verified address on file before paperwork can be
 * produced, which is why it is required here while it is optional on a lead.
 */

interface CustomerFormValues {
  name: string;
  phone: string;
  email: string;
  address: Address;
  notes: string;
}

function validate(values: CustomerFormValues): Errors<CustomerFormValues> {
  return {
    name: required(values.name, 'a name'),
    phone: validPhone(values.phone),
    email: values.email.trim() ? validEmail(values.email) : undefined,
  };
}

interface CustomerFormProps {
  open: boolean;
  onClose: () => void;
  customer?: Customer;
  /** Pre-fills the form, e.g. when converting a lead. */
  prefill?: Partial<CustomerFormValues>;
  /** Links the new customer back to the lead it came from. */
  leadId?: string;
  onCreated?: (customerId: string) => void;
}

export function CustomerForm({
  open,
  onClose,
  customer,
  prefill,
  leadId,
  onCreated,
}: CustomerFormProps) {
  const { dispatch, notify } = useDealer();
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});

  const initial = useMemo<CustomerFormValues>(
    () => ({
      name: customer?.name ?? '',
      phone: customer?.phone ?? '',
      email: customer?.email ?? '',
      address: customer?.address ?? emptyAddressIn('CO'),
      notes: customer?.notes ?? '',
      ...prefill,
    }),
    [customer, prefill],
  );

  const form = useForm<CustomerFormValues>(initial);

  const submit = () => {
    const addressProblems = validateAddress(form.values.address, 'customer-address');
    setAddressErrors(addressProblems);

    const valid = form.validate(validate);
    if (!valid || Object.keys(addressProblems).length > 0) return;

    const base = {
      name: form.values.name.trim(),
      phone: form.values.phone.trim(),
      email: form.values.email.trim(),
      address: form.values.address,
      notes: form.values.notes.trim(),
    };

    if (customer) {
      dispatch({ type: 'customer/update', id: customer.id, patch: base });
      notify(`${customer.name} updated.`, 'success');
      onClose();
      return;
    }

    const id = `cus_${Date.now().toString(36)}`;
    dispatch({ type: 'customer/create', id, input: { ...base, leadId } });
    notify('Customer created.', 'success');
    onClose();
    onCreated?.(id);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={customer ? `Edit ${customer.name}` : 'New customer'}
      description={
        customer
          ? 'Update contact and address details.'
          : 'A customer record is what reservations, deals and paperwork attach to.'
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

          <FormField label="Phone" htmlFor="customer-phone" error={form.errors.phone}>
            <TextInput
              id="customer-phone"
              type="tel"
              placeholder="(303) 555-0100"
              value={form.values.phone}
              invalid={Boolean(form.errors.phone)}
              onChange={(event) => form.set('phone', event.target.value)}
            />
          </FormField>
        </div>

        <FormField label="Email" htmlFor="customer-email" error={form.errors.email} optional>
          <TextInput
            id="customer-email"
            type="email"
            value={form.values.email}
            invalid={Boolean(form.errors.email)}
            onChange={(event) => form.set('email', event.target.value)}
          />
        </FormField>

        <div className="pt-3 border-t border-app-border">
          <AddressFields
            prefix="customer-address"
            legend="Address"
            value={form.values.address}
            errors={addressErrors}
            onChange={(address) => {
              form.set('address', address);
              setAddressErrors({});
            }}
          />
        </div>

        <FormField label="Notes" htmlFor="customer-notes" optional>
          <TextArea
            id="customer-notes"
            rows={2}
            placeholder="Preferences, history, anything the team should know…"
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
