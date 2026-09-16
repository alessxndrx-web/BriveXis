import { useState } from 'react';
import { Plus } from 'lucide-react';
import { track } from '../../../lib/analytics';
import { useCommand, useWorkspace } from '../DistributionProvider';
import { paths } from '../distribution.routes';
import type { Transfer } from '../distribution.types';
import { getProduct, getWarehouse, stock } from '../distribution.selectors';
import { formatDate, matches } from '../distribution.utils';
import {
  Button,
  EmptyState,
  InlineField,
  Metric,
  PageHeader,
  Panel,
  Select,
  TextInput,
  Toolbar,
} from '../../shared/ui/AppUI';
import { type Column } from '../../shared/ui/DataTable';
import { Num, Records } from '../components/DataViews';
import { TransferStatusBadge } from '../components/StatusBadge';
import { TransferForm } from '../forms/LogisticsForms';

/**
 * Warehouse transfers.
 *
 * A transfer is two movements with a gap in the middle. Shipping it takes the
 * units out of the source; receiving it puts them into the destination. While
 * a transfer is in transit the units are in neither warehouse's on-hand figure
 * — deliberately, because counting them in both is how a distributor ends up
 * promising stock that is sitting on a truck.
 */

const ALL = 'all';
const STATUSES: Transfer['status'][] = ['Draft', 'In Transit', 'Received', 'Cancelled'];

export function TransfersPage() {
  const state = useWorkspace();
  const run = useCommand();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);

  const rows = state.transfers.filter((transfer) => {
    if (status !== ALL && transfer.status !== status) return false;
    return matches(
      query,
      transfer.code,
      transfer.note,
      getProduct(state, transfer.productId)?.sku,
      getProduct(state, transfer.productId)?.name,
      getWarehouse(state, transfer.from)?.name,
      getWarehouse(state, transfer.to)?.name,
    );
  });

  const inTransit = state.transfers.filter((transfer) => transfer.status === 'In Transit');

  const columns: Column<Transfer>[] = [
    {
      key: 'transfer',
      header: 'Transfer',
      sortValue: (transfer) => transfer.code,
      cell: (transfer) => {
        const product = getProduct(state, transfer.productId);
        return (
          <>
            <span className="font-medium text-charcoal">{transfer.code}</span>
            <span className="mt-0.5 block text-[0.75rem] text-muted">
              {product?.sku} — {product?.name}
            </span>
          </>
        );
      },
    },
    {
      key: 'route',
      header: 'Route',
      width: 'w-40',
      cell: (transfer) => (
        <span className="text-muted">
          {getWarehouse(state, transfer.from)?.short} → {getWarehouse(state, transfer.to)?.short}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: 'Units',
      width: 'w-20',
      align: 'right',
      sortValue: (transfer) => transfer.quantity,
      cell: (transfer) => <Num>{transfer.quantity}</Num>,
    },
    {
      key: 'date',
      header: 'Date',
      width: 'w-32',
      hideBelow: 'md',
      sortValue: (transfer) => transfer.date,
      cell: (transfer) => <span className="text-muted">{formatDate(transfer.date)}</span>,
    },
    {
      key: 'note',
      header: 'Note',
      hideBelow: 'lg',
      cell: (transfer) => <span className="text-muted">{transfer.note || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: 'w-28',
      sortValue: (transfer) => transfer.status,
      cell: (transfer) => <TransferStatusBadge status={transfer.status} />,
    },
    {
      key: 'actions',
      header: 'Action',
      width: 'w-52',
      cell: (transfer) => {
        const source = stock(state, transfer.productId, transfer.from);
        return (
          <span className="flex flex-wrap gap-1.5">
            {transfer.status === 'Draft' && (
              <>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={transfer.quantity > source.available}
                  onClick={() =>
                    run(
                      { type: 'transfer/ship', transferId: transfer.id },
                      `${transfer.code} shipped. The units left ${getWarehouse(state, transfer.from)?.short} and are in transit.`,
                    )
                  }
                >
                  Ship
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    run({ type: 'transfer/cancel', transferId: transfer.id }, `${transfer.code} cancelled.`)
                  }
                >
                  Cancel
                </Button>
              </>
            )}

            {transfer.status === 'In Transit' && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  const failure = run(
                    { type: 'transfer/receive', transferId: transfer.id },
                    `${transfer.code} received at ${getWarehouse(state, transfer.to)?.short}.`,
                  );
                  if (!failure) track('inventory_transfer_completed');
                }}
              >
                Receive
              </Button>
            )}

            {transfer.status === 'Received' && (
              <span className="text-[0.75rem] text-muted">Complete</span>
            )}
            {transfer.status === 'Cancelled' && (
              <span className="text-[0.75rem] text-muted">No stock moved</span>
            )}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Transfers"
        description="Moving stock between warehouses. Total inventory never changes — only where it sits."
        actions={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <Plus size={14} aria-hidden="true" />
            New transfer
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Transfers" value={state.transfers.length} />
        <Metric
          label="In transit"
          value={inTransit.length}
          meta={`${inTransit.reduce((sum, transfer) => sum + transfer.quantity, 0)} units`}
          tone={inTransit.length > 0 ? 'warning' : 'default'}
        />
        <Metric
          label="Drafts"
          value={state.transfers.filter((transfer) => transfer.status === 'Draft').length}
          meta="No stock moved yet"
        />
        <Metric
          label="Completed"
          value={state.transfers.filter((transfer) => transfer.status === 'Received').length}
        />
      </div>

      {inTransit.length > 0 && (
        <p className="border border-app-border bg-app-panel rounded-[3px] px-3.5 py-2.5 text-[0.8125rem] text-muted">
          <Num>{inTransit.reduce((sum, transfer) => sum + transfer.quantity, 0)}</Num> units are in
          transit. They have left the source warehouse and have not arrived yet, so they appear in
          neither warehouse's on-hand figure until the transfer is received.
        </p>
      )}

      <Panel>
        <Toolbar>
          <div className="w-full sm:w-64">
            <label htmlFor="transfer-search" className="sr-only">
              Search transfers
            </label>
            <TextInput
              id="transfer-search"
              type="search"
              placeholder="Transfer, product, warehouse…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <InlineField label="Status" htmlFor="transfer-status">
            <Select
              id="transfer-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All</option>
              {STATUSES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </InlineField>

          {(query || status !== ALL) && (
            <Button
              size="sm"
              onClick={() => {
                setQuery('');
                setStatus(ALL);
              }}
            >
              Clear filters
            </Button>
          )}

          <span className="ml-auto text-[0.75rem] text-muted tabular-nums">
            {rows.length} of {state.transfers.length}
          </span>
        </Toolbar>

        <Records
          caption="Warehouse transfers"
          rows={rows}
          columns={columns}
          cardSkip={['transfer']}
          cardTitle={(transfer) => transfer.code}
          defaultSort={{ key: 'date', direction: 'desc' }}
          empty={
            <EmptyState
              title="No transfers yet"
              description="Move stock between warehouses when one location is short and another is long."
              action={
                <Button variant="primary" onClick={() => setFormOpen(true)}>
                  New transfer
                </Button>
              }
            />
          }
        />
      </Panel>

      <p className="text-[0.75rem] text-muted">
        A draft transfer moves nothing. Shipping posts a Transfer Out at{' '}
        <a href={paths.module('inventory')} className="text-copper hover:underline">
          the source warehouse
        </a>
        ; receiving posts a Transfer In at the destination. The two always net to zero.
      </p>

      {formOpen && <TransferForm open onClose={() => setFormOpen(false)} />}
    </div>
  );
}
