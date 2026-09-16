import { useState } from 'react';
import { useRouter } from '../../../lib/router';
import { track } from '../../../lib/analytics';
import { useDistribution, useWorkspace } from '../DistributionProvider';
import { DEMO_ROLES, MODULE_TITLES, ROLE_MODULES, paths } from '../distribution.routes';
import { STORAGE_KEY } from '../distribution.storage';
import { formatAddress, formatPhone } from '../distribution.utils';
import {
  Button,
  Detail,
  Metric,
  PageHeader,
  Panel,
  PanelHeader,
} from '../../shared/ui/AppUI';
import { ConfirmDialog } from '../../shared/ui/Dialog';

/**
 * Workspace settings and the honest description of what this demo is.
 *
 * Company details are fixed sample data rather than an editable profile: this
 * screen exists to explain how the workspace behaves — where its data lives,
 * what the demo roles change, and what the product deliberately does not do.
 */

export function SettingsPage() {
  const state = useWorkspace();
  const { role, setRole, resetDemo, notify } = useDistribution();
  const { navigate } = useRouter();
  const [resetOpen, setResetOpen] = useState(false);

  const { settings } = state;

  const recordCount =
    state.products.length +
    state.suppliers.length +
    state.customers.length +
    state.purchaseOrders.length +
    state.receipts.length +
    state.orders.length +
    state.shipments.length +
    state.invoices.length +
    state.payments.length +
    state.transfers.length +
    state.returns.length;

  const confirmReset = () => {
    resetDemo();
    setResetOpen(false);
    navigate(paths.root);
    track('distribution_demo_reset');
    notify('Demo workspace reset to its starting data.', 'success');
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="How this workspace is configured, and what it does and does not do."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Records" value={recordCount} meta="Across every module" />
        <Metric label="Movements" value={state.movements.length} meta="Inventory ledger entries" />
        <Metric label="Warehouses" value={state.warehouses.length} />
        <Metric label="Schema version" value={state.schemaVersion} meta="Stored data format" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* ------------------------------------------------- company */}
        <Panel>
          <PanelHeader title="Company profile" as="h2" meta="Fictional" />
          <div className="p-4 grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Detail label="Company">{settings.companyName}</Detail>
            </div>
            <div className="col-span-2">
              <Detail label="Address">{formatAddress(settings.address)}</Detail>
            </div>
            <Detail label="Phone">{formatPhone(settings.phone)}</Detail>
            <Detail label="Email">{settings.email}</Detail>
            <div className="col-span-2">
              <Detail label="Legal line">{settings.legalLine}</Detail>
            </div>
          </div>
        </Panel>

        {/* ------------------------------------------------ defaults */}
        <Panel>
          <PanelHeader title="Document defaults" as="h2" />
          <div className="p-4 grid grid-cols-2 gap-4">
            <Detail label="Sales tax">{(settings.defaultTaxBps / 100).toFixed(2)}%</Detail>
            <Detail label="Payment terms">Net {settings.paymentTermsDays}</Detail>
            <div className="col-span-2">
              <Detail label="Money">
                Every amount is stored as whole cents and tax as integer basis points, rounded once
                per document. Nothing in this workspace holds a floating-point dollar figure.
              </Detail>
            </div>
            <div className="col-span-2">
              <Detail label="Inventory">
                On-hand stock is never stored. It is the sum of the signed movement ledger, so the
                dashboard, a product page and a warehouse page cannot disagree.
              </Detail>
            </div>
          </div>
        </Panel>
      </div>

      {/* -------------------------------------------------- demo roles */}
      <Panel>
        <PanelHeader
          title="Demo roles"
          as="h2"
          meta="Navigation only — not authentication"
          actions={
            <label className="flex items-center gap-2 text-[0.8125rem] text-muted">
              <span>Current role</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as typeof role)}
                className="h-8 bg-white-surface border border-app-border rounded-[2px] px-2 text-[0.8125rem] text-charcoal focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper"
              >
                {DEMO_ROLES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          }
        />
        <ul className="divide-y divide-app-border">
          {DEMO_ROLES.map((option) => (
            <li key={option.id} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[0.875rem] font-medium text-charcoal">{option.label}</span>
                <span className="text-[0.8125rem] text-muted">{option.description}</span>
                {option.id === role && (
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-copper">
                    Active
                  </span>
                )}
              </div>
              <p className="mt-1 text-[0.75rem] text-muted">
                {ROLE_MODULES[option.id].map((module) => MODULE_TITLES[module]).join(' · ')}
              </p>
            </li>
          ))}
        </ul>
        <p className="border-t border-app-border px-4 py-2.5 text-[0.75rem] text-muted">
          Switching role changes which modules appear in the navigation. It is a demonstration of
          how a workspace can be scoped to a job, not a security boundary — every role reads the
          same data.
        </p>
      </Panel>

      {/* ------------------------------------------------------ data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel>
          <PanelHeader title="Data and storage" as="h2" />
          <div className="p-4 space-y-3">
            <Detail label="Where your changes live">
              In this browser only, under the key{' '}
              <span className="font-mono text-[0.8125rem]">{STORAGE_KEY}</span>. Nothing is sent to
              a server, and the workspace is not shared between browsers or devices.
            </Detail>
            <Detail label="If stored data cannot be read">
              The workspace falls back to the original sample data and says so, rather than
              starting from a half-loaded state.
            </Detail>
            <Detail label="Analytics">
              Page views and coarse event counts only. No customer names, supplier names,
              addresses, SKUs, product names, notes, amounts, tracking numbers or record contents
              ever leave this browser.
            </Detail>
          </div>
          <div className="border-t border-app-border px-4 py-3">
            <Button variant="danger" onClick={() => setResetOpen(true)}>
              Reset demo workspace
            </Button>
            <p className="mt-2 text-[0.75rem] text-muted">
              Discards every change you have made and restores the starting data.
            </p>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="What this demo does not do" as="h2" />
          <ul className="p-4 space-y-2.5 text-[0.875rem] text-charcoal">
            <li>
              <span className="font-medium">No payment processing.</span>{' '}
              <span className="text-muted">
                Payments are recorded after money is taken elsewhere. Demo only — no real
                transaction is processed, and the workspace never asks for card numbers or bank
                credentials.
              </span>
            </li>
            <li>
              <span className="font-medium">No accounting statements.</span>{' '}
              <span className="text-muted">
                There is no profit and loss statement, balance sheet or general ledger. Reporting
                here is operational.
              </span>
            </li>
            <li>
              <span className="font-medium">No carrier integration.</span>{' '}
              <span className="text-muted">
                Carriers and tracking numbers are typed in. Nothing is rated, booked or tracked
                with a real carrier.
              </span>
            </li>
            <li>
              <span className="font-medium">No real trading partners.</span>{' '}
              <span className="text-muted">
                {settings.companyName} and every supplier, customer, product and document in this
                workspace is fictional.
              </span>
            </li>
          </ul>
        </Panel>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onCancel={() => setResetOpen(false)}
        onConfirm={confirmReset}
        title="Reset the demo workspace?"
        confirmLabel="Reset demo"
        tone="danger"
        description={
          <>
            <p>
              Every change you have made in this demo — purchase orders, receipts, sales orders,
              shipments, invoices, payments, transfers and stock adjustments — will be discarded
              and the workspace restored to its original sample data.
            </p>
            <p className="mt-2 text-muted">This cannot be undone.</p>
          </>
        }
      />
    </div>
  );
}
