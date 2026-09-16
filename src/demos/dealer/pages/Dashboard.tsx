import { ArrowRight, AlertTriangle } from 'lucide-react';
import { useWorkspace } from '../DealerProvider';
import { paths } from '../dealer.routes';
import {
  dashboardMetrics,
  dealsNeedingAttention,
  getCustomer,
  getVehicle,
  recentActivity,
  reservationsExpiringSoon,
  salespersonName,
  tasksDueBy,
  inventoryByStatus,
  leadPipeline,
} from '../dealer.selectors';
import { LEAD_STAGES, VEHICLE_STATUSES } from '../dealer.types';
import { formatMoney, formatMoneyWhole, formatRelativeDay, vehicleTitle } from '../dealer.utils';
import { EmptyState, Metric, PageHeader, Panel, PanelHeader } from '../../shared/ui/AppUI';
import { BarList } from '../../shared/ui/Charts';
import { DealStatusBadge, ReservationStatusBadge } from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';

/**
 * Operational overview.
 *
 * Every figure is computed from the workspace as it stands, so creating a
 * reservation or closing a deal moves these numbers immediately. Nothing here
 * claims a trend or a growth rate — a demo cannot know one.
 */

export function Dashboard() {
  const state = useWorkspace();
  const metrics = dashboardMetrics(state);
  const expiring = reservationsExpiringSoon(state, 5);
  const attention = dealsNeedingAttention(state).slice(0, 5);
  const dueToday = tasksDueBy(state, 0).slice(0, 6);
  const activity = recentActivity(state, 8);

  const today = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-4">
      <PageHeader
        title="Overview"
        description={`${state.settings.companyName} — operational snapshot for ${today}.`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Metric
          label="New leads"
          value={metrics.newLeads}
          meta="Open opportunities"
          href={paths.module('leads')}
        />
        <Metric
          label="Active reservations"
          value={metrics.activeReservations}
          meta={`${expiring.length} expiring soon`}
          tone={expiring.length > 0 ? 'warning' : 'default'}
          href={paths.module('reservations')}
        />
        <Metric
          label="In stock"
          value={metrics.vehiclesInStock}
          meta={`${formatMoneyWhole(metrics.inventoryValue)} listed`}
          href={paths.module('inventory')}
        />
        <Metric
          label="Deals in progress"
          value={metrics.dealsInProgress}
          meta={`${formatMoneyWhole(metrics.outstandingBalance)} outstanding`}
          href={paths.module('deals')}
        />
        <Metric
          label="Financing in review"
          value={metrics.financingUnderReview}
          meta={`${metrics.pendingDocuments} documents pending`}
          href={paths.module('financing')}
        />
        <Metric
          label="Sold this month"
          value={metrics.soldThisMonth}
          meta={`${formatMoneyWhole(metrics.soldThisMonthValue)} in deals`}
          href={paths.module('reports')}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        {/* --------------------------------------------- deals to chase */}
        <Panel className="xl:col-span-2">
          <PanelHeader
            title="Deals needing attention"
            meta={attention.length > 0 ? `${attention.length} open` : undefined}
            actions={
              <a
                href={paths.module('deals')}
                className="inline-flex items-center gap-1 text-[0.8125rem] text-muted hover:text-copper transition-colors"
              >
                Deals
                <ArrowRight size={13} aria-hidden="true" />
              </a>
            }
          />
          {attention.length === 0 ? (
            <EmptyState
              title="Nothing is blocked"
              description="Every open deal has what it needs to move forward."
            />
          ) : (
            <ul>
              {attention.map(({ deal, readiness }) => {
                const customer = getCustomer(state, deal.customerId);
                const vehicle = getVehicle(state, deal.vehicleId);
                return (
                  <li key={deal.id} className="border-b border-app-border last:border-b-0">
                    <a
                      href={paths.deal(deal.id)}
                      className="block border-l-2 border-l-copper px-4 py-3 transition-colors hover:bg-app-bg"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="font-medium text-[0.9375rem] text-charcoal">
                          {customer?.name ?? 'Unknown customer'}
                        </span>
                        <DealStatusBadge status={deal.status} />
                      </div>
                      <p className="mt-0.5 text-[0.8125rem] text-muted">
                        {deal.code} · {vehicle ? vehicleTitle(vehicle) : 'No vehicle'} ·{' '}
                        {salespersonName(state, deal.salespersonId)}
                      </p>
                      <p className="mt-1 flex items-start gap-1.5 text-[0.8125rem] text-app-warning">
                        <AlertTriangle size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
                        {readiness.blockers[0]}
                      </p>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* ------------------------------------------- reservations & tasks */}
        <div className="space-y-4">
          <Panel>
            <PanelHeader
              title="Reservations expiring"
              meta={expiring.length > 0 ? `${expiring.length} soon` : undefined}
            />
            {expiring.length === 0 ? (
              <EmptyState title="No holds running out" description="Nothing expires in the next few days." />
            ) : (
              <ul>
                {expiring.slice(0, 5).map((reservation) => {
                  const customer = getCustomer(state, reservation.customerId);
                  const vehicle = getVehicle(state, reservation.vehicleId);
                  return (
                    <li key={reservation.id} className="border-b border-app-border last:border-b-0">
                      <a
                        href={paths.reservation(reservation.id)}
                        className="block px-4 py-2.5 transition-colors hover:bg-app-bg"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[0.875rem] text-charcoal truncate">
                            {customer?.name ?? 'Unknown'}
                          </span>
                          <ReservationStatusBadge status={reservation.status} />
                        </div>
                        <p className="mt-0.5 text-[0.75rem] text-muted truncate">
                          {vehicle?.code} · expires {formatRelativeDay(reservation.expiresAt)}
                        </p>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Tasks due" meta={dueToday.length > 0 ? `${dueToday.length} today` : undefined} />
            {dueToday.length === 0 ? (
              <EmptyState title="Nothing due today" description="The follow-up list is clear." />
            ) : (
              <ul>
                {dueToday.map((task) => (
                  <li
                    key={task.id}
                    className="border-b border-app-border last:border-b-0 px-4 py-2.5"
                  >
                    <p className="text-[0.875rem] text-charcoal">{task.title}</p>
                    <p className="mt-0.5 text-[0.75rem] text-muted">
                      {formatRelativeDay(task.dueAt)} · {salespersonName(state, task.assigneeId)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <Panel>
          <PanelHeader title="Lead pipeline" meta={`${state.leads.length} leads`} />
          <div className="px-4 py-3.5">
            <BarList data={leadPipeline(state, LEAD_STAGES)} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Inventory status" meta={`${state.vehicles.length} units`} />
          <div className="px-4 py-3.5">
            <BarList data={inventoryByStatus(state, VEHICLE_STATUSES)} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Recent activity" />
          <div className="px-4 py-3.5">
            <Timeline events={activity} limit={8} />
          </div>
        </Panel>
      </div>

      <p className="text-[0.75rem] text-muted">
        Every figure above is computed from the records in this workspace. Outstanding balance is
        the sum of what is still owed on deals that have not closed:{' '}
        {formatMoney(metrics.outstandingBalance)}.
      </p>
    </div>
  );
}
