import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { useContractor } from '../ContractorProvider';
import {
  crewWorkload,
  dashboardMetrics,
  getCrew,
  getCustomer,
  getLocation,
  invoiceAging,
  invoiceBalance,
  invoiceStatus,
  leadPipeline,
  openFollowUps,
  recentActivity,
  todaysJobs,
  upcomingJobs,
} from '../contractor.selectors';
import { paths } from '../contractor.routes';
import {
  formatAddressShort,
  formatMoney,
  formatMoneyWhole,
  formatRelativeDay,
  formatTime,
  formatWeekday,
} from '../contractor.utils';
import { EmptyState, Metric, Panel, PanelHeader, PageHeader, ProgressBar } from '../components/AppUI';
import { InvoiceStatusBadge, JobStatusBadge, jobAccent } from '../components/StatusBadge';
import { BarList } from '../components/Charts';
import { Timeline } from '../components/Timeline';

/**
 * Operational overview.
 *
 * Every figure is computed from the current workspace, so anything a visitor
 * creates or changes is reflected here immediately. Nothing on this page is a
 * hardcoded number or an invented performance claim.
 */
export function Dashboard() {
  const { state } = useContractor();
  const now = useMemo(() => new Date(), []);

  const metrics = useMemo(() => dashboardMetrics(state, now), [state, now]);
  const today = useMemo(() => todaysJobs(state, now), [state, now]);
  const upcoming = useMemo(() => upcomingJobs(state, now, 5), [state, now]);
  const pipeline = useMemo(() => leadPipeline(state), [state]);
  const aging = useMemo(() => invoiceAging(state, now), [state, now]);
  const workload = useMemo(() => crewWorkload(state, now), [state, now]);
  const tasks = useMemo(() => openFollowUps(state).slice(0, 6), [state]);
  const activity = useMemo(() => recentActivity(state, 10), [state]);

  const openInvoices = useMemo(
    () =>
      state.invoices
        .filter((invoice) => {
          const status = invoiceStatus(state, invoice, now);
          return status === 'Overdue' || status === 'Partial' || status === 'Sent';
        })
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
        .slice(0, 5),
    [state, now],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Overview"
        description={`${state.settings.companyName} — operational snapshot for ${formatWeekday(now.toISOString())}.`}
      />

      {/* ------------------------------------------------------- metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Metric
          label="Open leads"
          value={metrics.openLeads}
          meta={`${formatMoneyWhole(metrics.openLeadValue)} potential`}
          href={paths.module('leads')}
        />
        <Metric
          label="Awaiting decision"
          value={metrics.estimatesAwaitingDecision}
          meta={`${formatMoneyWhole(metrics.estimatesAwaitingValue)} quoted`}
          href={paths.module('estimates')}
        />
        <Metric
          label="Active jobs"
          value={metrics.activeJobs}
          meta={`${metrics.jobsScheduledThisWeek} on the schedule this week`}
          href={paths.module('jobs')}
        />
        <Metric
          label="Outstanding"
          value={formatMoneyWhole(metrics.outstandingBalance)}
          meta={`${metrics.outstandingInvoices} open invoices`}
          href={paths.module('invoices')}
        />
        <Metric
          label="Overdue"
          value={formatMoneyWhole(metrics.overdueBalance)}
          meta={`${metrics.overdueInvoices} past due`}
          tone={metrics.overdueInvoices > 0 ? 'danger' : 'default'}
          href={paths.module('invoices')}
        />
        <Metric
          label="Received this month"
          value={formatMoneyWhole(metrics.paymentsThisMonth)}
          meta={`${metrics.paymentsThisMonthCount} payments`}
          href={paths.module('payments')}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        {/* ------------------------------------------------ today's work */}
        <Panel className="xl:col-span-2">
          <PanelHeader
            title="Today on site"
            meta={today.length > 0 ? `${today.length} scheduled` : undefined}
            actions={
              <a
                href={paths.module('schedule')}
                className="inline-flex items-center gap-1 text-[0.8125rem] text-muted hover:text-copper transition-colors"
              >
                Schedule
                <ArrowRight size={13} aria-hidden="true" />
              </a>
            }
          />
          {today.length === 0 ? (
            <EmptyState
              title="Nothing scheduled today"
              description="Jobs booked for today will appear here with their crew and location."
            />
          ) : (
            <ul className="divide-y divide-app-border">
              {today.map(({ job, start, end }) => {
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
                        <span className="font-medium text-[0.875rem] text-charcoal">
                          {job.title}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-[0.75rem] tabular-nums text-muted">
                            {formatTime(start.toISOString())} – {formatTime(end.toISOString())}
                          </span>
                          <JobStatusBadge status={job.status} />
                        </span>
                      </div>
                      <p className="mt-1 text-[0.8125rem] text-muted">
                        {customer?.name}
                        {location && ` · ${formatAddressShort(location.address)}`}
                      </p>
                      <p className="mt-0.5 text-[0.75rem] text-muted">
                        {crew ? crew.name : 'No crew assigned'} · {job.code}
                      </p>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* -------------------------------------------------- follow-ups */}
        <Panel>
          <PanelHeader
            title="Follow-ups"
            meta={metrics.followUpsDue > 0 ? `${metrics.followUpsDue} due` : undefined}
          />
          {tasks.length === 0 ? (
            <EmptyState title="Nothing outstanding" description="Scheduled follow-ups appear here." />
          ) : (
            <ul className="divide-y divide-app-border">
              {tasks.map((task) => {
                const overdue = new Date(task.dueAt) < new Date(new Date().toDateString());
                return (
                  <li key={task.id} className="px-3.5 py-2.5">
                    <p className="text-[0.8125rem] text-charcoal leading-snug">{task.title}</p>
                    <p className="mt-0.5 text-[0.75rem]">
                      <span className={overdue ? 'text-danger font-medium' : 'text-muted'}>
                        {formatRelativeDay(task.dueAt)}
                      </span>
                      <span className="text-muted"> · {task.type}</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {/* -------------------------------------------------- upcoming */}
        <Panel>
          <PanelHeader title="Upcoming jobs" />
          {upcoming.length === 0 ? (
            <EmptyState title="Nothing booked ahead" />
          ) : (
            <ul className="divide-y divide-app-border">
              {upcoming.map(({ job, start }) => {
                const customer = getCustomer(state, job.customerId);
                const crew = getCrew(state, job.crewId);
                return (
                  <li key={job.id}>
                    <a
                      href={paths.job(job.id)}
                      className="block px-3.5 py-2.5 transition-colors hover:bg-app-hover"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[0.8125rem] font-medium text-charcoal truncate">
                          {job.title}
                        </span>
                        <span className="shrink-0 text-[0.75rem] text-muted whitespace-nowrap">
                          {formatWeekday(start.toISOString())}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[0.75rem] text-muted truncate">
                        {customer?.name} · {crew?.name ?? 'Unassigned'}
                      </p>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* -------------------------------------------------- pipeline */}
        <Panel>
          <PanelHeader title="Lead pipeline" />
          <div className="px-3.5 py-3.5">
            <BarList data={pipeline.filter((bucket) => bucket.label !== 'Lost')} />
          </div>
        </Panel>

        {/* ------------------------------------------------ crew load */}
        <Panel>
          <PanelHeader title="Crew workload" meta="This week" />
          <ul className="px-3.5 py-3.5 space-y-3">
            {workload.map((entry) => (
              <li key={entry.crew.id}>
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <a
                    href={paths.crew(entry.crew.id)}
                    className="text-[0.8125rem] text-charcoal hover:text-copper transition-colors truncate"
                  >
                    {entry.crew.name}
                  </a>
                  <span className="text-[0.75rem] tabular-nums text-muted whitespace-nowrap">
                    {entry.scheduledHours}h / {entry.capacityHours}h
                  </span>
                </div>
                <ProgressBar
                  value={entry.utilization}
                  label={`${entry.crew.name} at ${entry.utilization}% of weekly capacity`}
                  tone={entry.utilization > 90 ? 'warning' : 'copper'}
                />
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {/* -------------------------------------------- invoice aging */}
        <Panel>
          <PanelHeader title="Invoice aging" meta="Open balances" />
          <div className="px-3.5 py-3.5">
            <BarList data={aging} showAmount emptyLabel="No open invoices." />
          </div>
        </Panel>

        {/* ------------------------------------------- open receivables */}
        <Panel>
          <PanelHeader
            title="Open invoices"
            actions={
              <a
                href={paths.module('invoices')}
                className="inline-flex items-center gap-1 text-[0.8125rem] text-muted hover:text-copper transition-colors"
              >
                All
                <ArrowRight size={13} aria-hidden="true" />
              </a>
            }
          />
          {openInvoices.length === 0 ? (
            <EmptyState title="Nothing outstanding" description="Every issued invoice is settled." />
          ) : (
            <ul className="divide-y divide-app-border">
              {openInvoices.map((invoice) => {
                const customer = getCustomer(state, invoice.customerId);
                return (
                  <li key={invoice.id}>
                    <a
                      href={paths.invoice(invoice.id)}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-app-hover"
                    >
                      <span className="min-w-0">
                        <span className="block text-[0.8125rem] text-charcoal truncate">
                          {customer?.name}
                        </span>
                        <span className="block text-[0.75rem] text-muted">
                          {invoice.code} · due {formatRelativeDay(invoice.dueAt)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[0.8125rem] tabular-nums text-charcoal">
                          {formatMoney(invoiceBalance(state, invoice))}
                        </span>
                        <span className="mt-0.5 block">
                          <InvoiceStatusBadge status={invoiceStatus(state, invoice, now)} />
                        </span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* ---------------------------------------------------- activity */}
        <Panel>
          <PanelHeader title="Recent activity" />
          <div className="px-3.5 py-2">
            <Timeline events={activity} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
