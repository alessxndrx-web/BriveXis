import { useMemo, useState } from 'react';
import { CalendarDays, MapPin, Phone, Plus, Receipt, UserPlus } from 'lucide-react';
import { useContractor } from '../ContractorProvider';
import { JOB_STATUSES, type Job } from '../contractor.types';
import {
  activityFor,
  canInvoiceJob,
  crewMembers,
  estimateTotal,
  getCrew,
  getCustomer,
  getEstimate,
  getLocation,
  invoiceBalance,
  invoiceStatus,
  invoiceTotal,
  invoicesForJob,
  jobFieldRecords,
  jobProgressLabel,
} from '../contractor.selectors';
import { paths } from '../contractor.routes';
import {
  formatAddress,
  formatAddressShort,
  formatDate,
  formatDateNumeric,
  formatDateTime,
  formatMoney,
  formatPhone,
  formatScheduleWindow,
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
  PageHeader,
  Select,
  Tabs,
  TextInput,
  Toolbar,
} from '../components/AppUI';
import { CellMeta, DataTable, type Column } from '../components/DataTable';
import {
  EstimateStatusBadge,
  InvoiceStatusBadge,
  JobStatusBadge,
  PriorityBadge,
} from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import { ConfirmDialog } from '../components/Dialog';
import {
  AssignCrewDialog,
  CompleteJobDialog,
  FieldRecordForm,
  JobForm,
  ScheduleDialog,
} from '../forms/JobForms';
import { track } from '../../../lib/analytics';

export function JobsPage() {
  const { state } = useContractor();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [crewId, setCrewId] = useState('all');
  const [formOpen, setFormOpen] = useState(false);

  const filtered = useMemo(
    () =>
      state.jobs.filter((job) => {
        if (status !== 'all' && job.status !== status) return false;
        if (crewId !== 'all') {
          if (crewId === 'unassigned' ? Boolean(job.crewId) : job.crewId !== crewId) return false;
        }
        const customer = getCustomer(state, job.customerId);
        return matches(query, job.code, job.title, customer?.name);
      }),
    [state, query, status, crewId],
  );

  const columns: Column<Job>[] = [
    {
      key: 'title',
      header: 'Job',
      sortValue: (job) => job.title,
      cell: (job) => (
        <>
          <span className="block truncate max-w-[17rem]">{job.title}</span>
          <CellMeta>{job.code}</CellMeta>
        </>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      sortValue: (job) => getCustomer(state, job.customerId)?.name ?? '',
      cell: (job) => (
        <span className="text-[0.8125rem] text-muted truncate block max-w-[13rem]">
          {getCustomer(state, job.customerId)?.name}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 'w-32',
      sortValue: (job) => JOB_STATUSES.indexOf(job.status),
      cell: (job) => (
        <span className="flex items-center gap-1.5">
          <JobStatusBadge status={job.status} />
          <PriorityBadge priority={job.priority} />
        </span>
      ),
    },
    {
      key: 'scheduled',
      header: 'Scheduled',
      width: 'w-32',
      hideBelow: 'md',
      sortValue: (job) => job.scheduledStart ?? '9999',
      cell: (job) => (
        <span className="text-[0.8125rem] tabular-nums text-muted">
          {job.scheduledStart ? formatDateNumeric(job.scheduledStart) : '—'}
        </span>
      ),
    },
    {
      key: 'crew',
      header: 'Crew',
      width: 'w-36',
      hideBelow: 'lg',
      sortValue: (job) => getCrew(state, job.crewId)?.name ?? 'zzz',
      cell: (job) => {
        const crew = getCrew(state, job.crewId);
        return crew ? (
          <span className="text-[0.8125rem] text-muted">{crew.name}</span>
        ) : (
          <Badge tone="warning">Unassigned</Badge>
        );
      },
    },
    {
      key: 'location',
      header: 'Location',
      hideBelow: 'lg',
      cell: (job) => {
        const location = getLocation(state, job.locationId);
        return (
          <span className="text-[0.8125rem] text-muted truncate block max-w-[12rem]">
            {location ? formatAddressShort(location.address) : '—'}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Jobs"
        description="Work in the pipeline, from unscheduled through to completion."
        actions={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <Plus size={14} aria-hidden="true" />
            New job
          </Button>
        }
      />

      <Panel>
        <Toolbar>
          <div className="flex-1 min-w-[12rem]">
            <label htmlFor="job-search" className="sr-only">
              Search jobs
            </label>
            <TextInput
              id="job-search"
              type="search"
              placeholder="Search by title, code or customer…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-8"
            />
          </div>

          <InlineField label="Status" htmlFor="job-status">
            <Select
              id="job-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-8 w-auto"
            >
              <option value="all">All</option>
              {JOB_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </InlineField>

          <InlineField label="Crew" htmlFor="job-crew">
            <Select
              id="job-crew"
              value={crewId}
              onChange={(event) => setCrewId(event.target.value)}
              className="h-8 w-auto"
            >
              <option value="all">All</option>
              <option value="unassigned">Unassigned</option>
              {state.crews.map((crew) => (
                <option key={crew.id} value={crew.id}>
                  {crew.name}
                </option>
              ))}
            </Select>
          </InlineField>

          <span className="ml-auto text-[0.75rem] text-muted tabular-nums">
            {filtered.length} of {state.jobs.length}
          </span>
        </Toolbar>

        <DataTable
          caption="Jobs"
          columns={columns}
          rows={filtered}
          rowKey={(job) => job.id}
          rowHref={(job) => paths.job(job.id)}
          defaultSort={{ key: 'scheduled', direction: 'asc' }}
          empty={
            <EmptyState
              title="No jobs match these filters."
              action={
                <Button
                  onClick={() => {
                    setQuery('');
                    setStatus('all');
                    setCrewId('all');
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          }
        />
      </Panel>

      <JobForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

// -------------------------------------------------------------- detail

export function JobDetail({ jobId }: { jobId: string }) {
  const { state, dispatch, notify } = useContractor();
  const [tab, setTab] = useState('overview');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [crewOpen, setCrewOpen] = useState(false);
  const [fieldOpen, setFieldOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const job = state.jobs.find((candidate) => candidate.id === jobId);

  const records = useMemo(() => (job ? jobFieldRecords(state, job.id) : []), [state, job]);
  const invoices = useMemo(() => (job ? invoicesForJob(state, job.id) : []), [state, job]);
  const events = useMemo(() => (job ? activityFor(state, 'job', job.id) : []), [state, job]);

  if (!job) {
    return (
      <EmptyState
        title="Job not found"
        action={<LinkButton href={paths.module('jobs')}>Back to jobs</LinkButton>}
      />
    );
  }

  const customer = getCustomer(state, job.customerId);
  const location = getLocation(state, job.locationId);
  const crew = getCrew(state, job.crewId);
  const members = crew ? crewMembers(state, crew.id) : [];
  const estimate = getEstimate(state, job.estimateId);
  const canInvoice = canInvoiceJob(job) && invoices.length === 0;

  const createInvoice = () => {
    dispatch({ type: 'invoice/createFromJob', jobId: job.id });
    track('invoice_created', { fromJob: true });
    notify('Invoice drafted from the completed job.', 'success');
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'field', label: 'Field records', count: records.length },
    { id: 'financial', label: 'Financial' },
    { id: 'activity', label: 'Activity' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <a href={paths.module('jobs')} className="hover:text-copper transition-colors">
            Jobs
          </a>
        }
        title={job.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <JobStatusBadge status={job.status} />
            <PriorityBadge priority={job.priority} />
            <span className="text-muted">
              {job.code} · {customer?.name} · {jobProgressLabel(job)}
            </span>
          </span>
        }
        actions={
          <>
            {job.status !== 'Completed' && job.status !== 'Cancelled' && (
              <>
                <Button onClick={() => setScheduleOpen(true)}>
                  <CalendarDays size={14} aria-hidden="true" />
                  {job.scheduledStart ? 'Reschedule' : 'Schedule'}
                </Button>
                <Button onClick={() => setCrewOpen(true)}>
                  <UserPlus size={14} aria-hidden="true" />
                  {crew ? 'Change crew' : 'Assign crew'}
                </Button>
              </>
            )}

            {job.status === 'Scheduled' && (
              <Button
                onClick={() => {
                  dispatch({ type: 'job/status', id: job.id, status: 'In Progress' });
                  notify(`${job.code} started.`, 'success');
                }}
              >
                Start job
              </Button>
            )}

            {(job.status === 'Scheduled' || job.status === 'In Progress') && (
              <Button onClick={() => setFieldOpen(true)}>Add field record</Button>
            )}

            {job.status === 'In Progress' && (
              <Button variant="primary" onClick={() => setCompleteOpen(true)}>
                Complete job
              </Button>
            )}

            {canInvoice && (
              <Button variant="primary" onClick={createInvoice}>
                <Receipt size={14} aria-hidden="true" />
                Create invoice
              </Button>
            )}

            {invoices.length > 0 && (
              <LinkButton variant="primary" href={paths.invoice(invoices[0].id)}>
                View invoice {invoices[0].code}
              </LinkButton>
            )}
          </>
        }
      />

      {job.status === 'On Hold' && (
        <div className="flex items-center justify-between gap-3 border border-warning/40 bg-warning/[0.06] rounded-[3px] px-3.5 py-2.5">
          <p className="text-[0.8125rem] text-warning">
            This job is on hold. Resume it when the blocker clears.
          </p>
          <Button
            size="sm"
            onClick={() => {
              dispatch({
                type: 'job/status',
                id: job.id,
                status: job.scheduledStart ? 'Scheduled' : 'Unscheduled',
              });
              notify(`${job.code} resumed.`, 'success');
            }}
          >
            Resume job
          </Button>
        </div>
      )}

      {/* Mobile-first field summary: address, contact and scope above the fold,
          with tap targets for the two things a crew needs on site. */}
      <Panel className="lg:hidden">
        <div className="px-3.5 py-3 space-y-2.5">
          {location && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(formatAddress(location.address))}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-2.5 text-[0.875rem] text-charcoal"
            >
              <MapPin size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-copper" />
              <span>
                <span className="block font-medium">{location.label}</span>
                <span className="block text-muted">{formatAddress(location.address)}</span>
              </span>
            </a>
          )}
          {customer && (
            <a
              href={`tel:${customer.phone}`}
              className="flex items-center gap-2.5 text-[0.875rem] text-charcoal"
            >
              <Phone size={15} aria-hidden="true" className="shrink-0 text-copper" />
              <span>
                {customer.name} · <span className="text-muted">{formatPhone(customer.phone)}</span>
              </span>
            </a>
          )}
          {job.scheduledStart && (
            <p className="flex items-center gap-2.5 text-[0.875rem] text-charcoal">
              <CalendarDays size={15} aria-hidden="true" className="shrink-0 text-copper" />
              {formatScheduleWindow(job.scheduledStart, job.scheduledEnd)}
            </p>
          )}
        </div>
      </Panel>

      <Panel>
        <div className="border-b border-app-border px-2">
          <Tabs tabs={tabs} active={tab} onChange={setTab} label="Job sections" />
        </div>

        <div id={`tabpanel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {tab === 'overview' && (
            <div className="divide-y divide-app-border">
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
                <Detail label="Scheduled">
                  {job.scheduledStart ? (
                    formatScheduleWindow(job.scheduledStart, job.scheduledEnd)
                  ) : (
                    <Badge tone="warning">Not scheduled</Badge>
                  )}
                </Detail>
                <Detail label="Crew">
                  {crew ? (
                    <a href={paths.crew(crew.id)} className="hover:text-copper transition-colors">
                      {crew.name}
                    </a>
                  ) : (
                    <Badge tone="warning">Unassigned</Badge>
                  )}
                </Detail>
                <Detail label="Source estimate">
                  {estimate ? (
                    <a
                      href={paths.estimate(estimate.id)}
                      className="hover:text-copper transition-colors"
                    >
                      {estimate.code}
                    </a>
                  ) : (
                    'Created directly'
                  )}
                </Detail>
                <Detail label="Priority">{job.priority}</Detail>
                <Detail label="Created">{formatDate(job.createdAt)}</Detail>
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

              {job.scope && (
                <div className="px-3.5 py-3.5">
                  <FieldLabel>Scope of work</FieldLabel>
                  <p className="mt-1.5 text-[0.875rem] text-charcoal leading-relaxed whitespace-pre-line">
                    {job.scope}
                  </p>
                </div>
              )}

              {job.notes && (
                <div className="px-3.5 py-3.5">
                  <FieldLabel>Job notes</FieldLabel>
                  <p className="mt-1.5 text-[0.875rem] text-charcoal leading-relaxed">{job.notes}</p>
                </div>
              )}

              {members.length > 0 && (
                <div className="px-3.5 py-3.5">
                  <FieldLabel className="mb-2">Crew members</FieldLabel>
                  <ul className="flex flex-wrap gap-x-4 gap-y-1">
                    {members.map((member) => (
                      <li key={member.id} className="text-[0.875rem] text-charcoal">
                        {member.name}
                        <span className="text-muted"> · {member.role}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {job.completedAt && (
                <div className="px-3.5 py-3.5">
                  <FieldLabel>Completion</FieldLabel>
                  <p className="mt-1.5 text-[0.875rem] text-charcoal">
                    Completed {formatDateTime(job.completedAt)}
                  </p>
                  {job.completionNotes && (
                    <p className="mt-1 text-[0.875rem] text-muted leading-relaxed">
                      {job.completionNotes}
                    </p>
                  )}
                </div>
              )}

              {job.status !== 'Completed' && job.status !== 'Cancelled' && (
                <div className="flex flex-wrap gap-2 px-3.5 py-3.5">
                  {job.status !== 'On Hold' && (
                    <Button
                      size="sm"
                      onClick={() => {
                        dispatch({ type: 'job/status', id: job.id, status: 'On Hold' });
                        notify(`${job.code} placed on hold.`);
                      }}
                    >
                      Put on hold
                    </Button>
                  )}
                  <Button size="sm" variant="danger" onClick={() => setCancelOpen(true)}>
                    Cancel job
                  </Button>
                </div>
              )}
            </div>
          )}

          {tab === 'field' && (
            <div>
              <div className="flex items-center justify-between gap-3 border-b border-app-border px-3.5 py-2.5">
                <p className="text-[0.8125rem] text-muted">
                  {records.length === 0
                    ? 'No work has been logged from the field yet.'
                    : `${records.length} records logged.`}
                </p>
                {job.status !== 'Completed' && job.status !== 'Cancelled' && (
                  <Button size="sm" onClick={() => setFieldOpen(true)}>
                    Add record
                  </Button>
                )}
              </div>

              {records.length === 0 ? (
                <EmptyState
                  title="No field records"
                  description="Crews log what was done, hours worked and materials used. Adding the first record starts a scheduled job."
                />
              ) : (
                <ul className="divide-y divide-app-border">
                  {records.map((record) => {
                    const member = state.crewMembers.find(
                      (candidate) => candidate.id === record.memberId,
                    );
                    const done = record.checklist.filter((item) => item.done).length;
                    return (
                      <li key={record.id} className="px-3.5 py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <span className="text-[0.875rem] font-medium text-charcoal">
                            {record.statusUpdate || record.workPerformed.slice(0, 60)}
                          </span>
                          <span className="text-[0.75rem] tabular-nums text-muted">
                            {formatDateTime(record.occurredAt)} · {record.hours}h
                          </span>
                        </div>

                        <p className="mt-1 text-[0.875rem] text-muted leading-relaxed">
                          {record.workPerformed}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.75rem] text-muted">
                          <span>{record.code}</span>
                          {member && <span>{member.name}</span>}
                          {record.materialsUsed && <span>Materials: {record.materialsUsed}</span>}
                        </div>

                        {record.checklist.length > 0 && (
                          <div className="mt-2.5">
                            <p className="text-[0.75rem] text-muted mb-1.5">
                              Checklist · {done} of {record.checklist.length} complete
                            </p>
                            <ul className="space-y-1">
                              {record.checklist.map((item, index) => (
                                <li key={item.label}>
                                  <label className="flex items-center gap-2 text-[0.8125rem] cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={item.done}
                                      onChange={() =>
                                        dispatch({
                                          type: 'field/toggleChecklist',
                                          recordId: record.id,
                                          index,
                                        })
                                      }
                                      className="w-3.5 h-3.5 accent-[#B96E3B]"
                                    />
                                    <span className={item.done ? 'text-muted line-through' : 'text-charcoal'}>
                                      {item.label}
                                    </span>
                                  </label>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {record.notes && (
                          <p className="mt-2 text-[0.8125rem] text-muted italic">{record.notes}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {tab === 'financial' && (
            <div className="divide-y divide-app-border">
              <div className="px-3.5 py-3.5">
                <FieldLabel className="mb-2">Estimate</FieldLabel>
                {estimate ? (
                  <a
                    href={paths.estimate(estimate.id)}
                    className="flex items-center justify-between gap-3 border border-app-border rounded-[3px] px-3 py-2.5 transition-colors hover:bg-app-hover"
                  >
                    <span className="min-w-0">
                      <span className="block text-[0.875rem] text-charcoal">{estimate.code}</span>
                      <CellMeta>{estimate.title}</CellMeta>
                    </span>
                    <span className="flex items-center gap-3 shrink-0">
                      <span className="tabular-nums text-[0.8125rem] text-charcoal">
                        {formatMoney(estimateTotal(estimate))}
                      </span>
                      <EstimateStatusBadge status={estimate.status} />
                    </span>
                  </a>
                ) : (
                  <p className="text-[0.875rem] text-muted">
                    This job was created directly, without an estimate.
                  </p>
                )}
              </div>

              <div className="px-3.5 py-3.5">
                <FieldLabel className="mb-2">Invoices</FieldLabel>
                {invoices.length === 0 ? (
                  <p className="text-[0.875rem] text-muted">
                    {job.status === 'Completed'
                      ? 'No invoice has been raised for this job yet.'
                      : 'An invoice can be created once the job is complete.'}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {invoices.map((invoice) => (
                      <li key={invoice.id}>
                        <a
                          href={paths.invoice(invoice.id)}
                          className="flex items-center justify-between gap-3 border border-app-border rounded-[3px] px-3 py-2.5 transition-colors hover:bg-app-hover"
                        >
                          <span className="min-w-0">
                            <span className="block text-[0.875rem] text-charcoal">
                              {invoice.code}
                            </span>
                            <CellMeta>
                              Issued {formatDate(invoice.issuedAt)} · due{' '}
                              {formatDate(invoice.dueAt)}
                            </CellMeta>
                          </span>
                          <span className="flex items-center gap-3 shrink-0">
                            <span className="text-right">
                              <span className="block tabular-nums text-[0.8125rem] text-charcoal">
                                {formatMoney(invoiceTotal(invoice))}
                              </span>
                              {invoiceBalance(state, invoice) > 0 && (
                                <span className="block text-[0.75rem] tabular-nums text-muted">
                                  {formatMoney(invoiceBalance(state, invoice))} due
                                </span>
                              )}
                            </span>
                            <InvoiceStatusBadge status={invoiceStatus(state, invoice)} />
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-[0.75rem] text-muted">
                  Financial records here link the estimate, the invoice and its payments. This is
                  not an accounting system.
                </p>
              </div>
            </div>
          )}

          {tab === 'activity' && (
            <div className="px-3.5 py-2">
              <Timeline events={events} />
            </div>
          )}
        </div>
      </Panel>

      <ScheduleDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} job={job} />
      <AssignCrewDialog open={crewOpen} onClose={() => setCrewOpen(false)} job={job} />
      <FieldRecordForm open={fieldOpen} onClose={() => setFieldOpen(false)} job={job} />
      <CompleteJobDialog
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        job={job}
        onCompleted={() => setTab('financial')}
      />

      <ConfirmDialog
        open={cancelOpen}
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => {
          dispatch({ type: 'job/status', id: job.id, status: 'Cancelled' });
          setCancelOpen(false);
          notify(`${job.code} cancelled.`);
        }}
        title="Cancel this job?"
        confirmLabel="Cancel job"
        tone="danger"
        description={`${job.code} will be removed from the schedule and marked cancelled. Its records stay in the workspace.`}
      />
    </div>
  );
}
