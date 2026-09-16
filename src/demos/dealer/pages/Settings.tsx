import { useState } from 'react';
import { useDealer, useWorkspace } from '../DealerProvider';
import { useRouter } from '../../../lib/router';
import { track } from '../../../lib/analytics';
import { paths } from '../dealer.routes';
import { DEMO_ROLES, type DemoRole } from '../dealer.types';
import { ROLE_MODULES, CLOSING_ROLES } from '../dealer.selectors';
import { MODULE_TITLES } from '../dealer.routes';
import { STORAGE_KEY } from '../dealer.storage';
import { centsToInput, dollarsToCents, formatAddress } from '../dealer.utils';
import {
  Button,
  Detail,
  FormField,
  PageHeader,
  Panel,
  PanelHeader,
  TextArea,
} from '../../shared/ui/AppUI';
import { ConfirmDialog } from '../../shared/ui/Dialog';
import { MoneyInput, NumberInput, useForm } from '../../shared/ui/formControls';

/** Workspace settings, demo role reference and the reset control. */

export function SettingsPage() {
  const state = useWorkspace();
  const { dispatch, notify, resetDemo } = useDealer();
  const { navigate } = useRouter();
  const [resetOpen, setResetOpen] = useState(false);

  const form = useForm({
    taxRate: String(state.settings.defaultTaxRate),
    holdDays: String(state.settings.reservationHoldDays),
    deposit: centsToInput(state.settings.defaultDeposit),
    dealTerms: state.settings.dealTerms,
  });

  const save = () => {
    const rate = Number(form.values.taxRate);
    const days = Number(form.values.holdDays);

    const valid = form.validate((values) => ({
      taxRate:
        Number.isFinite(Number(values.taxRate)) && Number(values.taxRate) >= 0 && Number(values.taxRate) <= 25
          ? undefined
          : 'Enter a tax rate between 0 and 25.',
      holdDays:
        Number.isInteger(Number(values.holdDays)) && Number(values.holdDays) > 0
          ? undefined
          : 'A hold has to last at least one day.',
    }));
    if (!valid) return;

    dispatch({
      type: 'settings/update',
      patch: {
        defaultTaxRate: rate,
        reservationHoldDays: days,
        defaultDeposit: dollarsToCents(form.values.deposit || '0'),
        dealTerms: form.values.dealTerms.trim(),
      },
    });
    notify('Defaults saved.', 'success');
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Workspace defaults and the demo controls. Everything here is local to your browser."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel>
          <PanelHeader title="Dealership" />
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Detail label="Name">{state.settings.companyName}</Detail>
            <Detail label="Phone">{state.settings.phone}</Detail>
            <Detail label="Email">{state.settings.email}</Detail>
            <Detail label="Locations">{state.locations.length}</Detail>
            <div className="sm:col-span-2">
              <Detail label="Address">{formatAddress(state.settings.address)}</Detail>
            </div>
            <div className="sm:col-span-2">
              <Detail label="Legal line">{state.settings.legalLine}</Detail>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Document defaults"
            actions={
              <Button size="sm" variant="primary" onClick={save}>
                Save defaults
              </Button>
            }
          />
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Sales tax %" htmlFor="taxRate" error={form.errors.taxRate}>
                <NumberInput
                  id="taxRate"
                  step="0.01"
                  max="25"
                  value={form.values.taxRate}
                  onChange={(value) => form.set('taxRate', value)}
                />
              </FormField>

              <FormField label="Hold days" htmlFor="holdDays" error={form.errors.holdDays}>
                <NumberInput
                  id="holdDays"
                  min="1"
                  max="90"
                  value={form.values.holdDays}
                  onChange={(value) => form.set('holdDays', value)}
                />
              </FormField>

              <FormField label="Default deposit" htmlFor="deposit">
                <MoneyInput
                  id="deposit"
                  value={form.values.deposit}
                  onChange={(value) => form.set('deposit', value)}
                />
              </FormField>
            </div>

            <FormField label="Deal summary terms" htmlFor="dealTerms">
              <TextArea
                id="dealTerms"
                rows={3}
                value={form.values.dealTerms}
                onChange={(event) => form.set('dealTerms', event.target.value)}
              />
            </FormField>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Demo roles" meta="Not authentication" />
        <div className="p-4">
          <p className="text-[0.8125rem] text-muted mb-3">
            The role control in the sidebar changes which modules are shown, so you can see the
            workspace the way each part of a dealership would. It is a view, not a login, and it
            resets when the page reloads.
          </p>
          <ul className="divide-y divide-app-border">
            {DEMO_ROLES.map((role) => (
              <li key={role.id} className="py-2.5">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[0.875rem] font-medium text-charcoal">{role.label}</span>
                  {CLOSING_ROLES.includes(role.id as DemoRole) && (
                    <span className="text-[0.6875rem] uppercase tracking-[0.1em] text-copper">
                      can close deals
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[0.75rem] text-muted">
                  {ROLE_MODULES[role.id]
                    .map((module) => MODULE_TITLES[module])
                    .join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel>
          <PanelHeader title="Demo data" />
          <div className="p-4 space-y-3">
            <p className="text-[0.8125rem] text-muted">
              This workspace lives in your own browser under{' '}
              <code className="font-mono text-[0.75rem] text-charcoal">{STORAGE_KEY}</code>. Nothing
              is sent to a server, nothing is shared with anyone else, and no demo record ever
              reaches the BriveXis contact inbox or analytics.
            </p>
            <p className="text-[0.8125rem] text-muted">
              Resetting restores the original sample data and discards every change you have made.
            </p>
            <Button variant="danger" onClick={() => setResetOpen(true)}>
              Reset demo workspace
            </Button>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Workspace" />
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Detail label="Vehicles">{state.vehicles.length}</Detail>
            <Detail label="Leads">{state.leads.length}</Detail>
            <Detail label="Customers">{state.customers.length}</Detail>
            <Detail label="Reservations">{state.reservations.length}</Detail>
            <Detail label="Deals">{state.deals.length}</Detail>
            <Detail label="Financing">{state.financing.length}</Detail>
            <Detail label="Payments">{state.payments.length}</Detail>
            <Detail label="Documents">{state.documents.length}</Detail>
            <Detail label="Tasks">{state.tasks.length}</Detail>
          </div>
        </Panel>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          resetDemo();
          setResetOpen(false);
          navigate(paths.root);
          track('dealer_demo_reset');
          notify('Demo workspace reset to its starting data.', 'success');
        }}
        title="Reset the demo workspace?"
        confirmLabel="Reset demo"
        tone="danger"
        description={
          <>
            <p>
              Every change you have made — new leads, customers, reservations, deals, financing
              records and payments — will be discarded and the workspace restored to its original
              sample data.
            </p>
            <p className="mt-2 text-muted">This cannot be undone.</p>
          </>
        }
      />
    </div>
  );
}
