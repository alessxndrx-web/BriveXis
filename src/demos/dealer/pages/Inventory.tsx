import { useMemo, useState } from 'react';
import { Car, Plus } from 'lucide-react';
import { useDealer, useWorkspace } from '../DealerProvider';
import { useRouter } from '../../../lib/router';
import { paths } from '../dealer.routes';
import type { Vehicle } from '../dealer.types';
import { VEHICLE_STATUSES, VEHICLE_TYPES } from '../dealer.types';
import {
  activeReservationForVehicle,
  activityFor,
  canSeeCost,
  checkVehicleAvailability,
  committedDealForVehicle,
  closedDealForVehicle,
  daysInStock,
  getCustomer,
  vehicleInterestLeads,
} from '../dealer.selectors';
import {
  formatDate,
  formatMileage,
  formatMoney,
  matches,
  vehicleTitle,
  vinSuffix,
} from '../dealer.utils';
import { track } from '../../../lib/analytics';
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
  Tabs,
  TextInput,
  Toolbar,
} from '../../shared/ui/AppUI';
import { CellMeta, CodeCell, DataTable, type Column } from '../../shared/ui/DataTable';
import { VehicleStatusBadge, vehicleAccent } from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import { LeadStageBadge, ReservationStatusBadge, DealStatusBadge } from '../components/StatusBadge';
import { MarkUnavailableDialog, VehicleForm } from '../forms/WorkspaceForms';
import { ReservationForm } from '../forms/ReservationForms';
import { DealForm } from '../forms/DealForms';

/**
 * Inventory.
 *
 * The list is the screen a dealership lives in, so it stays dense and
 * filterable. A vehicle's availability is never stored as a flag — it is asked
 * of the records that constrain it, which is what keeps the lot honest.
 */

const ALL = 'all';

export function InventoryPage() {
  const state = useWorkspace();
  const { role } = useDealer();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>(ALL);
  const [type, setType] = useState<string>(ALL);
  const [make, setMake] = useState<string>(ALL);
  const [location, setLocation] = useState<string>(ALL);
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [formOpen, setFormOpen] = useState(false);

  const makes = useMemo(
    () => Array.from(new Set(state.vehicles.map((vehicle) => vehicle.make))).sort(),
    [state.vehicles],
  );

  const rows = useMemo(
    () =>
      state.vehicles.filter((vehicle) => {
        if (status !== ALL && vehicle.status !== status) return false;
        if (type !== ALL && vehicle.type !== type) return false;
        if (make !== ALL && vehicle.make !== make) return false;
        if (location !== ALL && vehicle.locationId !== location) return false;
        if (maxPrice && vehicle.listPrice > Number(maxPrice) * 100) return false;
        return matches(query, vehicle.code, vehicle.vin, vehicleTitle(vehicle), vehicle.exteriorColor);
      }),
    [state.vehicles, status, type, make, location, maxPrice, query],
  );

  const filtered = status !== ALL || type !== ALL || make !== ALL || location !== ALL || maxPrice || query;

  const clear = () => {
    setQuery('');
    setStatus(ALL);
    setType(ALL);
    setMake(ALL);
    setLocation(ALL);
    setMaxPrice('');
  };

  const columns: Column<Vehicle>[] = [
    {
      key: 'vehicle',
      header: 'Vehicle',
      sortValue: (vehicle) => vehicleTitle(vehicle),
      cell: (vehicle) => (
        <>
          <span className="font-medium text-charcoal">{vehicleTitle(vehicle)}</span>
          <CellMeta>
            <CodeCell>{vehicle.code}</CodeCell> · VIN …{vinSuffix(vehicle.vin)}
          </CellMeta>
        </>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      width: 'w-28',
      hideBelow: 'md',
      sortValue: (vehicle) => vehicle.type,
      cell: (vehicle) => <span className="text-muted">{vehicle.type}</span>,
    },
    {
      key: 'mileage',
      header: 'Mileage',
      width: 'w-28',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (vehicle) => vehicle.mileage,
      cell: (vehicle) => <span className="tabular-nums text-muted">{formatMileage(vehicle.mileage)}</span>,
    },
    {
      key: 'price',
      header: 'Price',
      width: 'w-28',
      align: 'right',
      sortValue: (vehicle) => vehicle.listPrice,
      cell: (vehicle) => (
        <span className="tabular-nums text-charcoal">{formatMoney(vehicle.listPrice)}</span>
      ),
    },
    {
      key: 'age',
      header: 'Days',
      width: 'w-20',
      align: 'right',
      hideBelow: 'lg',
      sortValue: (vehicle) => daysInStock(vehicle),
      cell: (vehicle) => (
        <span className="tabular-nums text-muted">
          {vehicle.status === 'Sold' ? '—' : daysInStock(vehicle)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 'w-36',
      sortValue: (vehicle) => vehicle.status,
      cell: (vehicle) => <VehicleStatusBadge status={vehicle.status} />,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory"
        description={`${state.vehicles.length} units across ${state.locations.length} locations.`}
        actions={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <Plus size={14} aria-hidden="true" />
            Add vehicle
          </Button>
        }
      />

      <Panel>
        <Toolbar>
          <div className="w-full sm:w-64">
            <label htmlFor="inventory-search" className="sr-only">
              Search inventory
            </label>
            <TextInput
              id="inventory-search"
              type="search"
              placeholder="Stock number, VIN, model…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <InlineField label="Status" htmlFor="inventory-status">
            <Select
              id="inventory-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All</option>
              {VEHICLE_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </InlineField>

          <InlineField label="Type" htmlFor="inventory-type">
            <Select
              id="inventory-type"
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All</option>
              {VEHICLE_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </InlineField>

          <InlineField label="Make" htmlFor="inventory-make">
            <Select
              id="inventory-make"
              value={make}
              onChange={(event) => setMake(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All</option>
              {makes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </InlineField>

          <InlineField label="Location" htmlFor="inventory-location">
            <Select
              id="inventory-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All</option>
              {state.locations.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </InlineField>

          <InlineField label="Max price" htmlFor="inventory-max-price">
            <TextInput
              id="inventory-max-price"
              type="number"
              min="0"
              step="1000"
              placeholder="Any"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              className="w-28 text-right tabular-nums"
            />
          </InlineField>

          {filtered && (
            <Button size="sm" onClick={clear}>
              Clear filters
            </Button>
          )}

          <span className="ml-auto text-[0.75rem] text-muted tabular-nums">
            {rows.length} of {state.vehicles.length}
          </span>
        </Toolbar>

        <DataTable
          caption="Vehicle inventory"
          columns={columns}
          rows={rows}
          rowKey={(vehicle) => vehicle.id}
          rowHref={(vehicle) => paths.vehicle(vehicle.id)}
          defaultSort={{ key: 'age', direction: 'desc' }}
          empty={
            <EmptyState
              title="No vehicles match these filters."
              description="Widen the search or clear the filters to see the whole lot."
              action={<Button onClick={clear}>Clear filters</Button>}
            />
          }
        />
      </Panel>

      {!canSeeCost(role) && (
        <p className="text-[0.75rem] text-muted">
          Acquisition cost is hidden for the {role.replace('_', ' ')} role.
        </p>
      )}

      <VehicleForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

// ------------------------------------------------------------ vehicle detail

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'specs', label: 'Specifications' },
  { id: 'interest', label: 'Customer interest' },
  { id: 'activity', label: 'Activity' },
];

export function VehicleDetail({ vehicleId }: { vehicleId: string }) {
  const state = useWorkspace();
  const { role, dispatch, notify } = useDealer();
  const { navigate } = useRouter();
  const [tab, setTab] = useState('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [unavailableOpen, setUnavailableOpen] = useState(false);

  const vehicle = state.vehicles.find((entry) => entry.id === vehicleId);

  if (!vehicle) {
    return (
      <EmptyState
        title="That vehicle is not in this workspace"
        description="It may have been removed, or the link is out of date."
        action={<LinkButton href={paths.module('inventory')}>Back to inventory</LinkButton>}
      />
    );
  }

  const availability = checkVehicleAvailability(state, vehicle.id);
  const hold = activeReservationForVehicle(state, vehicle.id);
  const committed = committedDealForVehicle(state, vehicle.id);
  const sold = closedDealForVehicle(state, vehicle.id);
  const deal = sold ?? committed;
  const interested = vehicleInterestLeads(state, vehicle.id);
  const events = activityFor(state, { kind: 'vehicle', id: vehicle.id });
  const location = state.locations.find((entry) => entry.id === vehicle.locationId);

  const interestTab = TABS.map((entry) =>
    entry.id === 'interest' ? { ...entry, count: interested.length } : entry,
  );

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <a href={paths.module('inventory')} className="hover:text-copper transition-colors">
            Inventory
          </a>
        }
        title={vehicleTitle(vehicle)}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <VehicleStatusBadge status={vehicle.status} />
            <span className="text-muted">
              {vehicle.code} · VIN {vehicle.vin} · {location?.name}
            </span>
          </span>
        }
        actions={
          <>
            <Button onClick={() => setEditOpen(true)}>Edit</Button>
            {availability.available && (
              <>
                <Button onClick={() => setUnavailableOpen(true)}>Mark unavailable</Button>
                <Button onClick={() => setDealOpen(true)}>Start deal</Button>
                <Button variant="primary" onClick={() => setReserveOpen(true)}>
                  Reserve
                </Button>
              </>
            )}
            {vehicle.status === 'Service Hold' && (
              <Button
                onClick={() => {
                  dispatch({ type: 'vehicle/status', id: vehicle.id, status: 'In Stock' });
                  notify(`${vehicle.code} is back in stock.`, 'success');
                }}
              >
                Return to stock
              </Button>
            )}
            {vehicle.status === 'Unavailable' && (
              <Button
                variant="primary"
                onClick={() => {
                  dispatch({ type: 'vehicle/status', id: vehicle.id, status: 'In Stock' });
                  notify(`${vehicle.code} is back in stock.`, 'success');
                }}
              >
                Return to stock
              </Button>
            )}
            {hold && <LinkButton href={paths.reservation(hold.id)}>View {hold.code}</LinkButton>}
            {deal && (
              <LinkButton variant="primary" href={paths.deal(deal.id)}>
                View {deal.code}
              </LinkButton>
            )}
          </>
        }
      />

      {!availability.available && (
        <p className="border border-app-border bg-app-panel rounded-[3px] px-3.5 py-2.5 text-[0.8125rem] text-muted">
          {availability.reason}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          <Panel>
            <Tabs tabs={interestTab} active={tab} onChange={setTab} label="Vehicle sections" />

            {tab === 'overview' && (
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Detail label="List price">
                  <span className="tabular-nums">{formatMoney(vehicle.listPrice)}</span>
                </Detail>
                {canSeeCost(role) && (
                  <Detail label="Acquisition cost">
                    <span className="tabular-nums">{formatMoney(vehicle.acquisitionCost)}</span>
                  </Detail>
                )}
                <Detail label="Condition">{vehicle.condition}</Detail>
                <Detail label="Mileage">{formatMileage(vehicle.mileage)}</Detail>
                <Detail label="Body type">{vehicle.type}</Detail>
                <Detail label="Drivetrain">
                  {vehicle.transmission} · {vehicle.fuelType}
                </Detail>
                <Detail label="Colour">
                  {vehicle.exteriorColor}
                  <span className="block text-[0.75rem] text-muted">
                    {vehicle.interiorColor} interior
                  </span>
                </Detail>
                <Detail label="Location">{location?.name ?? '—'}</Detail>
                <Detail label="Acquired">{formatDate(vehicle.acquiredAt)}</Detail>
                <Detail label="Days in stock">
                  {vehicle.status === 'Sold' ? '—' : daysInStock(vehicle)}
                </Detail>
                <Detail label="Interest">
                  {interested.length === 0
                    ? 'No leads yet'
                    : `${interested.length} ${interested.length === 1 ? 'lead' : 'leads'}`}
                </Detail>
                {vehicle.soldAt && <Detail label="Sold">{formatDate(vehicle.soldAt)}</Detail>}
                {vehicle.notes && (
                  <div className="col-span-2 sm:col-span-3">
                    <Detail label="Notes">{vehicle.notes}</Detail>
                  </div>
                )}
              </div>
            )}

            {tab === 'specs' && (
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Detail label="Year">{vehicle.year}</Detail>
                <Detail label="Make">{vehicle.make}</Detail>
                <Detail label="Model">{vehicle.model}</Detail>
                <Detail label="Trim">{vehicle.trim ?? '—'}</Detail>
                <Detail label="Body type">{vehicle.type}</Detail>
                <Detail label="Transmission">{vehicle.transmission}</Detail>
                <Detail label="Fuel">{vehicle.fuelType}</Detail>
                <Detail label="Exterior">{vehicle.exteriorColor}</Detail>
                <Detail label="Interior">{vehicle.interiorColor}</Detail>
                <div className="col-span-2 sm:col-span-3">
                  <Detail label="VIN">
                    <span className="font-mono text-[0.8125rem]">{vehicle.vin}</span>
                    <span className="ml-2 text-[0.75rem] text-muted">
                      Demonstration identifier — does not decode to a real vehicle.
                    </span>
                  </Detail>
                </div>
              </div>
            )}

            {tab === 'interest' && (
              <div className="p-4">
                {interested.length === 0 ? (
                  <EmptyState
                    title="No recorded interest"
                    description="Leads who ask about this vehicle appear here."
                  />
                ) : (
                  <ul className="divide-y divide-app-border -my-2">
                    {interested.map((lead) => (
                      <li key={lead.id} className="py-2.5">
                        <a
                          href={paths.lead(lead.id)}
                          className="flex flex-wrap items-baseline justify-between gap-2 hover:text-copper transition-colors"
                        >
                          <span className="text-[0.875rem] text-charcoal">{lead.name}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-[0.75rem] text-muted">{lead.code}</span>
                            <LeadStageBadge stage={lead.stage} />
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === 'activity' && (
              <div className="p-4">
                <Timeline events={events} emptyMessage="Nothing has happened to this vehicle yet." />
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Holds and deals" as="h3" />
            <div className="p-4 space-y-3">
              {hold ? (
                <a
                  href={paths.reservation(hold.id)}
                  className={`block border-l-2 ${vehicleAccent.Reserved} border border-app-border rounded-[2px] px-3 py-2.5 transition-colors hover:bg-app-bg`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[0.875rem] text-charcoal">{hold.code}</span>
                    <ReservationStatusBadge status={hold.status} />
                  </div>
                  <p className="mt-0.5 text-[0.75rem] text-muted">
                    {getCustomer(state, hold.customerId)?.name} · expires {formatDate(hold.expiresAt)}
                  </p>
                </a>
              ) : (
                <p className="text-[0.8125rem] text-muted">No active hold.</p>
              )}

              {deal ? (
                <a
                  href={paths.deal(deal.id)}
                  className="block border border-app-border rounded-[2px] px-3 py-2.5 transition-colors hover:bg-app-bg"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[0.875rem] text-charcoal">{deal.code}</span>
                    <DealStatusBadge status={deal.status} />
                  </div>
                  <p className="mt-0.5 text-[0.75rem] text-muted">
                    {getCustomer(state, deal.customerId)?.name}
                  </p>
                </a>
              ) : (
                <p className="text-[0.8125rem] text-muted">No deal on this vehicle.</p>
              )}
            </div>
          </Panel>

          {/* A tasteful no-photo state, rather than a stock image of a car that
              is not this car. */}
          <Panel>
            <PanelHeader title="Photos" as="h3" />
            <div className="px-4 py-8 text-center">
              <Car size={26} strokeWidth={1.4} aria-hidden="true" className="mx-auto text-muted" />
              <p className="mt-2 text-[0.8125rem] text-muted">
                No photos on file for this unit.
              </p>
              <p className="mt-1 text-[0.75rem] text-muted">
                Photography is uploaded per vehicle in a live system.
              </p>
            </div>
          </Panel>
        </div>
      </div>

      <VehicleForm open={editOpen} onClose={() => setEditOpen(false)} vehicleId={vehicle.id} />
      <ReservationForm
        open={reserveOpen}
        onClose={() => setReserveOpen(false)}
        vehicleId={vehicle.id}
        onCreated={(id) => {
          track('vehicle_viewed', { action: 'reserved' });
          navigate(paths.reservation(id));
        }}
      />
      <DealForm
        open={dealOpen}
        onClose={() => setDealOpen(false)}
        vehicleId={vehicle.id}
        onCreated={(id) => navigate(paths.deal(id))}
      />
      <MarkUnavailableDialog
        open={unavailableOpen}
        onClose={() => setUnavailableOpen(false)}
        vehicleId={vehicle.id}
      />
    </div>
  );
}
