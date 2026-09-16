import { useMemo, useState } from 'react';
import { Copy, FileText, Plus, Printer } from 'lucide-react';
import { useContractor } from '../ContractorProvider';
import { useRouter } from '../../../lib/router';
import { ESTIMATE_STATUSES, type Estimate } from '../contractor.types';
import {
  activityFor,
  canCreateJobFromEstimate,
  estimateTotal,
  getCustomer,
  getLead,
  getLocation,
  jobForEstimate,
} from '../contractor.selectors';
import { paths } from '../contractor.routes';
import {
  formatAddress,
  formatDate,
  formatDateNumeric,
  formatMoney,
  matches,
} from '../contractor.utils';
import {
  Badge,
  Button,
  Detail,
  EmptyState,
  FieldLabel,
  InlineField,
  LinkButton,
  Panel,
  PanelHeader,
  PageHeader,
  Select,
  TextInput,
  Toolbar,
} from '../components/AppUI';
import { CellMeta, DataTable, type Column } from '../components/DataTable';
import { EstimateStatusBadge, JobStatusBadge } from '../components/StatusBadge';
import { LineItemTable, TotalsSummary } from '../components/LineItemEditor';
import { Timeline } from '../components/Timeline';
import { ConfirmDialog } from '../components/Dialog';
import { track } from '../../../lib/analytics';

export function EstimatesPage() {
  const { state } = useContractor();
  const { navigate } = useRouter();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');

  const filtered = useMemo(
    () =>
      state.estimates.filter((estimate) => {
        if (status !== 'all' && estimate.status !== status) return false;
        const customer = getCustomer(state, estimate.customerId);
        return matches(query, estimate.code, estimate.title, customer?.name);
      }),
    [state, query, status],
  );

  const columns: Column<Estimate>[] = [
    {
      key: 'title',
      header: 'Estimate',
      sortValue: (estimate) => estimate.title,
      cell: (estimate) => (
        <>
          <span className="block truncate max-w-[18rem]">{estimate.title}</span>
          <CellMeta>{estimate.code}</CellMeta>
        </>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      sortValue: (estimate) => getCustomer(state, estimate.customerId)?.name ?? '',
      cell: (estimate) => (
        <span className="text-[0.8125rem] text-muted truncate block max-w-[14rem]">
          {getCustomer(state, estimate.customerId)?.name}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 'w-28',
      sortValue: (estimate) => ESTIMATE_STATUSES.indexOf(estimate.status),
      cell: (estimate) => <EstimateStatusBadge status={estimate.status} />,
    },
    {
      key: 'issued',
      header: 'Issued',
      width: 'w-28',
      hideBelow: 'md',
      sortValue: (estimate) => estimate.issuedAt,
      cell: (estimate) => (
        <span className="text-[0.8125rem] tabular-nums text-muted">
          {formatDateNumeric(estimate.issuedAt)}
        </span>
      ),
    },
    {
      key: 'expires',
      header: 'Expires',
      width: 'w-28',
      hideBelow: 'lg',
      sortValue: (estimate) => estimate.expiresAt,
      cell: (estimate) => (
        <span className="text-[0.8125rem] tabular-nums text-muted">
          {formatDateNumeric(estimate.expiresAt)}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      width: 'w-32',
      align: 'right',
      sortValue: (estimate) => estimateTotal(estimate),
      cell: (estimate) => (
        <span className="tabular-nums text-[0.8125rem] text-charcoal">
          {formatMoney(estimateTotal(estimate))}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Estimates"
        description="Quoted work and where each estimate stands with the customer."
        actions={
          <Button variant="primary" onClick={() => navigate(paths.estimateNew())}>
            <Plus size={14} aria-hidden="true" />
            New estimate
          </Button>
        }
      />

      <Panel>
        <Toolbar>
          <div className="flex-1 min-w-[12rem]">
            <label htmlFor="estimate-search" className="sr-only">
              Search estimates
            </label>
            <TextInput
              id="estimate-search"
              type="search"
              placeholder="Search by title, code or customer…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-8"
            />
          </div>

          <InlineField label="Status" htmlFor="estimate-status">
            <Select
              id="estimate-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-8 w-auto"
            >
              <option value="all">All</option>
              {ESTIMATE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </InlineField>

          <span className="ml-auto text-[0.75rem] text-muted tabular-nums">
            {filtered.length} of {state.estimates.length}
          </span>
        </Toolbar>

        <DataTable
          caption="Estimates"
          columns={columns}
          rows={filtered}
          rowKey={(estimate) => estimate.id}
          rowHref={(estimate) => paths.estimate(estimate.id)}
          defaultSort={{ key: 'issued', direction: 'desc' }}
          empty={
            <EmptyState
              title="No estimates match these filters."
              action={
                <Button
                  onClick={() => {
                    setQuery('');
                    setStatus('all');
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

// -------------------------------------------------------------- detail

export function EstimateDetail({ estimateId }: { estimateId: string }) {
  const { state, dispatch, notify } = useContractor();
  const { navigate } = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const estimate = state.estimates.find((candidate) => candidate.id === estimateId);
  const events = useMemo(
    () => (estimate ? activityFor(state, 'estimate', estimate.id) : []),
    [state, estimate],
  );

  if (!estimate) {
    return (
      <EmptyState
        title="Estimate not found"
        action={<LinkButton href={paths.module('estimates')}>Back to estimates</LinkButton>}
      />
    );
  }

  const customer = getCustomer(state, estimate.customerId);
  const location = getLocation(state, estimate.locationId);
  const lead = getLead(state, estimate.leadId);
  const job = jobForEstimate(state, estimate.id);
  const canCreateJob = canCreateJobFromEstimate(state, estimate);

  const setStatus = (status: Estimate['status']) => {
    dispatch({ type: 'estimate/status', id: estimate.id, status });
    if (status === 'Accepted') track('estimate_accepted');
    notify(`${estimate.code} marked ${status.toLowerCase()}.`, 'success');
  };

  const createJob = () => {
    dispatch({ type: 'job/createFromEstimate', estimateId: estimate.id });
    track('job_created', { fromEstimate: true });
    notify('Job created from the accepted estimate.', 'success');
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <a href={paths.module('estimates')} className="hover:text-copper transition-colors">
            Estimates
          </a>
        }
        title={estimate.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <EstimateStatusBadge status={estimate.status} />
            <span className="text-muted">
              {estimate.code} · {customer?.name} · issued {formatDate(estimate.issuedAt)}
            </span>
          </span>
        }
        actions={
          <>
            <LinkButton href={paths.estimatePrint(estimate.id)}>
              <Printer size={14} aria-hidden="true" />
              Print
            </LinkButton>
            <Button
              onClick={() => {
                dispatch({ type: 'estimate/duplicate', id: estimate.id });
                notify('Estimate duplicated as a new draft.', 'success');
              }}
            >
              <Copy size={14} aria-hidden="true" />
              Duplicate
            </Button>
            <Button onClick={() => navigate(paths.estimateEdit(estimate.id))}>Edit</Button>
            {job ? (
              <LinkButton variant="primary" href={paths.job(job.id)}>
                View job {job.code}
              </LinkButton>
            ) : canCreateJob ? (
              <Button variant="primary" onClick={createJob}>
                Create job
              </Button>
            ) : null}
          </>
        }
      />

      {/* Workflow guidance. An estimate only becomes a job once accepted, so the
          reason the action is unavailable is stated rather than left implicit. */}
      {!job && estimate.status !== 'Accepted' && (
        <div className="flex items-start gap-2.5 border border-app-border bg-app-panel rounded-[3px] px-3.5 py-2.5">
          <FileText size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />
          <p className="text-[0.8125rem] text-muted">
            {estimate.status === 'Draft'
              ? 'This estimate is still a draft. Mark it sent once it goes to the customer.'
              : estimate.status === 'Declined' || estimate.status === 'Expired'
                ? 'Work can only be scheduled from an accepted estimate. Duplicate it to re-quote.'
                : 'A job can be created once the customer accepts this estimate.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Panel>
            <PanelHeader title="Details" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 px-3.5 py-3.5">
              <Detail label="Customer">
                {customer ? (
                  <a
                    href={paths.customer(customer.id)}
                    className="hover:text-copper transition-colors"
                  >
                    {customer.name}
                  </a>
                ) : (
                  '—'
                )}
              </Detail>
              <Detail label="Expires">{formatDate(estimate.expiresAt)}</Detail>
              <Detail label="From lead">
                {lead ? (
                  <a href={paths.lead(lead.id)} className="hover:text-copper transition-colors">
                    {lead.code}
                  </a>
                ) : (
                  '—'
                )}
              </Detail>
              <Detail label="Service location" className="col-span-2 sm:col-span-3">
                {location ? (
                  <>
                    <span className="font-medium">{location.label}</span>{' '}
                    <span className="text-muted">{formatAddress(location.address)}</span>
                  </>
                ) : (
                  '—'
                )}
              </Detail>
            </div>

            {estimate.scope && (
              <div className="border-t border-app-border px-3.5 py-3.5">
                <FieldLabel>Scope of work</FieldLabel>
                <p className="mt-1.5 text-[0.875rem] text-charcoal leading-relaxed whitespace-pre-line">
                  {estimate.scope}
                </p>
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Pricing" meta={`${estimate.items.length} line items`} />
            <LineItemTable items={estimate.items} />
            <div className="border-t border-app-border px-3.5 py-3.5">
              <TotalsSummary
                items={estimate.items}
                taxRate={estimate.taxRate}
                discount={estimate.discount}
              />
            </div>
          </Panel>

          {(estimate.notes || estimate.terms) && (
            <Panel>
              <PanelHeader title="Notes and terms" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-3.5 py-3.5">
                {estimate.notes && (
                  <div>
                    <FieldLabel>Notes</FieldLabel>
                    <p className="mt-1.5 text-[0.875rem] text-charcoal leading-relaxed">
                      {estimate.notes}
                    </p>
                  </div>
                )}
                {estimate.terms && (
                  <div>
                    <FieldLabel>Terms</FieldLabel>
                    <p className="mt-1.5 text-[0.8125rem] text-muted leading-relaxed">
                      {estimate.terms}
                    </p>
                  </div>
                )}
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Status" />
            <div className="px-3.5 py-3.5 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {estimate.status === 'Draft' && (
                  <Button size="sm" onClick={() => setStatus('Sent')}>
                    Mark sent
                  </Button>
                )}
                {(estimate.status === 'Sent' || estimate.status === 'Viewed') && (
                  <>
                    <Button size="sm" variant="primary" onClick={() => setStatus('Accepted')}>
                      Mark accepted
                    </Button>
                    <Button size="sm" onClick={() => setStatus('Declined')}>
                      Mark declined
                    </Button>
                  </>
                )}
                {estimate.status === 'Sent' && (
                  <Button size="sm" onClick={() => setStatus('Viewed')}>
                    Mark viewed
                  </Button>
                )}
                {estimate.status === 'Expired' && (
                  <Button size="sm" onClick={() => setStatus('Sent')}>
                    Re-issue as sent
                  </Button>
                )}
                {estimate.status === 'Accepted' && (
                  <Badge tone="success">Accepted — ready to schedule</Badge>
                )}
              </div>

              {estimate.status === 'Draft' && (
                <div className="pt-2 border-t border-app-border">
                  <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
                    Delete draft
                  </Button>
                </div>
              )}
            </div>
          </Panel>

          {job && (
            <Panel>
              <PanelHeader title="Job" />
              <a
                href={paths.job(job.id)}
                className="flex items-center justify-between gap-3 px-3.5 py-3 transition-colors hover:bg-app-hover"
              >
                <span className="min-w-0">
                  <span className="block text-[0.875rem] text-charcoal truncate">{job.title}</span>
                  <CellMeta>{job.code}</CellMeta>
                </span>
                <JobStatusBadge status={job.status} />
              </a>
            </Panel>
          )}

          <Panel>
            <PanelHeader title="Activity" />
            <div className="px-3.5 py-2">
              <Timeline events={events} />
            </div>
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          dispatch({ type: 'estimate/delete', id: estimate.id });
          setConfirmDelete(false);
          notify(`Draft ${estimate.code} deleted.`);
          navigate(paths.module('estimates'));
        }}
        title="Delete this draft?"
        confirmLabel="Delete draft"
        tone="danger"
        description={`${estimate.code} has not been sent to the customer. Deleting it removes it from the workspace.`}
      />
    </div>
  );
}
