import { useMemo, useState } from 'react';
import { useContractor } from '../ContractorProvider';
import { useRouter } from '../../../lib/router';
import { paths } from '../contractor.routes';
import type { LineItem } from '../contractor.types';
import { customerLocations, getEstimate } from '../contractor.selectors';
import { createId, formatAddressShort } from '../contractor.utils';
import {
  Button,
  EmptyState,
  FormField,
  LinkButton,
  Panel,
  PanelHeader,
  PageHeader,
  Select,
  TextArea,
  TextInput,
} from '../components/AppUI';
import { ConfirmDialog } from '../components/Dialog';
import { LineItemEditor, createEmptyItem } from '../components/LineItemEditor';
import { CustomerForm } from '../forms/CustomerForm';
import { track } from '../../../lib/analytics';

/**
 * Estimate editor.
 *
 * Handles both a new estimate and edits to an existing one. When opened with
 * `?lead=<id>` it carries that lead's customer, service location and requested
 * work across, which is what makes "Create estimate" on a lead a real action
 * rather than a link to an empty form.
 */

interface EstimateEditorProps {
  /** Omitted when creating. */
  estimateId?: string;
}

interface Draft {
  customerId: string;
  locationId: string;
  leadId?: string;
  title: string;
  scope: string;
  items: LineItem[];
  taxRate: number;
  discount: number;
  notes: string;
  terms: string;
}

export function EstimateEditor({ estimateId }: EstimateEditorProps) {
  const { state, dispatch, notify } = useContractor();
  const { navigate } = useRouter();

  const existing = estimateId ? getEstimate(state, estimateId) : undefined;

  // A lead id in the query string pre-fills a new estimate.
  const leadFromQuery = useMemo(() => {
    if (typeof window === 'undefined' || existing) return undefined;
    const id = new URLSearchParams(window.location.search).get('lead');
    return id ? state.leads.find((lead) => lead.id === id) : undefined;
  }, [state.leads, existing]);

  /**
   * A lead carries a service address but not necessarily a customer record.
   * If one already exists for the contact, it is matched by email or phone so
   * the estimate attaches to the real account instead of creating a duplicate.
   */
  const matchedCustomer = useMemo(() => {
    if (!leadFromQuery) return undefined;
    if (leadFromQuery.customerId) {
      return state.customers.find((customer) => customer.id === leadFromQuery.customerId);
    }
    return state.customers.find(
      (customer) =>
        (leadFromQuery.email && customer.email.toLowerCase() === leadFromQuery.email.toLowerCase()) ||
        customer.phone.replace(/\D/g, '') === leadFromQuery.phone.replace(/\D/g, ''),
    );
  }, [leadFromQuery, state.customers]);

  const initial = useMemo<Draft>(() => {
    if (existing) {
      return {
        customerId: existing.customerId,
        locationId: existing.locationId,
        leadId: existing.leadId,
        title: existing.title,
        scope: existing.scope,
        items: existing.items.map((item) => ({ ...item })),
        taxRate: existing.taxRate,
        discount: existing.discount,
        notes: existing.notes,
        terms: existing.terms,
      };
    }

    const customerId = matchedCustomer?.id ?? '';
    const locations = customerId ? customerLocations(state, customerId) : [];

    return {
      customerId,
      locationId: locations[0]?.id ?? '',
      leadId: leadFromQuery?.id,
      title: leadFromQuery?.name ?? '',
      scope: leadFromQuery?.description ?? '',
      items: [createEmptyItem()],
      taxRate: state.settings.defaultTaxRate,
      discount: 0,
      notes: '',
      terms: state.settings.defaultTerms,
    };
  }, [existing, leadFromQuery, matchedCustomer, state]);

  const [draft, setDraft] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const locations = draft.customerId ? customerLocations(state, draft.customerId) : [];

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
    setDirty(true);
  };

  const validate = () => {
    const found: Record<string, string> = {};
    if (!draft.customerId) found.customerId = 'Select a customer.';
    if (!draft.locationId) found.locationId = 'Select a service location.';
    if (!draft.title.trim()) found.title = 'Give the estimate a project title.';

    const priced = draft.items.filter(
      (item) => item.description.trim() && item.quantity > 0 && item.unitPrice > 0,
    );
    if (priced.length === 0) {
      found.items = 'Add at least one line item with a description, quantity and price.';
    }
    const incomplete = draft.items.find((item) => !item.description.trim() && item.unitPrice > 0);
    if (incomplete) found.items = 'Every priced line item needs a description.';

    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.getElementById(Object.keys(found)[0])?.focus();
      return false;
    }
    return true;
  };

  const save = (markSent: boolean) => {
    if (!validate()) return;

    // Empty rows left behind while editing are dropped rather than saved.
    const items = draft.items.filter((item) => item.description.trim() || item.unitPrice > 0);

    if (existing) {
      dispatch({
        type: 'estimate/update',
        id: existing.id,
        patch: {
          customerId: draft.customerId,
          locationId: draft.locationId,
          title: draft.title.trim(),
          scope: draft.scope.trim(),
          items,
          taxRate: draft.taxRate,
          discount: draft.discount,
          notes: draft.notes.trim(),
          terms: draft.terms.trim(),
        },
      });
      if (markSent && existing.status === 'Draft') {
        dispatch({ type: 'estimate/status', id: existing.id, status: 'Sent' });
      }
      notify(`Estimate ${existing.code} saved.`, 'success');
      setDirty(false);
      navigate(paths.estimate(existing.id));
      return;
    }

    // The id is generated here so navigation can target the new estimate.
    // Reading it back from state after dispatch would read the stale value.
    const newId = createId('est');
    dispatch({
      type: 'estimate/create',
      id: newId,
      input: {
        customerId: draft.customerId,
        locationId: draft.locationId,
        leadId: draft.leadId,
        title: draft.title.trim(),
        scope: draft.scope.trim(),
        items,
        taxRate: draft.taxRate,
        discount: draft.discount,
        notes: draft.notes.trim(),
        terms: draft.terms.trim(),
        status: markSent ? 'Sent' : 'Draft',
      },
    });

    track('estimate_created', { fromLead: Boolean(draft.leadId), lineItems: items.length });
    notify(markSent ? 'Estimate saved and marked sent.' : 'Estimate saved as a draft.', 'success');
    setDirty(false);
    navigate(paths.estimate(newId));
  };

  const cancel = () => {
    if (dirty) {
      setLeaveOpen(true);
      return;
    }
    navigate(existing ? paths.estimate(existing.id) : paths.module('estimates'));
  };

  if (estimateId && !existing) {
    return (
      <EmptyState
        title="Estimate not found"
        action={<LinkButton href={paths.module('estimates')}>Back to estimates</LinkButton>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <a href={paths.module('estimates')} className="hover:text-copper transition-colors">
            Estimates
          </a>
        }
        title={existing ? `Edit ${existing.code}` : 'New estimate'}
        description={
          leadFromQuery
            ? `Pre-filled from lead ${leadFromQuery.code}.`
            : 'Price the work, then send it for the customer to accept.'
        }
        actions={
          <>
            <Button onClick={cancel}>Cancel</Button>
            <Button onClick={() => save(false)}>Save draft</Button>
            <Button variant="primary" onClick={() => save(true)}>
              Save and mark sent
            </Button>
          </>
        }
      />

      <Panel>
        <PanelHeader title="Project" />
        <div className="px-3.5 py-3.5 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <FormField
              label="Customer"
              htmlFor="customerId"
              error={errors.customerId}
              hint={
                !draft.customerId && leadFromQuery ? (
                  <>
                    This lead has no customer record yet.{' '}
                    <button
                      type="button"
                      onClick={() => setCustomerFormOpen(true)}
                      className="underline underline-offset-2 text-charcoal hover:text-copper"
                    >
                      Create one
                    </button>
                    .
                  </>
                ) : undefined
              }
            >
              <Select
                id="customerId"
                value={draft.customerId}
                invalid={Boolean(errors.customerId)}
                onChange={(event) => {
                  const customerId = event.target.value;
                  const first = customerId ? customerLocations(state, customerId)[0] : undefined;
                  setDraft((current) => ({
                    ...current,
                    customerId,
                    locationId: first?.id ?? '',
                  }));
                  setErrors((current) => ({ ...current, customerId: '', locationId: '' }));
                  setDirty(true);
                }}
              >
                <option value="">Select a customer</option>
                {state.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              label="Service location"
              htmlFor="locationId"
              error={errors.locationId}
              hint={!draft.customerId ? 'Choose a customer first.' : undefined}
            >
              <Select
                id="locationId"
                value={draft.locationId}
                disabled={!draft.customerId}
                invalid={Boolean(errors.locationId)}
                onChange={(event) => set('locationId', event.target.value)}
              >
                <option value="">Select a location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.label} — {formatAddressShort(location.address)}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Project title" htmlFor="title" error={errors.title}>
            <TextInput
              id="title"
              value={draft.title}
              invalid={Boolean(errors.title)}
              placeholder="e.g. Hail damage roof replacement"
              onChange={(event) => set('title', event.target.value)}
            />
          </FormField>

          <FormField label="Scope of work" htmlFor="scope" optional>
            <TextArea
              id="scope"
              rows={4}
              value={draft.scope}
              placeholder="Describe what is included, in the words the customer will read."
              onChange={(event) => set('scope', event.target.value)}
            />
          </FormField>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Line items" meta="Labor, materials, equipment, permits and fees" />
        <div className="px-2 py-3">
          <LineItemEditor
            items={draft.items}
            onChange={(items) => set('items', items)}
            taxRate={draft.taxRate}
            onTaxRateChange={(rate) => set('taxRate', rate)}
            discount={draft.discount}
            onDiscountChange={(discount) => set('discount', discount)}
            error={errors.items}
          />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Notes and terms" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 px-3.5 py-3.5">
          <FormField label="Notes to the customer" htmlFor="notes" optional>
            <TextArea
              id="notes"
              rows={3}
              value={draft.notes}
              onChange={(event) => set('notes', event.target.value)}
            />
          </FormField>
          <FormField label="Terms" htmlFor="terms" optional>
            <TextArea
              id="terms"
              rows={3}
              value={draft.terms}
              onChange={(event) => set('terms', event.target.value)}
            />
          </FormField>
        </div>
      </Panel>

      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={cancel}>Cancel</Button>
        <Button onClick={() => save(false)}>Save draft</Button>
        <Button variant="primary" onClick={() => save(true)}>
          Save and mark sent
        </Button>
      </div>

      <CustomerForm
        open={customerFormOpen}
        onClose={() => setCustomerFormOpen(false)}
        prefill={
          leadFromQuery
            ? {
                name: leadFromQuery.contactName,
                phone: leadFromQuery.phone,
                email: leadFromQuery.email,
                billingAddress: leadFromQuery.serviceAddress,
              }
            : undefined
        }
        onCreated={(customerId, locationId) => {
          setDraft((current) => ({ ...current, customerId, locationId }));
          setErrors((current) => ({ ...current, customerId: '', locationId: '' }));
          setDirty(true);
        }}
      />

      <ConfirmDialog
        open={leaveOpen}
        onCancel={() => setLeaveOpen(false)}
        onConfirm={() => {
          setLeaveOpen(false);
          navigate(existing ? paths.estimate(existing.id) : paths.module('estimates'));
        }}
        title="Discard unsaved changes?"
        confirmLabel="Discard changes"
        tone="danger"
        description="This estimate has changes that have not been saved. Leaving now will lose them."
      />
    </div>
  );
}
