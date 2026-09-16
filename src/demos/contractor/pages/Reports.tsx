import { useMemo } from 'react';
import { useContractor } from '../ContractorProvider';
import {
  crewWorkload,
  estimateAcceptance,
  invoiceAging,
  jobsByStatus,
  jobsCompletedByMonth,
  leadPipeline,
  leadsBySource,
  paymentHistory,
  invoiceBalance,
  invoiceStatus,
  getCustomer,
} from '../contractor.selectors';
import { paths } from '../contractor.routes';
import { formatMoney, formatRelativeDay, pluralize } from '../contractor.utils';
import {
  EmptyState,
  FieldLabel,
  Panel,
  PanelHeader,
  PageHeader,
  ProgressBar,
} from '../components/AppUI';
import { BarList, ColumnChart, SplitBar } from '../components/Charts';
import { InvoiceStatusBadge } from '../components/StatusBadge';

/**
 * Reports.
 *
 * Every figure is computed from the workspace as it stands. There are no
 * targets, benchmarks or performance claims — only what the records say.
 */
export function ReportsPage() {
  const { state } = useContractor();
  const now = useMemo(() => new Date(), []);

  const pipeline = useMemo(() => leadPipeline(state), [state]);
  const sources = useMemo(() => leadsBySource(state), [state]);
  const acceptance = useMemo(() => estimateAcceptance(state), [state]);
  const byStatus = useMemo(() => jobsByStatus(state), [state]);
  const completed = useMemo(() => jobsCompletedByMonth(state, 6, now), [state, now]);
  const aging = useMemo(() => invoiceAging(state, now), [state, now]);
  const payments = useMemo(() => paymentHistory(state, 6, now), [state, now]);
  const workload = useMemo(() => crewWorkload(state, now), [state, now]);

  const outstanding = useMemo(
    () =>
      state.invoices
        .filter((invoice) => {
          const status = invoiceStatus(state, invoice, now);
          return status === 'Sent' || status === 'Partial' || status === 'Overdue';
        })
        .map((invoice) => ({ invoice, balance: invoiceBalance(state, invoice) }))
        .sort((a, b) => b.balance - a.balance),
    [state, now],
  );

  const outstandingTotal = outstanding.reduce((sum, entry) => sum + entry.balance, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        description="Operational reporting derived from the records in this workspace."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel>
          <PanelHeader title="Lead pipeline" meta={pluralize(state.leads.length, 'lead')} />
          <div className="px-3.5 py-3.5">
            <BarList data={pipeline} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Lead source" meta="Where opportunities come from" />
          <div className="px-3.5 py-3.5">
            <BarList data={sources} />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel>
          <PanelHeader title="Estimate outcomes" />
          <div className="px-3.5 py-3.5 space-y-4">
            <SplitBar
              segments={[
                { label: 'Accepted', value: acceptance.accepted, className: 'bg-success' },
                { label: 'Declined', value: acceptance.declined, className: 'bg-danger' },
                { label: 'Awaiting', value: acceptance.outstanding, className: 'bg-info' },
                { label: 'Expired', value: acceptance.expired, className: 'bg-app-border-strong' },
                { label: 'Draft', value: acceptance.draft, className: 'bg-muted' },
              ]}
            />

            <dl className="grid grid-cols-2 gap-4 border-t border-app-border pt-3">
              <div>
                <FieldLabel>Acceptance rate</FieldLabel>
                <dd className="mt-1 font-heading font-semibold text-[1.25rem] tabular-nums text-charcoal">
                  {acceptance.acceptanceRate === undefined
                    ? '—'
                    : `${acceptance.acceptanceRate}%`}
                </dd>
                <p className="mt-0.5 text-[0.6875rem] text-muted">
                  Of estimates the customer has decided on.
                </p>
              </div>
              <div>
                <FieldLabel>Accepted value</FieldLabel>
                <dd className="mt-1 font-heading font-semibold text-[1.25rem] tabular-nums text-charcoal">
                  {formatMoney(acceptance.acceptedValue)}
                </dd>
              </div>
            </dl>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Jobs by status" />
          <div className="px-3.5 py-3.5">
            <BarList data={byStatus} emptyLabel="No jobs recorded." />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Jobs completed" meta="Last six months" />
          <div className="px-3.5 py-3.5">
            <ColumnChart data={completed} caption="Jobs completed by month" />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel>
          <PanelHeader title="Invoice aging" meta={formatMoney(outstandingTotal)} />
          <div className="px-3.5 py-3.5">
            <BarList data={aging} showAmount emptyLabel="No open invoices." />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Payments received" meta="Last six months" />
          <div className="px-3.5 py-3.5">
            <ColumnChart data={payments} showAmount caption="Payments received by month" />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel>
          <PanelHeader title="Outstanding invoices" meta={pluralize(outstanding.length, 'invoice')} />
          {outstanding.length === 0 ? (
            <EmptyState title="Nothing outstanding" description="Every issued invoice is settled." />
          ) : (
            <ul className="divide-y divide-app-border">
              {outstanding.slice(0, 8).map(({ invoice, balance }) => (
                <li key={invoice.id}>
                  <a
                    href={paths.invoice(invoice.id)}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-app-hover"
                  >
                    <span className="min-w-0">
                      <span className="block text-[0.8125rem] text-charcoal truncate">
                        {getCustomer(state, invoice.customerId)?.name}
                      </span>
                      <span className="block text-[0.75rem] text-muted">
                        {invoice.code} · due {formatRelativeDay(invoice.dueAt)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2.5 shrink-0">
                      <span className="tabular-nums text-[0.8125rem] text-charcoal">
                        {formatMoney(balance)}
                      </span>
                      <InvoiceStatusBadge status={invoiceStatus(state, invoice, now)} />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Crew workload" meta="This week" />
          <ul className="px-3.5 py-3.5 space-y-3.5">
            {workload.map((entry) => (
              <li key={entry.crew.id}>
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <a
                    href={paths.crew(entry.crew.id)}
                    className="text-[0.875rem] text-charcoal hover:text-copper transition-colors"
                  >
                    {entry.crew.name}
                  </a>
                  <span className="text-[0.75rem] tabular-nums text-muted">
                    {pluralize(entry.jobCount, 'job')} · {entry.scheduledHours}h /{' '}
                    {entry.capacityHours}h
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
    </div>
  );
}
