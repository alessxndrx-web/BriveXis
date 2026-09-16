import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useDealer, useWorkspace } from '../DealerProvider';
import { paths } from '../dealer.routes';
import type { DocumentRecord, Payment, Task } from '../dealer.types';
import { DOCUMENT_STATUSES, DOCUMENT_TYPES, PAYMENT_KINDS, PAYMENT_METHODS } from '../dealer.types';
import { getCustomer, getDeal, getVehicle, salespersonName } from '../dealer.selectors';
import {
  formatDate,
  formatMoney,
  formatRelativeDay,
  matches,
  vehicleTitle,
} from '../dealer.utils';
import {
  Button,
  EmptyState,
  InlineField,
  PageHeader,
  Panel,
  Select,
  TextInput,
  Toolbar,
} from '../../shared/ui/AppUI';
import { CellMeta, CodeCell, DataTable, type Column } from '../../shared/ui/DataTable';
import { DocumentStatusBadge, PaymentKindBadge } from '../components/StatusBadge';
import { TaskForm } from '../forms/WorkspaceForms';

/**
 * Payments, documents and tasks.
 *
 * Three cross-cutting lists that all read from the same records the detail
 * screens use, rather than keeping their own copies.
 */

const ALL = 'all';

// ---------------------------------------------------------------- payments

export function PaymentsPage() {
  const state = useWorkspace();
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState<string>(ALL);
  const [kind, setKind] = useState<string>(ALL);

  const rows = useMemo(
    () =>
      state.payments.filter((payment) => {
        if (method !== ALL && payment.method !== method) return false;
        if (kind !== ALL && payment.kind !== kind) return false;
        const customer = getCustomer(state, payment.customerId);
        return matches(query, payment.code, customer?.name, payment.reference);
      }),
    [state, query, method, kind],
  );

  const total = rows.reduce((sum, payment) => sum + payment.amount, 0);

  const columns: Column<Payment>[] = [
    {
      key: 'payment',
      header: 'Payment',
      sortValue: (payment) => payment.code,
      cell: (payment) => {
        const customer = getCustomer(state, payment.customerId);
        return (
          <>
            <span className="font-medium text-charcoal">{customer?.name ?? 'Unknown'}</span>
            <CellMeta>
              <CodeCell>{payment.code}</CodeCell>
              {payment.reference && ` · ${payment.reference}`}
            </CellMeta>
          </>
        );
      },
    },
    {
      key: 'kind',
      header: 'Type',
      width: 'w-44',
      sortValue: (payment) => payment.kind,
      cell: (payment) => <PaymentKindBadge kind={payment.kind} />,
    },
    {
      key: 'linked',
      header: 'Applied to',
      hideBelow: 'md',
      sortValue: (payment) => payment.dealId ?? payment.reservationId ?? '',
      cell: (payment) => {
        const deal = getDeal(state, payment.dealId);
        if (deal) {
          return (
            <a href={paths.deal(deal.id)} className="text-charcoal hover:text-copper transition-colors">
              {deal.code}
            </a>
          );
        }
        const reservation = state.reservations.find((entry) => entry.id === payment.reservationId);
        return reservation ? (
          <a
            href={paths.reservation(reservation.id)}
            className="text-charcoal hover:text-copper transition-colors"
          >
            {reservation.code}
          </a>
        ) : (
          <span className="text-muted">—</span>
        );
      },
    },
    {
      key: 'method',
      header: 'Method',
      width: 'w-28',
      hideBelow: 'lg',
      sortValue: (payment) => payment.method,
      cell: (payment) => <span className="text-muted">{payment.method}</span>,
    },
    {
      key: 'received',
      header: 'Received',
      width: 'w-32',
      hideBelow: 'sm',
      sortValue: (payment) => payment.receivedAt,
      cell: (payment) => <span className="text-muted">{formatDate(payment.receivedAt)}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      width: 'w-32',
      align: 'right',
      sortValue: (payment) => payment.amount,
      cell: (payment) => (
        <span className={`tabular-nums ${payment.amount < 0 ? 'text-app-warning' : 'text-charcoal'}`}>
          {formatMoney(payment.amount)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payments"
        description="Money recorded against reservations and deals. Demo only — no real transaction is processed."
      />

      <Panel>
        <Toolbar>
          <div className="w-full sm:w-56">
            <label htmlFor="payment-search" className="sr-only">
              Search payments
            </label>
            <TextInput
              id="payment-search"
              type="search"
              placeholder="Payment, customer, reference…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <InlineField label="Type" htmlFor="payment-kind">
            <Select
              id="payment-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All</option>
              {PAYMENT_KINDS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </InlineField>

          <InlineField label="Method" htmlFor="payment-method">
            <Select
              id="payment-method"
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All</option>
              {PAYMENT_METHODS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </InlineField>

          {(query || method !== ALL || kind !== ALL) && (
            <Button
              size="sm"
              onClick={() => {
                setQuery('');
                setMethod(ALL);
                setKind(ALL);
              }}
            >
              Clear filters
            </Button>
          )}

          <span className="ml-auto text-[0.75rem] text-muted tabular-nums">
            {rows.length} payments · {formatMoney(total)}
          </span>
        </Toolbar>

        <DataTable
          caption="Payments"
          columns={columns}
          rows={rows}
          rowKey={(payment) => payment.id}
          defaultSort={{ key: 'received', direction: 'desc' }}
          empty={
            <EmptyState
              title="No payments match these filters."
              action={
                <Button
                  onClick={() => {
                    setQuery('');
                    setMethod(ALL);
                    setKind(ALL);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          }
        />
      </Panel>

      <p className="text-[0.75rem] text-muted">
        Payments are recorded after the fact. No card details are collected anywhere in this demo
        and nothing is charged.
      </p>
    </div>
  );
}

// --------------------------------------------------------------- documents

export function DocumentsPage() {
  const state = useWorkspace();
  const { dispatch } = useDealer();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>(ALL);
  const [type, setType] = useState<string>(ALL);

  const rows = useMemo(
    () =>
      state.documents.filter((document) => {
        if (status !== ALL && document.status !== status) return false;
        if (type !== ALL && document.type !== type) return false;
        const customer = getCustomer(state, document.customerId);
        return matches(query, document.code, document.type, customer?.name, document.fileLabel);
      }),
    [state, query, status, type],
  );

  const columns: Column<DocumentRecord>[] = [
    {
      key: 'document',
      header: 'Document',
      sortValue: (document) => document.type,
      cell: (document) => (
        <>
          <span className="font-medium text-charcoal">{document.type}</span>
          <CellMeta>
            <CodeCell>{document.code}</CodeCell>
            {document.fileLabel && ` · ${document.fileLabel}`}
          </CellMeta>
        </>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      hideBelow: 'md',
      sortValue: (document) => getCustomer(state, document.customerId)?.name ?? '',
      cell: (document) => {
        const customer = getCustomer(state, document.customerId);
        return customer ? (
          <a
            href={paths.customer(customer.id)}
            className="text-charcoal hover:text-copper transition-colors"
          >
            {customer.name}
          </a>
        ) : (
          <span className="text-muted">—</span>
        );
      },
    },
    {
      key: 'linked',
      header: 'Deal',
      width: 'w-28',
      hideBelow: 'lg',
      sortValue: (document) => getDeal(state, document.dealId)?.code ?? '',
      cell: (document) => {
        const deal = getDeal(state, document.dealId);
        return deal ? (
          <a href={paths.deal(deal.id)} className="text-charcoal hover:text-copper transition-colors">
            {deal.code}
          </a>
        ) : (
          <span className="text-muted">—</span>
        );
      },
    },
    {
      key: 'received',
      header: 'Received',
      width: 'w-32',
      hideBelow: 'sm',
      sortValue: (document) => document.receivedAt ?? '0000',
      cell: (document) => (
        <span className="text-muted">
          {document.receivedAt ? formatDate(document.receivedAt) : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 'w-52',
      sortValue: (document) => document.status,
      cell: (document) => (
        <span className="flex items-center gap-2">
          <DocumentStatusBadge status={document.status} />
          <Select
            id={`doc-status-${document.id}`}
            aria-label={`Status for ${document.type}`}
            value={document.status}
            className="w-auto"
            onChange={(event) =>
              dispatch({
                type: 'document/status',
                id: document.id,
                status: event.target.value as DocumentRecord['status'],
              })
            }
          >
            {DOCUMENT_STATUSES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Documents"
        description="What has been requested and what has come back. Only names and statuses are recorded — no file is uploaded or stored."
      />

      <Panel>
        <Toolbar>
          <div className="w-full sm:w-56">
            <label htmlFor="document-search" className="sr-only">
              Search documents
            </label>
            <TextInput
              id="document-search"
              type="search"
              placeholder="Document, customer…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <InlineField label="Type" htmlFor="document-type-filter">
            <Select
              id="document-type-filter"
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All</option>
              {DOCUMENT_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </InlineField>

          <InlineField label="Status" htmlFor="document-status-filter">
            <Select
              id="document-status-filter"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>All</option>
              {DOCUMENT_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </InlineField>

          {(query || status !== ALL || type !== ALL) && (
            <Button
              size="sm"
              onClick={() => {
                setQuery('');
                setStatus(ALL);
                setType(ALL);
              }}
            >
              Clear filters
            </Button>
          )}

          <span className="ml-auto text-[0.75rem] text-muted tabular-nums">
            {rows.length} of {state.documents.length}
          </span>
        </Toolbar>

        <DataTable
          caption="Documents"
          columns={columns}
          rows={rows}
          rowKey={(document) => document.id}
          defaultSort={{ key: 'status', direction: 'asc' }}
          empty={
            <EmptyState
              title="No documents match these filters."
              action={
                <Button
                  onClick={() => {
                    setQuery('');
                    setStatus(ALL);
                    setType(ALL);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          }
        />
      </Panel>

      <p className="text-[0.75rem] text-muted">
        BriveXis does not verify the authenticity of any document and this demo makes no such
        claim.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------- tasks

export function TasksPage() {
  const state = useWorkspace();
  const { dispatch } = useDealer();
  const [query, setQuery] = useState('');
  const [assignee, setAssignee] = useState<string>(ALL);
  const [showDone, setShowDone] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const rows = useMemo(
    () =>
      state.tasks.filter((task) => {
        if (!showDone && task.done) return false;
        if (assignee !== ALL && task.assigneeId !== assignee) return false;
        return matches(query, task.title, task.kind, task.code);
      }),
    [state.tasks, query, assignee, showDone],
  );

  const columns: Column<Task>[] = [
    {
      key: 'done',
      header: <span className="sr-only">Done</span>,
      width: 'w-10',
      cell: (task) => (
        <input
          type="checkbox"
          id={`task-${task.id}`}
          checked={task.done}
          aria-label={`Mark "${task.title}" ${task.done ? 'not done' : 'done'}`}
          onChange={() => dispatch({ type: 'task/toggle', id: task.id })}
          className="h-3.5 w-3.5 accent-[var(--color-copper)]"
        />
      ),
    },
    {
      key: 'task',
      header: 'Task',
      sortValue: (task) => task.title,
      cell: (task) => (
        <>
          <span className={task.done ? 'text-muted line-through' : 'font-medium text-charcoal'}>
            {task.title}
          </span>
          <CellMeta>
            <CodeCell>{task.code}</CodeCell> · {task.kind}
          </CellMeta>
        </>
      ),
    },
    {
      key: 'linked',
      header: 'Related to',
      hideBelow: 'md',
      cell: (task) => {
        const deal = getDeal(state, task.dealId);
        const customer = getCustomer(state, task.customerId);
        const vehicle = getVehicle(state, task.vehicleId);
        const lead = state.leads.find((entry) => entry.id === task.leadId);

        if (deal) return <Linked href={paths.deal(deal.id)} label={deal.code} />;
        if (lead) return <Linked href={paths.lead(lead.id)} label={lead.code} />;
        if (customer) return <Linked href={paths.customer(customer.id)} label={customer.name} />;
        if (vehicle) return <Linked href={paths.vehicle(vehicle.id)} label={vehicleTitle(vehicle)} />;
        return <span className="text-muted">—</span>;
      },
    },
    {
      key: 'assignee',
      header: 'Assigned to',
      width: 'w-40',
      hideBelow: 'lg',
      sortValue: (task) => salespersonName(state, task.assigneeId),
      cell: (task) => <span className="text-muted">{salespersonName(state, task.assigneeId)}</span>,
    },
    {
      key: 'due',
      header: 'Due',
      width: 'w-32',
      sortValue: (task) => task.dueAt,
      cell: (task) => <span className="text-muted">{formatRelativeDay(task.dueAt)}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tasks"
        description="Follow-ups that keep leads, reservations and paperwork moving."
        actions={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <Plus size={14} aria-hidden="true" />
            New task
          </Button>
        }
      />

      <Panel>
        <Toolbar>
          <div className="w-full sm:w-56">
            <label htmlFor="task-search" className="sr-only">
              Search tasks
            </label>
            <TextInput
              id="task-search"
              type="search"
              placeholder="Task, type…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <InlineField label="Assigned to" htmlFor="task-assignee-filter">
            <Select
              id="task-assignee-filter"
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
              className="w-auto"
            >
              <option value={ALL}>Anyone</option>
              {state.salespeople.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
          </InlineField>

          <Button
            size="sm"
            variant={showDone ? 'primary' : 'secondary'}
            onClick={() => setShowDone((value) => !value)}
          >
            Show completed
          </Button>

          {(query || assignee !== ALL || showDone) && (
            <Button
              size="sm"
              onClick={() => {
                setQuery('');
                setAssignee(ALL);
                setShowDone(false);
              }}
            >
              Clear filters
            </Button>
          )}

          <span className="ml-auto text-[0.75rem] text-muted tabular-nums">
            {rows.length} shown
          </span>
        </Toolbar>

        <DataTable
          caption="Tasks"
          columns={columns}
          rows={rows}
          rowKey={(task) => task.id}
          defaultSort={{ key: 'due', direction: 'asc' }}
          empty={
            <EmptyState
              title="No tasks match these filters."
              description="Everything assigned here is done, or the filters are too narrow."
              action={
                <Button
                  onClick={() => {
                    setQuery('');
                    setAssignee(ALL);
                    setShowDone(false);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          }
        />
      </Panel>

      <TaskForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

function Linked({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="text-charcoal hover:text-copper transition-colors">
      {label}
    </a>
  );
}
