import { useState } from 'react';
import { useContractor } from '../ContractorProvider';
import { useRouter } from '../../../lib/router';
import { paths } from '../contractor.routes';
import { STORAGE_KEY } from '../contractor.storage';
import { formatAddress, formatDateTime, formatPhone } from '../contractor.utils';
import {
  Button,
  Detail,
  FieldLabel,
  FormField,
  Panel,
  PanelHeader,
  PageHeader,
  TextArea,
} from '../components/AppUI';
import { ConfirmDialog } from '../components/Dialog';
import { NumberInput } from '../forms/formUtils';
import { track } from '../../../lib/analytics';

/**
 * Workspace settings.
 *
 * Only the values the rest of the demo actually consumes are editable: the
 * company details that appear on printed documents, and the defaults applied
 * to new estimates and invoices. Nothing here is decorative.
 */
export function SettingsPage() {
  const { state, dispatch, notify, resetDemo, role } = useContractor();
  const { navigate } = useRouter();
  const [resetOpen, setResetOpen] = useState(false);

  const [taxRate, setTaxRate] = useState(String(state.settings.defaultTaxRate));
  const [terms, setTerms] = useState(String(state.settings.paymentTermsDays));
  const [validity, setValidity] = useState(String(state.settings.estimateValidityDays));
  const [defaultTerms, setDefaultTerms] = useState(state.settings.defaultTerms);
  const [saved, setSaved] = useState(false);

  const save = () => {
    dispatch({
      type: 'settings/update',
      patch: {
        defaultTaxRate: Math.max(0, Number(taxRate) || 0),
        paymentTermsDays: Math.max(0, Math.round(Number(terms) || 0)),
        estimateValidityDays: Math.max(1, Math.round(Number(validity) || 30)),
        defaultTerms,
      },
    });
    setSaved(true);
    notify('Workspace defaults saved.', 'success');
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Company details used on printed documents, and the defaults applied to new records."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel>
          <PanelHeader title="Company" meta="Shown on estimates and invoices" />
          <div className="grid grid-cols-2 gap-4 px-3.5 py-3.5">
            <Detail label="Business name">{state.settings.companyName}</Detail>
            <Detail label="Legal entity">{state.settings.legalLine}</Detail>
            <Detail label="Phone">{formatPhone(state.settings.phone)}</Detail>
            <Detail label="Email">{state.settings.email}</Detail>
            <Detail label="License">{state.settings.license}</Detail>
            <Detail label="Address" className="col-span-2">
              {formatAddress(state.settings.address)}
            </Detail>
          </div>
          <p className="border-t border-app-border px-3.5 py-2 text-[0.75rem] text-muted">
            Northline Contracting is a fictional company created for this demonstration.
          </p>
        </Panel>

        <Panel>
          <PanelHeader title="Document defaults" />
          <div className="px-3.5 py-3.5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Sales tax (%)" htmlFor="taxRate">
                <NumberInput
                  id="taxRate"
                  min="0"
                  max="25"
                  step="0.01"
                  value={taxRate}
                  onChange={(value) => {
                    setTaxRate(value);
                    setSaved(false);
                  }}
                />
              </FormField>

              <FormField label="Payment terms (days)" htmlFor="terms">
                <NumberInput
                  id="terms"
                  min="0"
                  max="120"
                  step="1"
                  value={terms}
                  onChange={(value) => {
                    setTerms(value);
                    setSaved(false);
                  }}
                />
              </FormField>

              <FormField label="Estimate validity (days)" htmlFor="validity">
                <NumberInput
                  id="validity"
                  min="1"
                  max="365"
                  step="1"
                  value={validity}
                  onChange={(value) => {
                    setValidity(value);
                    setSaved(false);
                  }}
                />
              </FormField>
            </div>

            <FormField label="Default estimate terms" htmlFor="defaultTerms">
              <TextArea
                id="defaultTerms"
                rows={4}
                value={defaultTerms}
                onChange={(event) => {
                  setDefaultTerms(event.target.value);
                  setSaved(false);
                }}
              />
            </FormField>

            <div className="flex items-center gap-3">
              <Button variant="primary" onClick={save}>
                Save defaults
              </Button>
              {saved && <span className="text-[0.8125rem] text-success">Saved.</span>}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel>
          <PanelHeader title="Demo data" />
          <div className="px-3.5 py-3.5 space-y-3">
            <div>
              <FieldLabel>Where this data lives</FieldLabel>
              <p className="mt-1.5 text-[0.875rem] text-muted leading-relaxed">
                This workspace is stored only in your own browser, under{' '}
                <code className="text-[0.8125rem] text-charcoal">{STORAGE_KEY}</code>. Nothing is
                sent to a server, nothing is shared with other visitors, and clearing your
                browser data removes it.
              </p>
            </div>

            <div>
              <FieldLabel>Seeded</FieldLabel>
              <p className="mt-1 text-[0.875rem] text-muted">
                {formatDateTime(state.seededAt)}
              </p>
            </div>

            <div className="border-t border-app-border pt-3">
              <Button variant="danger" onClick={() => setResetOpen(true)}>
                Reset demo workspace
              </Button>
              <p className="mt-2 text-[0.75rem] text-muted">
                Restores the original sample data and discards everything you have changed.
              </p>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Workspace" />
          <div className="px-3.5 py-3.5 space-y-3">
            <div>
              <FieldLabel>Current demo role</FieldLabel>
              <p className="mt-1 text-[0.875rem] text-charcoal capitalize">{role}</p>
              <p className="mt-1 text-[0.75rem] text-muted">
                The role selector in the sidebar changes which modules are shown. It is a
                demonstration of role-based navigation, not authentication.
              </p>
            </div>

            <div className="border-t border-app-border pt-3">
              <FieldLabel>Team</FieldLabel>
              <ul className="mt-1.5 space-y-1">
                {state.users.map((user) => (
                  <li key={user.id} className="text-[0.875rem]">
                    <span className="text-charcoal">{user.name}</span>
                    <span className="text-muted"> · {user.title}</span>
                  </li>
                ))}
              </ul>
            </div>
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
          track('contractor_demo_reset');
          notify('Demo workspace reset to its starting data.', 'success');
        }}
        title="Reset the demo workspace?"
        confirmLabel="Reset demo"
        tone="danger"
        description={
          <>
            <p>
              Every change you have made — new leads, estimates, jobs, invoices and payments —
              will be discarded and the workspace restored to its original sample data.
            </p>
            <p className="mt-2 text-muted">This cannot be undone.</p>
          </>
        }
      />
    </div>
  );
}
