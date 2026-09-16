import { ReactNode, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

/**
 * Sortable data table.
 *
 * Sorting is real: a column declares how to extract its sort value and the
 * table orders rows by it. A header that cannot sort renders no control, so
 * there are never indicators that do nothing.
 *
 * The table scrolls inside its own container rather than widening the page.
 * Columns can opt out of narrow screens with `hideBelow`, but only ones whose
 * information is repeated elsewhere in the row — nothing critical is hidden.
 */

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Cell renderer. */
  cell: (row: T) => ReactNode;
  /** Return a comparable value to make this column sortable. */
  sortValue?: (row: T) => string | number;
  /** Tailwind width utility, e.g. `w-28`. */
  width?: string;
  align?: 'left' | 'right';
  /** Hide the column below this breakpoint. Only for redundant information. */
  hideBelow?: 'sm' | 'md' | 'lg';
}

export interface SortState {
  key: string;
  direction: 'asc' | 'desc';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Makes the whole row a link to this destination. */
  rowHref?: (row: T) => string;
  /** Accessible name for the table. */
  caption: string;
  defaultSort?: SortState;
  empty?: ReactNode;
  className?: string;
}

const hideClasses = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  caption,
  defaultSort,
  empty,
  className = '',
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | undefined>(defaultSort);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((candidate) => candidate.key === sort.key);
    if (!column?.sortValue) return rows;

    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = column.sortValue!(a);
      const right = column.sortValue!(b);
      if (typeof left === 'number' && typeof right === 'number') {
        return (left - right) * direction;
      }
      return String(left).localeCompare(String(right)) * direction;
    });
  }, [rows, columns, sort]);

  const toggle = (key: string) => {
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
  };

  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full min-w-[42rem] border-collapse text-[0.875rem]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-app-border">
            {columns.map((column) => {
              const sortable = Boolean(column.sortValue);
              const isSorted = sort?.key === column.key;
              const ariaSort = isSorted
                ? sort!.direction === 'asc'
                  ? 'ascending'
                  : 'descending'
                : sortable
                  ? 'none'
                  : undefined;

              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={`${column.width ?? ''} ${
                    column.hideBelow ? hideClasses[column.hideBelow] : ''
                  } ${
                    column.align === 'right' ? 'text-right' : 'text-left'
                  } px-3 py-2 font-semibold text-[0.6875rem] uppercase tracking-[0.08em] text-muted whitespace-nowrap`}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggle(column.key)}
                      className={`group inline-flex items-center gap-1 transition-colors hover:text-charcoal ${
                        column.align === 'right' ? 'flex-row-reverse' : ''
                      }`}
                    >
                      {column.header}
                      {isSorted ? (
                        sort!.direction === 'asc' ? (
                          <ArrowUp size={12} aria-hidden="true" className="text-copper" />
                        ) : (
                          <ArrowDown size={12} aria-hidden="true" className="text-copper" />
                        )
                      ) : (
                        <ChevronsUpDown
                          size={12}
                          aria-hidden="true"
                          className="opacity-0 transition-opacity group-hover:opacity-50"
                        />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const href = rowHref?.(row);
            return (
              <tr
                key={rowKey(row)}
                className="border-b border-app-border/70 last:border-b-0 transition-colors hover:bg-app-hover"
              >
                {columns.map((column, index) => {
                  const content = column.cell(row);
                  return (
                    <td
                      key={column.key}
                      className={`${column.hideBelow ? hideClasses[column.hideBelow] : ''} ${
                        column.align === 'right' ? 'text-right' : 'text-left'
                      } px-3 py-2 align-middle text-charcoal`}
                    >
                      {/* The first cell carries the row link, so the row is
                          reachable with one tab stop instead of one per cell. */}
                      {href && index === 0 ? (
                        <a
                          href={href}
                          className="font-medium text-charcoal hover:text-copper transition-colors"
                        >
                          {content}
                        </a>
                      ) : (
                        content
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Secondary line inside a table cell, for context that does not deserve a column. */
export function CellMeta({ children }: { children: ReactNode }) {
  return <span className="block text-[0.75rem] text-muted truncate">{children}</span>;
}

/** Monospaced-feeling record code. */
export function CodeCell({ children }: { children: ReactNode }) {
  return <span className="tabular-nums text-[0.8125rem]">{children}</span>;
}
