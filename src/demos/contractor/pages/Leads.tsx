import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useContractor } from '../ContractorProvider';
import { useRouter } from '../../../lib/router';
import {
  LEAD_SOURCES,
  LEAD_STAGES,
  SERVICE_TYPES,
  type Lead,
  type LeadStage,
} from '../contractor.types';
import {
  activityFor,
  estimateForLead,
  followUpsFor,
  getUser,
  leadNeedsAttention,
} from '../contractor.selectors';
import { paths } from '../contractor.routes';
import {
  formatAddress,
  formatAddressShort,
  formatDateNumeric,
  formatMoney,
  formatPhone,
  formatRelativeDay,
  matches,
} from '../contractor.utils';
import {
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
import { EstimateStatusBadge, LeadStageBadge } from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import { LeadForm } from '../forms/LeadForm';
import { FollowUpForm } from '../forms/FinanceForms';

/** Filters that actually narrow the list. `all` is the unset value. */
interface Filters {
  query: string;
  stage: string;
  source: string;
  serviceType: string;
}

const EMPTY_FILTERS: Filters = { query: '', stage: 'all', source: 'all', serviceType: 'all' };

export function LeadsPage() {
  const { state } = useContractor();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [formOpen, setFormOpen] = useState(false);

  const filtered = useMemo(
    () =>
      state.leads.filter((lead) => {
        if (filters.stage !== 'all' && lead.stage !== filters.stage) return false;
        if (filters.source !== 'all' && lead.source !== filters.source) return false;
        if (filters.serviceType !== 'all' && lead.serviceType !== filters.serviceType) return false;
        return matches(
          filters.query,
          lead.code,
          lead.name,
          lead.contactName,
          lead.email,
          lead.phone,
          lead.serviceAddress.city,
        );
      }),
    [state.leads, filters],
  );

  const hasFilters =
    filters.query !== '' ||
    filters.stage !== 'all' ||
    filters.source !== 'all' ||
    filters.serviceType !== 'all';

  const columns: Column<Lead>[] = [
    {
      key: 'name',
      header: 'Lead',
      sortValue: (lead) => lead.name,
      cell: (lead) => (
        <>
          <span className="block truncate max-w-[18rem]">{lead.name}</span>
          <CellMeta>
            {lead.code} · {lead.contactName}
          </CellMeta>
        </>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      width: 'w-36',
      sortValue: (lead) => LEAD_STAGES.indexOf(lead.stage),
      cell: (lead) => <LeadStageBadge stage={lead.stage} />,
    },
    {
      key: 'serviceType',
      header: 'Service',
      width: 'w-32',
      hideBelow: 'lg',
      sortValue: (lead) => lead.serviceType,
      cell: (lead) => <span className="text-[0.8125rem] text-muted">{lead.serviceType}</span>,
    },
    {
      key: 'location',
      header: 'Location',
      hideBelow: 'md',
      sortValue: (lead) => lead.serviceAddress.city,
      cell: (lead) => (
        <span className="text-[0.8125rem] text-muted truncate block max-w-[14rem]">
          {formatAddressShort(lead.serviceAddress)}
        </span>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      width: 'w-32',
      hideBelow: 'lg',
      sortValue: (lead) => lead.source,
      cell: (lead) => <span className="text-[0.8125rem] text-muted">{lead.source}</span>,
    },
    {
      key: 'value',
      header: 'Value',
      width: 'w-28',
      align: 'right',
      sortValue: (lead) => lead.estimatedValue,
      cell: (lead) => (
        <span className="tabular-nums text-[0.8125rem]">{formatMoney(lead.estimatedValue)}</span>
      ),
    },
    {
      key: 'followUp',
      header: 'Follow-up',
      width: 'w-32',
      sortValue: (lead) => lead.nextFollowUpAt ?? '9999',
      cell: (lead) =>
        lead.nextFollowUpAt ? (
          <span
            className={`text-[0.8125rem] ${
              leadNeedsAttention(lead) ? 'text-danger font-medium' : 'text-muted'
            }`}
          >
            {formatRelativeDay(lead.nextFollowUpAt)}
          </span>
        ) : (
          <span className="text-[0.8125rem] text-muted">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leads"
        description="Incoming opportunities and where each one stands."
        actions={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <Plus size={14} aria-hidden="true" />
            New lead
          </Button>
        }
      />

      <Panel>
        <Toolbar>
          <div className="flex-1 min-w-[12rem]">
            <label htmlFor="lead-search" className="sr-only">
              Search leads
            </label>
            <TextInput
              id="lead-search"
              type="search"
              placeholder="Search by name, contact or code…"
              value={filters.query}
              onChange={(event) => setFilters({ ...filters, query: event.target.value })}
              className="h-8"
            />
          </div>

          <InlineField label="Stage" htmlFor="lead-stage">
            <Select
              id="lead-stage"
              value={filters.stage}
              onChange={(event) => setFilters({ ...filters, stage: event.target.value })}
              className="h-8 w-auto"
            >
              <option value="all">All</option>
              {LEAD_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </Select>
          </InlineField>

          <InlineField label="Source" htmlFor="lead-source">
            <Select
              id="lead-source"
              value={filters.source}
              onChange={(event) => setFilters({ ...filters, source: event.target.value })}
              className="h-8 w-auto"
            >
              <option value="all">All</option>
              {LEAD_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </Select>
          </InlineField>

          <InlineField label="Service" htmlFor="lead-service">
            <Select
              id="lead-service"
              value={filters.serviceType}
              onChange={(event) => setFilters({ ...filters, serviceType: event.target.value })}
              className="h-8 w-auto"
            >
              <option value="all">All</option>
              {SERVICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </InlineField>

          <span className="ml-auto text-[0.75rem] text-muted tabular-nums">
            {filtered.length} of {state.leads.length}
          </span>
        </Toolbar>

        <DataTable
          caption="Leads"
          columns={columns}
          rows={filtered}
          rowKey={(lead) => lead.id}
          rowHref={(lead) => paths.lead(lead.id)}
          defaultSort={{ key: 'followUp', direction: 'asc' }}
          empty={
            <EmptyState
              title="No leads match these filters."
              description={
                hasFilters
                  ? 'Try widening the search or clearing the filters.'
                  : 'Create a lead to start tracking an opportunity.'
              }
              action={
                hasFilters ? (
                  <Button onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</Button>
                ) : (
                  <Button variant="primary" onClick={() => setFormOpen(true)}>
                    New lead
                  </Button>
                )
              }
            />
          }
        />
      </Panel>

      <LeadForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

// -------------------------------------------------------------- detail

export function LeadDetail({ leadId }: { leadId: string }) {
  const { state, dispatch, notify } = useContractor();
  const { navigate } = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);

  const lead = state.leads.find((candidate) => candidate.id === leadId);

  const estimate = useMemo(
    () => (lead ? estimateForLead(state, lead.id) : undefined),
    [state, lead],
  );
  const events = useMemo(() => (lead ? activityFor(state, 'lead', lead.id) : []), [state, lead]);
  const tasks = useMemo(() => (lead ? followUpsFor(state, 'lead', lead.id) : []), [state, lead]);

  if (!lead) {
    return (
      <EmptyState
        title="Lead not found"
        description="This lead may have been removed, or the link is out of date."
        action={<LinkButton href={paths.module('leads')}>Back to leads</LinkButton>}
      />
    );
  }

  const owner = getUser(state, lead.assignedUserId);

  const createEstimate = () => {
    // The editor reads the lead from the query string and pre-fills from it,
    // which is what carries the contact, location and scope across.
    navigate(`${paths.estimateNew()}?lead=${lead.id}`);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <a href={paths.module('leads')} className="hover:text-copper transition-colors">
            Leads
          </a>
        }
        title={lead.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <LeadStageBadge stage={lead.stage} />
            <span className="text-muted">
              {lead.code} · {lead.serviceType} · created {formatRelativeDay(lead.createdAt)}
            </span>
          </span>
        }
        actions={
          <>
            <Button onClick={() => setFollowUpOpen(true)}>Schedule follow-up</Button>
            <Button onClick={() => setEditOpen(true)}>Edit</Button>
            {estimate ? (
              <LinkButton variant="primary" href={paths.estimate(estimate.id)}>
                View estimate
              </LinkButton>
            ) : (
              <Button variant="primary" onClick={createEstimate}>
                Create estimate
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Panel>
            <PanelHeader title="Opportunity" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 px-3.5 py-3.5">
              <Detail label="Contact">{lead.contactName}</Detail>
              <Detail label="Phone">
                <a href={`tel:${lead.phone}`} className="hover:text-copper transition-colors">
                  {formatPhone(lead.phone)}
                </a>
              </Detail>
              <Detail label="Email">
                {lead.email ? (
                  <a
                    href={`mailto:${lead.email}`}
                    className="hover:text-copper transition-colors break-all"
                  >
                    {lead.email}
                  </a>
                ) : (
                  '—'
                )}
              </Detail>
              <Detail label="Source">{lead.source}</Detail>
              <Detail label="Estimated value">
                <span className="tabular-nums">{formatMoney(lead.estimatedValue)}</span>
              </Detail>
              <Detail label="Assigned to">{owner?.name ?? 'Unassigned'}</Detail>
              <Detail label="Service address" className="col-span-2 sm:col-span-3">
                {formatAddress(lead.serviceAddress)}
              </Detail>
            </div>

            {lead.description && (
              <div className="border-t border-app-border px-3.5 py-3.5">
                <FieldLabel>Requested work</FieldLabel>
                <p className="mt-1.5 text-[0.875rem] text-charcoal leading-relaxed whitespace-pre-line">
                  {lead.description}
                </p>
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Stage" meta="Move the lead as the conversation progresses" />
            <div className="flex flex-wrap gap-1.5 px-3.5 py-3.5">
              {LEAD_STAGES.map((stage) => (
                <button
                  key={stage}
                  type="button"
                  aria-pressed={lead.stage === stage}
                  onClick={() => {
                    if (lead.stage === stage) return;
                    dispatch({ type: 'lead/stage', id: lead.id, stage: stage as LeadStage });
                    notify(`${lead.code} moved to ${stage}.`, 'success');
                  }}
                  className={`border rounded-[2px] px-2.5 py-1 text-[0.8125rem] transition-colors ${
                    lead.stage === stage
                      ? 'border-copper bg-copper/10 text-copper font-medium'
                      : 'border-app-border-strong text-muted hover:bg-app-hover hover:text-charcoal'
                  }`}
                >
                  {stage}
                </button>
              ))}
            </div>
          </Panel>

          {estimate && (
            <Panel>
              <PanelHeader title="Linked estimate" />
              <a
                href={paths.estimate(estimate.id)}
                className="flex items-center justify-between gap-3 px-3.5 py-3 transition-colors hover:bg-app-hover"
              >
                <span className="min-w-0">
                  <span className="block text-[0.875rem] text-charcoal truncate">
                    {estimate.title}
                  </span>
                  <CellMeta>{estimate.code}</CellMeta>
                </span>
                <EstimateStatusBadge status={estimate.status} />
              </a>
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Follow-ups" />
            {tasks.length === 0 ? (
              <EmptyState
                title="No follow-ups"
                description="Schedule a call or a site visit to keep this lead moving."
                action={<Button size="sm" onClick={() => setFollowUpOpen(true)}>Schedule</Button>}
              />
            ) : (
              <ul className="divide-y divide-app-border">
                {tasks.map((task) => (
                  <li key={task.id} className="flex items-start gap-2.5 px-3.5 py-2.5">
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => dispatch({ type: 'followUp/toggle', id: task.id })}
                      aria-label={`Mark "${task.title}" ${task.done ? 'not done' : 'done'}`}
                      className="mt-1 w-4 h-4 shrink-0 accent-[#B96E3B]"
                    />
                    <span className="min-w-0">
                      <span
                        className={`block text-[0.8125rem] leading-snug ${
                          task.done ? 'text-muted line-through' : 'text-charcoal'
                        }`}
                      >
                        {task.title}
                      </span>
                      <span className="block text-[0.75rem] text-muted">
                        {formatRelativeDay(task.dueAt)} · {formatDateNumeric(task.dueAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Activity" />
            <div className="px-3.5 py-2">
              <Timeline events={events} />
            </div>
          </Panel>
        </div>
      </div>

      <LeadForm open={editOpen} onClose={() => setEditOpen(false)} lead={lead} />
      <FollowUpForm
        open={followUpOpen}
        onClose={() => setFollowUpOpen(false)}
        relatesTo={{ kind: 'lead', id: lead.id }}
        defaultTitle={`Follow up with ${lead.contactName}`}
      />
    </div>
  );
}
