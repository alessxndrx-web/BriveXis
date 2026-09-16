import { useMemo, useState } from 'react';
import { Dialog } from '../components/Dialog';
import { Button, FormField, Select, TextArea, TextInput } from '../components/AppUI';
import {
  AddressFields,
  MoneyInput,
  emptyAddress,
  required,
  useForm,
  validAmount,
  validEmail,
  validPhone,
  validateAddress,
} from './formUtils';
import { useContractor } from '../ContractorProvider';
import {
  LEAD_SOURCES,
  LEAD_STAGES,
  SERVICE_TYPES,
  type Address,
  type Lead,
  type LeadSource,
  type LeadStage,
  type ServiceType,
} from '../contractor.types';
import { centsToInput, dollarsToCents, toDateOnly } from '../contractor.utils';
import { track } from '../../../lib/analytics';

/**
 * Create or edit a lead.
 *
 * The same dialog serves both: passing an existing lead switches it to edit
 * mode. Only categorical metadata reaches analytics — never a name, address or
 * anything else typed into the form.
 */

interface LeadFormValues {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  source: LeadSource;
  serviceType: ServiceType;
  description: string;
  estimatedValue: string;
  stage: LeadStage;
  nextFollowUpAt: string;
  serviceAddress: Address;
}

interface LeadFormProps {
  open: boolean;
  onClose: () => void;
  /** Omit to create a new lead. */
  lead?: Lead;
}

export function LeadForm({ open, onClose, lead }: LeadFormProps) {
  const { state, dispatch, notify } = useContractor();

  const initial = useMemo<LeadFormValues>(
    () => ({
      name: lead?.name ?? '',
      contactName: lead?.contactName ?? '',
      phone: lead?.phone ?? '',
      email: lead?.email ?? '',
      source: lead?.source ?? 'Website',
      serviceType: lead?.serviceType ?? 'Roofing',
      description: lead?.description ?? '',
      estimatedValue: lead ? centsToInput(lead.estimatedValue) : '',
      stage: lead?.stage ?? 'New',
      nextFollowUpAt: lead?.nextFollowUpAt ?? '',
      serviceAddress: lead?.serviceAddress ?? emptyAddress,
    }),
    [lead],
  );

  const form = useForm<LeadFormValues>(initial);
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});

  // The dialog unmounts its contents when closed, so re-seeding on open is
  // enough to guarantee a fresh form without an effect watching `open`.
  const [seededFor, setSeededFor] = useState<string | undefined>(lead?.id);
  if (open && seededFor !== lead?.id) {
    setSeededFor(lead?.id);
    form.reset(initial);
    setAddressErrors({});
  }

  const submit = () => {
    const addressIssues = validateAddress(form.values.serviceAddress, 'lead-address');
    setAddressErrors(addressIssues);

    const valid = form.validate((values) => ({
      name: required(values.name, 'Lead name'),
      contactName: required(values.contactName, 'Contact name'),
      phone: required(values.phone, 'Phone') ?? validPhone(values.phone),
      email: validEmail(values.email),
      estimatedValue: values.estimatedValue
        ? validAmount(values.estimatedValue, 'Estimated value')
        : undefined,
    }));

    if (!valid) return;
    if (Object.keys(addressIssues).length > 0) {
      document.getElementById(Object.keys(addressIssues)[0])?.focus();
      return;
    }

    const payload = {
      name: form.values.name.trim(),
      contactName: form.values.contactName.trim(),
      phone: form.values.phone.trim(),
      email: form.values.email.trim(),
      source: form.values.source,
      serviceType: form.values.serviceType,
      description: form.values.description.trim(),
      estimatedValue: dollarsToCents(form.values.estimatedValue || '0'),
      stage: form.values.stage,
      serviceAddress: form.values.serviceAddress,
      nextFollowUpAt: form.values.nextFollowUpAt || undefined,
    };

    if (lead) {
      dispatch({ type: 'lead/update', id: lead.id, patch: payload });
      if (lead.stage !== payload.stage) {
        dispatch({ type: 'lead/stage', id: lead.id, stage: payload.stage });
      }
      notify(`Lead ${lead.code} updated.`, 'success');
    } else {
      dispatch({
        type: 'lead/create',
        input: { ...payload, assignedUserId: state.users[1]?.id ?? 'usr-2' },
      });
      track('lead_created', { source: payload.source, serviceType: payload.serviceType });
      notify('Lead created.', 'success');
    }

    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={lead ? `Edit ${lead.code}` : 'New lead'}
      description={
        lead ? 'Update the opportunity details.' : 'Capture a new opportunity and where it came from.'
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
        <FormField label="Lead name" htmlFor="name" error={form.errors.name}>
          <TextInput
            id="name"
            value={form.values.name}
            invalid={Boolean(form.errors.name)}
            placeholder="e.g. Hail damage roof replacement"
            onChange={(event) => form.set('name', event.target.value)}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Contact name" htmlFor="contactName" error={form.errors.contactName}>
            <TextInput
              id="contactName"
              value={form.values.contactName}
              invalid={Boolean(form.errors.contactName)}
              autoComplete="name"
              onChange={(event) => form.set('contactName', event.target.value)}
            />
          </FormField>

          <FormField label="Phone" htmlFor="phone" error={form.errors.phone}>
            <TextInput
              id="phone"
              type="tel"
              value={form.values.phone}
              invalid={Boolean(form.errors.phone)}
              placeholder="(303) 555-0100"
              onChange={(event) => form.set('phone', event.target.value)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Email" htmlFor="email" error={form.errors.email} optional>
            <TextInput
              id="email"
              type="email"
              value={form.values.email}
              invalid={Boolean(form.errors.email)}
              onChange={(event) => form.set('email', event.target.value)}
            />
          </FormField>

          <FormField label="Source" htmlFor="source">
            <Select
              id="source"
              value={form.values.source}
              onChange={(event) => form.set('source', event.target.value as LeadSource)}
            >
              {LEAD_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Service type" htmlFor="serviceType">
            <Select
              id="serviceType"
              value={form.values.serviceType}
              onChange={(event) => form.set('serviceType', event.target.value as ServiceType)}
            >
              {SERVICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Stage" htmlFor="stage">
            <Select
              id="stage"
              value={form.values.stage}
              onChange={(event) => form.set('stage', event.target.value as LeadStage)}
            >
              {LEAD_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Estimated value"
            htmlFor="estimatedValue"
            error={form.errors.estimatedValue}
            optional
          >
            <MoneyInput
              id="estimatedValue"
              value={form.values.estimatedValue}
              invalid={Boolean(form.errors.estimatedValue)}
              onChange={(value) => form.set('estimatedValue', value)}
            />
          </FormField>
        </div>

        <FormField label="Next follow-up" htmlFor="nextFollowUpAt" optional>
          <TextInput
            id="nextFollowUpAt"
            type="date"
            min={toDateOnly(new Date(Date.now() - 86_400_000 * 365))}
            value={form.values.nextFollowUpAt}
            onChange={(event) => form.set('nextFollowUpAt', event.target.value)}
            className="sm:max-w-[12rem]"
          />
        </FormField>

        <FormField label="Requested work" htmlFor="description" optional>
          <TextArea
            id="description"
            rows={3}
            value={form.values.description}
            placeholder="What does the customer need, and what did they tell you about the property?"
            onChange={(event) => form.set('description', event.target.value)}
          />
        </FormField>

        <div className="pt-1 border-t border-app-border">
          <div className="pt-3">
            <AddressFields
              prefix="lead-address"
              legend="Service address"
              value={form.values.serviceAddress}
              errors={addressErrors}
              onChange={(address) => {
                form.set('serviceAddress', address);
                setAddressErrors({});
              }}
            />
          </div>
        </div>

        {/* Lets Enter submit the form from any field. */}
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Save
        </button>
      </form>
    </Dialog>
  );
}
