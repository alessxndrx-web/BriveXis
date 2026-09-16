import { useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useWorkspace } from '../DealerProvider';
import { paths } from '../dealer.routes';
import type { FinancingApplication } from '../dealer.types';
import { FINANCING_STATUSES } from '../dealer.types';
import {
  activityFor,
  getCustomer,
  getDeal,
  getVehicle,
  salespersonName,
} from '../dealer.selectors';
import { formatDate, formatMoney, matches, vehicleTitle } from '../dealer.utils';
import {
  Button,
  Detail,
  EmptyState,
  InlineField,
  LinkButton,
  PageHeader,
  Panel,
  PanelHeader,
  Select,
  TextInput,
  Toolbar,
} from '../../shared/ui/AppUI';
import { CellMeta, CodeCell, DataTable, type Column } from '../../shared/ui/DataTable';
import { FinancingStatusBadge } from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import { FinancingStatusForm } from '../forms/FinanceForms';

/**
 * Financing.
 *
 * An operational tracker, not a lending system. Every status on this screen is
 * there because a person recorded it; nothing here assesses credit, contacts a
 * lender or produces a decision, and the notice says so on every view.
 */

const COMPLIANCE =
  'Demo workflow only — no real credit decision or financing submission is performed. No Social Security number, bank credentials or account details are collected anywhere in this demo.';

const ALL = 'all';

export function FinancingPage() {
  const state = useWorkspace();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>(ALL);

  const rows = useMemo(
    () =>
      state.financing.filter((application) => {
        if (status !== ALL && application.status !== status) return false;
        const customer = getCustomer(state, application.customerId);
        return matches(query, application.code, customer?.name, application.lenderCategory);
      }),
    [state, query, status],
  );

  const columns: Column<FinancingApplication>[] = [
    {
      key: 'application',
      header: 'Application',
      sortValue: (application) => application.code,
      cell: (application) => {
        const customer = getCustomer(state, application.customerId);
        return (
          <>
            <span className="font-medium text-charcoal">{customer?.name ?? 'Unknown'}</span>
            <CellMeta>
              <CodeCell>{application.code}</CodeCell> · {application.lenderCategory}
            </CellMeta>
          </>
        );
      },
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      hideBelow: 'md',
      sortValue: (application) => getVehicle(state, application.vehicleId)?.code ?? '',
      cell: (application) => {
        const vehicle = getVehicle(state, application.vehicleId);
        return vehicle ? <span className="text-charcoal">{vehicleTitle(vehicle)}</span> : '—';
      },
    },
    {
      key: 'amount',
      header: 'Requested',
      width: 'w-32',
      align: 'right',
      sortValue: (application) => application.amountRequested,
      cell: (application) => (
        <span className="tabular-nums text-charcoal">{formatMoney(application.amountRequested)}</span>
      ),
    },
    {
      key: 'term',
      header: 'Term',
      width: 'w-24',
      align: 'right',
      hideBelow: 'lg',
      sortValue: (application) => application.termMonths,
      cell: (application) => <span className="tabular-nums text-muted">{application.termMonths} mo</span>,
    },
    {
      key: 'submitted',
      header: 'Submitted',
      width: 'w-32',
      hideBelow: 'sm',
      sortValue: (application) => application.submittedAt ?? '0000',
      cell: (application) => (
        <span className="text-muted">
          {application.submittedAt ? formatDate(application.submittedAt) : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 'w-48',
      sortValue: (application) => application.status,
      cell: (application) => <FinancingStatusBadge status={application.status} />,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Financing"
        description="Where each application is in the process, recorded by the finance desk."
      />

      <p className="flex items-start gap-2 border border-app-border bg-app-panel rounded-[3px] px-3.5 py-2.5 text-[0.8125rem] text-muted">
        <ShieldAlert size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-copper" />
        {COMPLIANCE}
      </p>

      <Panel>
        <Toolbar>
          <div className="w-full sm:w-64">
            <label htmlFor="financing-search" className="sr-only">
              Search applications
            </label>
            <TextInput
              id="financing-search"
              type="search"
              placeholder="Application, customer…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <InlineField label="Status" htmlFor="financing-status-filter">
            <Select
              id="financing-status-filter"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All</option>
              {FINANCING_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </InlineField>

          {(query || status !== ALL) && (
            <Button
              size="sm"
              onClick={() => {
                setQuery('');
                setStatus(ALL);
              }}
            >
              Clear filters
            </Button>
          )}

          <span className="ml-auto text-[0.75rem] text-muted tabular-nums">
            {rows.length} of {state.financing.length}
          </span>
        </Toolbar>

        <DataTable
          caption="Financing applications"
          columns={columns}
          rows={rows}
          rowKey={(application) => application.id}
          rowHref={(application) => paths.financingApplication(application.id)}
          defaultSort={{ key: 'submitted', direction: 'desc' }}
          empty={
            <EmptyState
              title="No applications match these filters."
              action={
                <Button
                  onClick={() => {
                    setQuery('');
                    setStatus(ALL);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          }
        />
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------- financing detail

export function FinancingDetail({ applicationId }: { applicationId: string }) {
  const state = useWorkspace();
  const [statusOpen, setStatusOpen] = useState(false);

  const application = state.financing.find((entry) => entry.id === applicationId);

  if (!application) {
    return (
      <EmptyState
        title="That application is not in this workspace"
        action={<LinkButton href={paths.module('financing')}>Back to financing</LinkButton>}
      />
    );
  }

  const customer = getCustomer(state, application.customerId);
  const deal = getDeal(state, application.dealId);
  const vehicle = getVehicle(state, application.vehicleId);
  const events = activityFor(state, { kind: 'financing', id: application.id });

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <a href={paths.module('financing')} className="hover:text-copper transition-colors">
            Financing
          </a>
        }
        title={`${application.code} — ${customer?.name ?? 'Unknown customer'}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <FinancingStatusBadge status={application.status} />
            <span className="text-muted">
              {application.lenderCategory} · {salespersonName(state, application.financeContactId)}
            </span>
          </span>
        }
        actions={
          <>
            {deal && <LinkButton href={paths.deal(deal.id)}>View {deal.code}</LinkButton>}
            <Button variant="primary" onClick={() => setStatusOpen(true)}>
              Record status
            </Button>
          </>
        }
      />

      <p className="flex items-start gap-2 border border-app-border bg-app-panel rounded-[3px] px-3.5 py-2.5 text-[0.8125rem] text-muted">
        <ShieldAlert size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-copper" />
        {COMPLIANCE}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          <Panel>
            <PanelHeader title="Application" as="h2" />
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Detail label="Customer">
                {customer ? (
                  <a href={paths.customer(customer.id)} className="hover:text-copper transition-colors">
                    {customer.name}
                  </a>
                ) : (
                  '—'
                )}
              </Detail>
              <Detail label="Vehicle">
                {vehicle ? (
                  <a href={paths.vehicle(vehicle.id)} className="hover:text-copper transition-colors">
                    {vehicleTitle(vehicle)}
                  </a>
                ) : (
                  '—'
                )}
              </Detail>
              <Detail label="Deal">
                {deal ? (
                  <a href={paths.deal(deal.id)} className="hover:text-copper transition-colors">
                    {deal.code}
                  </a>
                ) : (
                  '—'
                )}
              </Detail>
              <Detail label="Amount requested">
                <span className="tabular-nums">{formatMoney(application.amountRequested)}</span>
              </Detail>
              <Detail label="Down payment">
                <span className="tabular-nums">{formatMoney(application.downPayment)}</span>
              </Detail>
              <Detail label="Term preference">{application.termMonths} months</Detail>
              <Detail label="Lender category">{application.lenderCategory}</Detail>
              <Detail label="Submitted">
                {application.submittedAt ? formatDate(application.submittedAt) : 'Not submitted'}
              </Detail>
              <Detail label="Decision recorded">
                {application.decisionAt ? formatDate(application.decisionAt) : '—'}
              </Detail>
              {application.decisionNotes && (
                <div className="col-span-2 sm:col-span-3">
                  <Detail label="Finance desk notes">{application.decisionNotes}</Detail>
                </div>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Activity" as="h2" />
            <div className="p-4">
              <Timeline events={events} />
            </div>
          </Panel>
        </div>

        <Panel>
          <PanelHeader title="What this does not do" as="h3" />
          <div className="p-4 space-y-2 text-[0.8125rem] text-muted">
            <p>It does not assess credit or produce a score.</p>
            <p>It does not submit anything to a lender.</p>
            <p>It does not approve or decline an application.</p>
            <p>It does not collect a Social Security number, bank credentials, a driver licence
              number or account details.</p>
            <p className="text-charcoal">
              It records where an application has got to, so the desk and the showroom are looking
              at the same thing.
            </p>
          </div>
        </Panel>
      </div>

      <FinancingStatusForm
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        application={application}
      />
    </div>
  );
}
