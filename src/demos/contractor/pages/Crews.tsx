import { useMemo } from 'react';
import { useContractor } from '../ContractorProvider';
import {
  crewJobs,
  crewMembers,
  crewWorkload,
  getCustomer,
  getLocation,
} from '../contractor.selectors';
import { paths } from '../contractor.routes';
import { formatAddressShort, formatDate, formatTime, pluralize } from '../contractor.utils';
import {
  Badge,
  EmptyState,
  FieldLabel,
  LinkButton,
  Panel,
  PanelHeader,
  PageHeader,
  ProgressBar,
} from '../components/AppUI';
import { JobStatusBadge, jobAccent } from '../components/StatusBadge';

/**
 * Crews and their workload.
 *
 * Operational only: who is on each crew, what they are skilled in, and what
 * they are booked to do. No HR or payroll information — none of that belongs
 * in a field operations system.
 */
export function CrewsPage() {
  const { state } = useContractor();
  const now = useMemo(() => new Date(), []);
  const workload = useMemo(() => crewWorkload(state, now), [state, now]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Crews"
        description="Field teams, their skills and what each is scheduled to do this week."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {state.crews.map((crew) => {
          const members = crewMembers(state, crew.id);
          const load = workload.find((entry) => entry.crew.id === crew.id);
          const jobs = crewJobs(state, crew.id).filter(
            (job) => job.status !== 'Completed',
          );

          return (
            <Panel key={crew.id}>
              <PanelHeader
                title={
                  <a href={paths.crew(crew.id)} className="hover:text-copper transition-colors">
                    {crew.name}
                  </a>
                }
                meta={crew.trade}
                actions={
                  <Badge tone={load && load.utilization > 90 ? 'warning' : 'neutral'}>
                    {load?.utilization ?? 0}% booked
                  </Badge>
                }
              />

              <div className="px-3.5 py-3.5 space-y-3.5">
                <div>
                  <div className="flex items-baseline justify-between gap-3 mb-1.5">
                    <FieldLabel>This week</FieldLabel>
                    <span className="text-[0.75rem] tabular-nums text-muted">
                      {load?.scheduledHours ?? 0}h of {crew.weeklyCapacityHours}h ·{' '}
                      {pluralize(load?.jobCount ?? 0, 'job')}
                    </span>
                  </div>
                  <ProgressBar
                    value={load?.utilization ?? 0}
                    label={`${crew.name} at ${load?.utilization ?? 0}% of weekly capacity`}
                    tone={(load?.utilization ?? 0) > 90 ? 'warning' : 'copper'}
                  />
                </div>

                <div>
                  <FieldLabel className="mb-1.5">Members</FieldLabel>
                  <ul className="space-y-1">
                    {members.map((member) => (
                      <li
                        key={member.id}
                        className="flex flex-wrap items-baseline gap-x-2 text-[0.8125rem]"
                      >
                        <span className="text-charcoal font-medium">{member.name}</span>
                        <span className="text-muted">{member.role}</span>
                        <span className="text-muted/80">· {member.skills.join(', ')}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {crew.notes && <p className="text-[0.8125rem] text-muted">{crew.notes}</p>}
              </div>

              <div className="border-t border-app-border">
                <div className="px-3.5 py-2">
                  <FieldLabel>Current and upcoming</FieldLabel>
                </div>
                {jobs.length === 0 ? (
                  <p className="px-3.5 pb-3 text-[0.8125rem] text-muted">
                    No open jobs assigned to this crew.
                  </p>
                ) : (
                  <ul className="divide-y divide-app-border">
                    {jobs.slice(0, 4).map((job) => (
                      <li key={job.id}>
                        <a
                          href={paths.job(job.id)}
                          className={`flex items-center justify-between gap-3 border-l-2 ${jobAccent[job.status]} px-3 py-2 transition-colors hover:bg-app-hover`}
                        >
                          <span className="min-w-0">
                            <span className="block text-[0.8125rem] text-charcoal truncate">
                              {job.title}
                            </span>
                            <span className="block text-[0.75rem] text-muted truncate">
                              {job.scheduledStart ? formatDate(job.scheduledStart) : 'Unscheduled'}
                              {' · '}
                              {getCustomer(state, job.customerId)?.name}
                            </span>
                          </span>
                          <JobStatusBadge status={job.status} />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

// -------------------------------------------------------------- detail

export function CrewDetail({ crewId }: { crewId: string }) {
  const { state } = useContractor();
  const now = useMemo(() => new Date(), []);

  const crew = state.crews.find((candidate) => candidate.id === crewId);
  const members = useMemo(() => (crew ? crewMembers(state, crew.id) : []), [state, crew]);
  const jobs = useMemo(() => (crew ? crewJobs(state, crew.id) : []), [state, crew]);
  const load = useMemo(
    () => (crew ? crewWorkload(state, now).find((entry) => entry.crew.id === crew.id) : undefined),
    [state, crew, now],
  );

  if (!crew) {
    return (
      <EmptyState
        title="Crew not found"
        action={<LinkButton href={paths.module('crews')}>Back to crews</LinkButton>}
      />
    );
  }

  const open = jobs.filter((job) => job.status !== 'Completed');
  const completed = jobs.filter((job) => job.status === 'Completed');

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <a href={paths.module('crews')} className="hover:text-copper transition-colors">
            Crews
          </a>
        }
        title={crew.name}
        description={
          <span className="text-muted">
            {crew.trade} · {pluralize(members.length, 'member')} ·{' '}
            {load?.scheduledHours ?? 0}h booked this week
          </span>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Capacity" meta="This week" />
            <div className="px-3.5 py-3.5">
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <span className="text-[0.875rem] text-charcoal tabular-nums">
                  {load?.scheduledHours ?? 0}h / {crew.weeklyCapacityHours}h
                </span>
                <span className="text-[0.8125rem] text-muted tabular-nums">
                  {load?.utilization ?? 0}%
                </span>
              </div>
              <ProgressBar
                value={load?.utilization ?? 0}
                label={`${crew.name} weekly utilization`}
                tone={(load?.utilization ?? 0) > 90 ? 'warning' : 'copper'}
              />
              <p className="mt-3 text-[0.75rem] text-muted">
                Booked hours are derived from each job&rsquo;s scheduled window, capped at eight
                hours per working day.
              </p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Members" />
            <ul className="divide-y divide-app-border">
              {members.map((member) => (
                <li key={member.id} className="px-3.5 py-2.5">
                  <p className="text-[0.875rem] font-medium text-charcoal">{member.name}</p>
                  <p className="text-[0.8125rem] text-muted">{member.role}</p>
                  <ul className="mt-1.5 flex flex-wrap gap-1">
                    {member.skills.map((skill) => (
                      <li
                        key={skill}
                        className="border border-app-border rounded-[2px] px-1.5 py-0.5 text-[0.75rem] text-muted"
                      >
                        {skill}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </Panel>

          {crew.notes && (
            <Panel>
              <PanelHeader title="Notes" />
              <p className="px-3.5 py-3 text-[0.875rem] text-muted leading-relaxed">{crew.notes}</p>
            </Panel>
          )}
        </div>

        <div className="xl:col-span-2 space-y-4">
          <Panel>
            <PanelHeader title="Open jobs" meta={pluralize(open.length, 'job')} />
            {open.length === 0 ? (
              <EmptyState title="No open jobs" description="This crew has nothing assigned." />
            ) : (
              <ul className="divide-y divide-app-border">
                {open.map((job) => {
                  const customer = getCustomer(state, job.customerId);
                  const location = getLocation(state, job.locationId);
                  return (
                    <li key={job.id}>
                      <a
                        href={paths.job(job.id)}
                        className={`block border-l-2 ${jobAccent[job.status]} px-3.5 py-2.5 transition-colors hover:bg-app-hover`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <span className="text-[0.875rem] font-medium text-charcoal">
                            {job.title}
                          </span>
                          <span className="flex items-center gap-2">
                            {job.scheduledStart && (
                              <span className="text-[0.75rem] tabular-nums text-muted">
                                {formatDate(job.scheduledStart)} ·{' '}
                                {formatTime(job.scheduledStart)}
                              </span>
                            )}
                            <JobStatusBadge status={job.status} />
                          </span>
                        </div>
                        <p className="mt-0.5 text-[0.75rem] text-muted">
                          {job.code} · {customer?.name}
                          {location && ` · ${formatAddressShort(location.address)}`}
                        </p>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {completed.length > 0 && (
            <Panel>
              <PanelHeader title="Recently completed" meta={pluralize(completed.length, 'job')} />
              <ul className="divide-y divide-app-border">
                {completed.slice(0, 6).map((job) => (
                  <li key={job.id}>
                    <a
                      href={paths.job(job.id)}
                      className="flex items-center justify-between gap-3 px-3.5 py-2 transition-colors hover:bg-app-hover"
                    >
                      <span className="min-w-0">
                        <span className="block text-[0.8125rem] text-charcoal truncate">
                          {job.title}
                        </span>
                        <span className="block text-[0.75rem] text-muted">
                          {job.completedAt ? formatDate(job.completedAt) : ''}
                        </span>
                      </span>
                      <JobStatusBadge status={job.status} />
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
