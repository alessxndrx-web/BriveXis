import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useContractor } from '../ContractorProvider';
import type { Job } from '../contractor.types';
import {
  getCrew,
  getCustomer,
  getLocation,
  jobsInRange,
  jobsOnDay,
  weekDays,
} from '../contractor.selectors';
import { paths } from '../contractor.routes';
import {
  addDays,
  formatAddressShort,
  formatDate,
  formatTime,
  isSameDay,
  startOfWeek,
} from '../contractor.utils';
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  InlineField,
  Panel,
  PanelHeader,
  PageHeader,
  Select,
  Tabs,
} from '../components/AppUI';
import { JobStatusBadge, jobAccent } from '../components/StatusBadge';
import { ScheduleDialog } from '../forms/JobForms';

/**
 * Scheduling.
 *
 * Two views over the same data: a week grid for planning and an agenda list
 * that works on a phone. Scheduling and rescheduling happen through a dialog
 * rather than drag-and-drop — see the note in JobForms for why.
 */

const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const DAY_NUMBER = new Intl.DateTimeFormat('en-US', { day: 'numeric' });
const MONTH_RANGE = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

export function SchedulePage() {
  const { state } = useContractor();
  const [anchor, setAnchor] = useState(() => new Date());
  const [view, setView] = useState('week');
  const [crewFilter, setCrewFilter] = useState('all');
  const [scheduling, setScheduling] = useState<Job | null>(null);

  const days = useMemo(() => weekDays(anchor), [anchor]);

  const matchesCrew = useMemo(
    () => (job: Job) => {
      if (crewFilter === 'all') return true;
      if (crewFilter === 'unassigned') return !job.crewId;
      return job.crewId === crewFilter;
    },
    [crewFilter],
  );

  const unscheduled = useMemo(
    () =>
      state.jobs.filter(
        (job) => !job.scheduledStart && job.status !== 'Completed' && job.status !== 'Cancelled',
      ),
    [state.jobs],
  );

  const agenda = useMemo(
    () =>
      jobsInRange(state, days[0], addDays(days[6], 21)).filter((entry) => matchesCrew(entry.job)),
    [state, days, matchesCrew],
  );

  const today = new Date();
  const weekLabel = `${MONTH_RANGE.format(days[0])}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Schedule"
        description="Booked work by day, with the crew assigned to each job."
        actions={
          <>
            <Button onClick={() => setAnchor(new Date())}>Today</Button>
            <div className="flex items-center gap-1">
              <IconButton
                label="Previous week"
                onClick={() => setAnchor((current) => addDays(startOfWeek(current), -7))}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </IconButton>
              <IconButton
                label="Next week"
                onClick={() => setAnchor((current) => addDays(startOfWeek(current), 7))}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </IconButton>
            </div>
          </>
        }
      />

      <Panel>
        <div className="flex flex-wrap items-center gap-3 border-b border-app-border px-2 py-1.5">
          <Tabs
            tabs={[
              { id: 'week', label: 'Week' },
              { id: 'agenda', label: 'Agenda' },
            ]}
            active={view}
            onChange={setView}
            label="Schedule view"
          />

          <span className="text-[0.875rem] font-medium text-charcoal ml-2">{weekLabel}</span>

          <InlineField label="Crew" htmlFor="schedule-crew">
            <Select
              id="schedule-crew"
              value={crewFilter}
              onChange={(event) => setCrewFilter(event.target.value)}
              className="h-8 w-auto"
            >
              <option value="all">All crews</option>
              <option value="unassigned">Unassigned</option>
              {state.crews.map((crew) => (
                <option key={crew.id} value={crew.id}>
                  {crew.name}
                </option>
              ))}
            </Select>
          </InlineField>
        </div>

        <div id={`tabpanel-${view}`} role="tabpanel" aria-labelledby={`tab-${view}`}>
          {view === 'week' ? (
            /* The grid scrolls horizontally on narrow screens rather than
               dropping days, so a week always reads as a week. */
            <div className="overflow-x-auto">
              <div className="grid grid-cols-7 min-w-[52rem]">
                {days.map((day) => {
                  const entries = jobsOnDay(state, day).filter((entry) => matchesCrew(entry.job));
                  const isToday = isSameDay(day, today);

                  return (
                    <div
                      key={day.toISOString()}
                      className="border-r border-app-border last:border-r-0 min-h-[18rem]"
                    >
                      <div
                        className={`sticky top-0 border-b px-2 py-2 ${
                          isToday
                            ? 'border-copper/40 bg-copper/[0.06]'
                            : 'border-app-border bg-app-hover'
                        }`}
                      >
                        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                          {WEEKDAY.format(day)}
                        </p>
                        <p
                          className={`text-[0.9375rem] font-heading font-semibold tabular-nums ${
                            isToday ? 'text-copper' : 'text-charcoal'
                          }`}
                        >
                          {DAY_NUMBER.format(day)}
                        </p>
                      </div>

                      <div className="p-1.5 space-y-1.5">
                        {entries.length === 0 ? (
                          <p className="px-1 py-2 text-[0.75rem] text-muted/70">—</p>
                        ) : (
                          entries.map(({ job, start }) => {
                            const customer = getCustomer(state, job.customerId);
                            const crew = getCrew(state, job.crewId);
                            return (
                              <a
                                key={job.id}
                                href={paths.job(job.id)}
                                className={`block border border-app-border border-l-2 ${jobAccent[job.status]} bg-app-panel rounded-[2px] px-2 py-1.5 transition-colors hover:bg-app-hover`}
                              >
                                <span className="block text-[0.6875rem] tabular-nums text-muted">
                                  {formatTime(start.toISOString())}
                                </span>
                                <span className="block text-[0.75rem] font-medium text-charcoal leading-tight line-clamp-2">
                                  {job.title}
                                </span>
                                <span className="mt-0.5 block text-[0.6875rem] text-muted truncate">
                                  {customer?.name}
                                </span>
                                <span className="mt-0.5 block text-[0.6875rem] text-muted truncate">
                                  {crew?.name ?? 'Unassigned'}
                                </span>
                              </a>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : agenda.length === 0 ? (
            <EmptyState
              title="Nothing scheduled in this period"
              description="Jobs booked from today onwards will appear here."
            />
          ) : (
            <ul className="divide-y divide-app-border">
              {agenda.map(({ job, start, end }) => {
                const customer = getCustomer(state, job.customerId);
                const location = getLocation(state, job.locationId);
                const crew = getCrew(state, job.crewId);
                return (
                  <li key={job.id}>
                    <a
                      href={paths.job(job.id)}
                      className={`block border-l-2 ${jobAccent[job.status]} px-3.5 py-3 transition-colors hover:bg-app-hover`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="text-[0.875rem] font-medium text-charcoal">
                          {job.title}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-[0.75rem] tabular-nums text-muted">
                            {formatDate(start.toISOString())} · {formatTime(start.toISOString())} –{' '}
                            {formatTime(end.toISOString())}
                          </span>
                          <JobStatusBadge status={job.status} />
                        </span>
                      </div>
                      <p className="mt-1 text-[0.8125rem] text-muted">
                        {customer?.name}
                        {location && ` · ${formatAddressShort(location.address)}`}
                      </p>
                      <p className="mt-0.5 text-[0.75rem] text-muted">
                        {crew?.name ?? 'No crew assigned'} · {job.code}
                      </p>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Unscheduled jobs"
          meta={unscheduled.length > 0 ? `${unscheduled.length} waiting` : undefined}
        />
        {unscheduled.length === 0 ? (
          <EmptyState
            title="Everything is scheduled"
            description="Jobs created from accepted estimates appear here until a date is set."
          />
        ) : (
          <ul className="divide-y divide-app-border">
            {unscheduled.map((job) => {
              const customer = getCustomer(state, job.customerId);
              const location = getLocation(state, job.locationId);
              return (
                <li
                  key={job.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5"
                >
                  <span className="min-w-0">
                    <a
                      href={paths.job(job.id)}
                      className="block text-[0.875rem] font-medium text-charcoal hover:text-copper transition-colors truncate"
                    >
                      {job.title}
                    </a>
                    <span className="block text-[0.75rem] text-muted truncate">
                      {job.code} · {customer?.name}
                      {location && ` · ${formatAddressShort(location.address)}`}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {!job.crewId && <Badge tone="warning">No crew</Badge>}
                    <Button size="sm" onClick={() => setScheduling(job)}>
                      Schedule
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {scheduling && (
        <ScheduleDialog
          open={Boolean(scheduling)}
          onClose={() => setScheduling(null)}
          job={scheduling}
        />
      )}
    </div>
  );
}
