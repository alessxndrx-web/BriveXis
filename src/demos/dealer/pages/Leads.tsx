import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useDealer, useWorkspace } from '../DealerProvider';
import { useRouter } from '../../../lib/router';
import { paths } from '../dealer.routes';
import type { DealerLead, LeadStage } from '../dealer.types';
import { LEAD_SOURCES, LEAD_STAGES } from '../dealer.types';
import {
  activityFor,
  getCustomer,
  getVehicle,
  salespersonName,
  tasksFor,
} from '../dealer.selectors';
import {
  formatDate,
  formatDateTime,
  formatMoneyWhole,
  formatPhone,
  formatRelativeDay,
  matches,
  vehicleTitle,
} from '../dealer.utils';
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
import { LeadStageBadge } from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import { LeadForm } from '../forms/LeadForm';
import { CustomerForm } from '../forms/CustomerForm';
import { ReservationForm } from '../forms/ReservationForms';
import { TaskForm } from '../forms/WorkspaceForms';

/**
 * Leads — the front of the funnel.
 *
 * A lead becomes a customer record only when there is a reason for one, which
 * is why conversion is an explicit action rather than something that happens
 * silently on a stage change.
 */

const ALL = 'all';

export function LeadsPage() {
  const state = useWorkspace();
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState<string>(ALL);
  const [source, setSource] = useState<string>(ALL);
  const [owner, setOwner] = useState<string>(ALL);
  const [formOpen, setFormOpen] = useState(false);

  const rows = useMemo(
    () =>
      state.leads.filter((lead) => {
        if (stage !== ALL && lead.stage !== stage) return false;
        if (source !== ALL && lead.source !== source) return false;
        if (owner !== ALL && lead.salespersonId !== owner) return false;
        const vehicle = getVehicle(state, lead.vehicleId);
        return matches(
          query,
          lead.name,
          lead.code,
          lead.email,
          lead.phone,
          vehicle ? vehicleTitle(vehicle) : undefined,
        );
      }),
    [state, query, stage, source, owner],
  );

  const filtered = stage !== ALL || source !== ALL || owner !== ALL || query;
  const clear = () => {
    setQuery('');
    setStage(ALL);
    setSource(ALL);
    setOwner(ALL);
  };

  const columns: Column<DealerLead>[] = [
    {
      key: 'lead',
      header: 'Lead',
      sortValue: (lead) => lead.name,
      cell: (lead) => (
        <>
          <span className="font-medium text-charcoal">{lead.name}</span>
          <CellMeta>
            <CodeCell>{lead.code}</CodeCell> · {formatPhone(lead.phone)}
          </CellMeta>
        </>
      ),
    },
    {
      key: 'vehicle',
      header: 'Vehicle of interest',
      hideBelow: 'md',
      sortValue: (lead) => {
        const vehicle = getVehicle(state, lead.vehicleId);
        return vehicle ? vehicleTitle(vehicle) : 'zz';
      },
      cell: (lead) => {
        const vehicle = getVehicle(state, lead.vehicleId);
        return vehicle ? (
          <>
            <span className="text-charcoal">{vehicleTitle(vehicle)}</span>
            <CellMeta>{vehicle.code}</CellMeta>
          </>
        ) : (
          <span className="text-muted">Not decided</span>
        );
      },
    },
    {
      key: 'source',
      header: 'Source',
      width: 'w-36',
      hideBelow: 'lg',
      sortValue: (lead) => lead.source,
      cell: (lead) => <span className="text-muted">{lead.source}</span>,
    },
    {
      key: 'budget',
      header: 'Budget',
      width: 'w-32',
      align: 'right',
      hideBelow: 'lg',
      sortValue: (lead) => lead.budgetMax ?? 0,
      cell: (lead) =>
        lead.budgetMax ? (
          <span className="tabular-nums text-muted">{formatMoneyWhole(lead.budgetMax)}</span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'followUp',
      header: 'Follow-up',
      width: 'w-32',
      hideBelow: 'sm',
      sortValue: (lead) => lead.nextFollowUpAt ?? '9999',
      cell: (lead) =>
        lead.nextFollowUpAt ? (
          <span className="text-muted">{formatRelativeDay(lead.nextFollowUpAt)}</span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'stage',
      header: 'Stage',
      width: 'w-40',
      sortValue: (lead) => lead.stage,
      cell: (lead) => <LeadStageBadge stage={lead.stage} />,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leads"
        description={`${state.leads.length} opportunities in the pipeline.`}
        actions={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <Plus size={14} aria-hidden="true" />
            New lead
          </Button>
        }
      />

      <Panel>
        <Toolbar>
          <div className="w-full sm:w-64">
            <label htmlFor="lead-search" className="sr-only">
              Search leads
            </label>
            <TextInput
              id="lead-search"
              type="search"
              placeholder="Name, phone, vehicle…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <InlineField label="Stage" htmlFor="lead-stage">
            <Select
              id="lead-stage"
              value={stage}
              onChange={(event) => setStage(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All</option>
              {LEAD_STAGES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </InlineField>

          <InlineField label="Source" htmlFor="lead-source">
            <Select
              id="lead-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All</option>
              {LEAD_SOURCES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </InlineField>

          <InlineField label="Salesperson" htmlFor="lead-owner">
            <Select
              id="lead-owner"
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All</option>
              {state.salespeople.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
          </InlineField>

          {filtered && (
            <Button size="sm" onClick={clear}>
              Clear filters
            </Button>
          )}

          <span className="ml-auto text-[0.75rem] text-muted tabular-nums">
            {rows.length} of {state.leads.length}
          </span>
        </Toolbar>

        <DataTable
          caption="Leads"
          columns={columns}
          rows={rows}
          rowKey={(lead) => lead.id}
          rowHref={(lead) => paths.lead(lead.id)}
          defaultSort={{ key: 'followUp', direction: 'asc' }}
          empty={
            <EmptyState
              title="No leads match these filters."
              description="Try a different stage or clear the filters."
              action={<Button onClick={clear}>Clear filters</Button>}
            />
          }
        />
      </Panel>

      <LeadForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

// --------------------------------------------------------------- lead detail

export function LeadDetail({ leadId }: { leadId: string }) {
  const state = useWorkspace();
  const { dispatch, notify } = useDealer();
  const { navigate } = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

  const lead = state.leads.find((entry) => entry.id === leadId);

  if (!lead) {
    return (
      <EmptyState
        title="That lead is not in this workspace"
        description="It may have been removed, or the link is out of date."
        action={<LinkButton href={paths.module('leads')}>Back to leads</LinkButton>}
      />
    );
  }

  const vehicle = getVehicle(state, lead.vehicleId);
  const customer = getCustomer(state, lead.customerId);
  const alsoInterested = lead.alsoInterestedIn
    .map((id) => getVehicle(state, id))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const events = activityFor(state, { kind: 'lead', id: lead.id });
  const tasks = tasksFor(state, { leadId: lead.id });

  const setStage = (stage: LeadStage) => {
    dispatch({ type: 'lead/stage', id: lead.id, stage });
    notify(`${lead.code} moved to ${stage}.`, 'success');
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
              {lead.code} · {lead.source} · {salespersonName(state, lead.salespersonId)}
            </span>
          </span>
        }
        actions={
          <>
            <Button onClick={() => setTaskOpen(true)}>Add task</Button>
            <Button onClick={() => setEditOpen(true)}>Edit</Button>
            {customer ? (
              <LinkButton href={paths.customer(customer.id)}>View {customer.code}</LinkButton>
            ) : (
              <Button onClick={() => setCustomerOpen(true)}>Convert to customer</Button>
            )}
            {customer && vehicle && (
              <Button variant="primary" onClick={() => setReserveOpen(true)}>
                Reserve vehicle
              </Button>
            )}
          </>
        }
      />

      {!customer && (
        <p className="border border-app-border bg-app-panel rounded-[3px] px-3.5 py-2.5 text-[0.8125rem] text-muted">
          This lead has no customer record yet. Converting it creates one, which is what a
          reservation and a deal attach to.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          <Panel>
            <PanelHeader title="Details" as="h2" />
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Detail label="Phone">
                <a href={`tel:${lead.phone}`} className="hover:text-copper transition-colors">
                  {formatPhone(lead.phone)}
                </a>
              </Detail>
              <Detail label="Email">
                {lead.email ? (
                  <a href={`mailto:${lead.email}`} className="hover:text-copper transition-colors break-all">
                    {lead.email}
                  </a>
                ) : (
                  '—'
                )}
              </Detail>
              <Detail label="Preferred contact">{lead.contactPreference}</Detail>
              <Detail label="Budget">
                {lead.budgetMin || lead.budgetMax
                  ? `${formatMoneyWhole(lead.budgetMin ?? 0)} – ${formatMoneyWhole(lead.budgetMax ?? 0)}`
                  : '—'}
              </Detail>
              <Detail label="Trade-in">{lead.hasTradeIn ? 'Yes' : 'No'}</Detail>
              <Detail label="Created">{formatDate(lead.createdAt)}</Detail>
              <Detail label="Next follow-up">
                {lead.nextFollowUpAt ? formatRelativeDay(lead.nextFollowUpAt) : '—'}
              </Detail>
              {lead.appointmentAt && (
                <Detail label="Appointment">
                  {formatDateTime(lead.appointmentAt)}
                  {lead.appointmentKind && (
                    <span className="block text-[0.75rem] text-muted">{lead.appointmentKind}</span>
                  )}
                </Detail>
              )}
              {lead.notes && (
                <div className="col-span-2 sm:col-span-3">
                  <Detail label="Notes">{lead.notes}</Detail>
                </div>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Vehicle interest" as="h2" />
            <div className="p-4 space-y-2.5">
              {vehicle ? (
                <a
                  href={paths.vehicle(vehicle.id)}
                  className="block border border-app-border rounded-[2px] px-3 py-2.5 transition-colors hover:bg-app-bg"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[0.9375rem] text-charcoal">{vehicleTitle(vehicle)}</span>
                    <span className="tabular-nums text-[0.875rem] text-charcoal">
                      {formatMoneyWhole(vehicle.listPrice)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[0.75rem] text-muted">
                    {vehicle.code} · {vehicle.status} · primary interest
                  </p>
                </a>
              ) : (
                <p className="text-[0.8125rem] text-muted">
                  No vehicle chosen yet. Pick one from inventory to move this lead forward.
                </p>
              )}

              {alsoInterested.map((entry) => (
                <a
                  key={entry.id}
                  href={paths.vehicle(entry.id)}
                  className="block border border-app-border rounded-[2px] px-3 py-2 transition-colors hover:bg-app-bg"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[0.875rem] text-charcoal">{vehicleTitle(entry)}</span>
                    <span className="text-[0.75rem] text-muted">also interested</span>
                  </div>
                </a>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Activity" as="h2" />
            <div className="p-4">
              <Timeline events={events} emptyMessage="Nothing recorded on this lead yet." />
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Stage" as="h3" />
            <div className="p-3 flex flex-wrap gap-1.5">
              {LEAD_STAGES.map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant={option === lead.stage ? 'primary' : 'secondary'}
                  onClick={() => setStage(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Tasks" as="h3" meta={tasks.length > 0 ? `${tasks.length}` : undefined} />
            {tasks.length === 0 ? (
              <EmptyState title="No tasks" description="Add a follow-up to keep this moving." />
            ) : (
              <ul>
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-start gap-2.5 border-b border-app-border last:border-b-0 px-4 py-2.5"
                  >
                    <input
                      type="checkbox"
                      id={`lead-task-${task.id}`}
                      checked={task.done}
                      onChange={() => dispatch({ type: 'task/toggle', id: task.id })}
                      className="mt-0.5 h-3.5 w-3.5 accent-[var(--color-copper)]"
                    />
                    <label htmlFor={`lead-task-${task.id}`} className="min-w-0 flex-1 cursor-pointer">
                      <span
                        className={`block text-[0.875rem] ${
                          task.done ? 'text-muted line-through' : 'text-charcoal'
                        }`}
                      >
                        {task.title}
                      </span>
                      <span className="block text-[0.75rem] text-muted">
                        {formatRelativeDay(task.dueAt)}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <LeadForm open={editOpen} onClose={() => setEditOpen(false)} lead={lead} />
      <CustomerForm
        open={customerOpen}
        onClose={() => setCustomerOpen(false)}
        leadId={lead.id}
        prefill={{ name: lead.name, phone: lead.phone, email: lead.email }}
        onCreated={(id) => navigate(paths.customer(id))}
      />
      {customer && vehicle && (
        <ReservationForm
          open={reserveOpen}
          onClose={() => setReserveOpen(false)}
          customerId={customer.id}
          vehicleId={vehicle.id}
          onCreated={(id) => navigate(paths.reservation(id))}
        />
      )}
      <TaskForm open={taskOpen} onClose={() => setTaskOpen(false)} links={{ leadId: lead.id }} />
    </div>
  );
}
