import { type ReactNode } from 'react';
import { DataTable, type Column, type SortState } from '../../shared/ui/DataTable';
import { EmptyState, Panel, PanelHeader } from '../../shared/ui/AppUI';

/**
 * Record lists.
 *
 * A distributor's screens are tables, and a table crushed into a phone is
 * unusable — so below the table breakpoint the same rows render as stacked
 * cards instead. It is the same data and the same columns; only the shape
 * changes. This is what makes a picking or receiving list workable in a
 * warehouse aisle.
 */

interface RecordsProps<T> {
  rows: T[];
  columns: Column<T>[];
  /** Accessible name for the table. */
  caption: string;
  rowKey?: (row: T) => string;
  href?: (row: T) => string;
  defaultSort?: SortState;
  empty?: ReactNode;
  /** Columns to omit from the mobile card, e.g. one already used as the title. */
  cardSkip?: string[];
  /** Renders the card heading. Defaults to the first column's cell. */
  cardTitle?: (row: T) => ReactNode;
}

export function Records<T extends { id: string }>({
  rows,
  columns,
  caption,
  rowKey = (row) => row.id,
  href,
  defaultSort,
  empty,
  cardSkip = [],
  cardTitle,
}: RecordsProps<T>) {
  if (rows.length === 0) {
    return <>{empty ?? <EmptyState title="No records to display." />}</>;
  }

  const cardColumns = columns.filter((column) => !cardSkip.includes(column.key));

  return (
    <>
      <div className="hidden md:block">
        <DataTable
          caption={caption}
          rows={rows}
          columns={columns}
          rowKey={rowKey}
          rowHref={href}
          defaultSort={defaultSort}
        />
      </div>

      <ul className="md:hidden divide-y divide-app-border">
        {rows.map((row) => (
          <li key={rowKey(row)} className="px-3.5 py-3">
            <div className="mb-2 text-[0.9375rem] font-medium text-charcoal">
              {cardTitle ? cardTitle(row) : columns[0].cell(row)}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              {cardColumns.map((column) => (
                <div key={column.key} className="min-w-0">
                  <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted">
                    {column.header}
                  </dt>
                  <dd className="mt-0.5 text-[0.8125rem] text-charcoal break-words">
                    {column.cell(row)}
                  </dd>
                </div>
              ))}
            </dl>
            {href && (
              <a
                href={href(row)}
                className="mt-2.5 inline-block text-[0.8125rem] text-copper hover:underline"
              >
                Open record
              </a>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Panel wrapper used by every detail screen section. */
export function Section({
  title,
  meta,
  actions,
  children,
  padded = true,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Off for a section whose body is a table that supplies its own padding. */
  padded?: boolean;
}) {
  return (
    <Panel>
      <PanelHeader title={title} meta={meta} actions={actions} as="h2" />
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </Panel>
  );
}

/** Right-aligned number, used everywhere quantities and money appear. */
export const Num = ({ children, tone }: { children: ReactNode; tone?: 'muted' | 'danger' }) => (
  <span
    className={`tabular-nums ${
      tone === 'muted' ? 'text-muted' : tone === 'danger' ? 'text-app-danger' : 'text-charcoal'
    }`}
  >
    {children}
  </span>
);

/**
 * The three numbers that describe a stock position.
 *
 * They appear together everywhere because they only make sense together:
 * available is what can still be promised, and it is on hand minus what is
 * already committed to somebody else.
 */
export function StockFigures({
  onHand,
  allocated,
  available,
}: {
  onHand: number;
  allocated: number;
  available: number;
}) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[0.8125rem]">
      <span className="tabular-nums text-charcoal">{onHand} on hand</span>
      <span className="tabular-nums text-muted">{allocated} allocated</span>
      <span
        className={`tabular-nums font-medium ${available <= 0 ? 'text-app-danger' : 'text-charcoal'}`}
      >
        {available} available
      </span>
    </span>
  );
}
