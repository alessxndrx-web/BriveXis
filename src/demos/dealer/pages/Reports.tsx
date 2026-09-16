import { useWorkspace } from '../DealerProvider';
import { paths } from '../dealer.routes';
import {
  DEAL_STATUSES,
  FINANCING_STATUSES,
  LEAD_SOURCES,
  LEAD_STAGES,
  RESERVATION_STATUSES,
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
} from '../dealer.types';
import {
  dashboardMetrics,
  dealsByStatus,
  financingByStatus,
  inventoryAging,
  inventoryByStatus,
  inventoryByType,
  leadPipeline,
  leadsBySource,
  paymentsByMonth,
  reservationsByStatus,
  salespersonPerformance,
  unitsSoldByMonth,
} from '../dealer.selectors';
import { formatMoney, formatMoneyWhole } from '../dealer.utils';
import { EmptyState, PageHeader, Panel, PanelHeader } from '../../shared/ui/AppUI';
import { BarList, ColumnChart } from '../../shared/ui/Charts';

/**
 * Reporting.
 *
 * Everything is derived from the records in this workspace. There are no
 * targets, no benchmarks and no growth claims, because a demo has nothing to
 * compare itself against and inventing one would be dishonest.
 */

export function ReportsPage() {
  const state = useWorkspace();
  const metrics = dashboardMetrics(state);
  const performance = salespersonPerformance(state);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        description="Operational reporting derived from the records in this workspace."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel>
          <PanelHeader title="Lead pipeline" meta={`${state.leads.length} leads`} />
          <div className="px-4 py-3.5">
            <BarList data={leadPipeline(state, LEAD_STAGES)} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Lead source" meta="Where opportunities come from" />
          <div className="px-4 py-3.5">
            <BarList data={leadsBySource(state, LEAD_SOURCES)} />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel>
          <PanelHeader title="Inventory by status" meta={`${state.vehicles.length} units`} />
          <div className="px-4 py-3.5">
            <BarList data={inventoryByStatus(state, VEHICLE_STATUSES)} showAmount />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Inventory by type" />
          <div className="px-4 py-3.5">
            <BarList data={inventoryByType(state, VEHICLE_TYPES)} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Inventory aging" meta={formatMoneyWhole(metrics.inventoryValue)} />
          <div className="px-4 py-3.5">
            <BarList data={inventoryAging(state)} showAmount />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel>
          <PanelHeader title="Deals by status" meta={`${state.deals.length} deals`} />
          <div className="px-4 py-3.5">
            <BarList data={dealsByStatus(state, DEAL_STATUSES)} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Reservations" meta={`${state.reservations.length} total`} />
          <div className="px-4 py-3.5">
            <BarList data={reservationsByStatus(state, RESERVATION_STATUSES)} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Financing applications" meta={`${state.financing.length} tracked`} />
          <div className="px-4 py-3.5">
            <BarList data={financingByStatus(state, FINANCING_STATUSES)} />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel>
          <PanelHeader title="Units sold" meta="Last six months" />
          <div className="px-4 py-3.5">
            <ColumnChart data={unitsSoldByMonth(state)} caption="Units sold by month" />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Payments received" meta="Last six months" />
          <div className="px-4 py-3.5">
            <ColumnChart data={paymentsByMonth(state)} showAmount caption="Payments received by month" />
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Salesperson activity" meta="Closed deals" />
        {performance.every((entry) => entry.value === 0) ? (
          <EmptyState title="No closed deals yet" />
        ) : (
          <ul>
            {performance.map((entry) => (
              <li
                key={entry.label}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-app-border last:border-b-0 px-4 py-2.5"
              >
                <span className="text-[0.875rem] text-charcoal">{entry.label}</span>
                <span className="text-[0.8125rem] text-muted tabular-nums">
                  {entry.value} {entry.value === 1 ? 'unit' : 'units'} ·{' '}
                  {formatMoney(entry.amount ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="text-[0.75rem] text-muted">
        These figures describe this demo workspace only. Nothing here is an audited financial
        statement and no accounting standard is implied. Outstanding across open deals:{' '}
        <a href={paths.module('deals')} className="hover:text-copper transition-colors">
          {formatMoney(metrics.outstandingBalance)}
        </a>
        .
      </p>
    </div>
  );
}
