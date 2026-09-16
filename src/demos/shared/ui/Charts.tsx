import type { Bucket } from '../types';
import { formatMoneyWhole } from '../format';

/**
 * Charts, drawn with plain CSS and SVG.
 *
 * A charting library would add more to the bundle than these few shapes are
 * worth. Each chart also renders its own figures as text, so the information
 * is available without interpreting a bar — which is what makes them readable
 * to a screen reader and in print.
 */

interface BarListProps {
  data: Bucket[];
  /** Shows the money figure instead of the count as the primary value. */
  showAmount?: boolean;
  emptyLabel?: string;
}

/** Horizontal bars. Best for named categories such as stages and sources. */
export function BarList({ data, showAmount = false, emptyLabel = 'No data yet.' }: BarListProps) {
  const max = Math.max(1, ...data.map((bucket) => (showAmount ? (bucket.amount ?? 0) : bucket.value)));

  if (data.every((bucket) => bucket.value === 0)) {
    return <p className="px-4 py-6 text-[0.875rem] text-muted">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-2.5">
      {data.map((bucket) => {
        const magnitude = showAmount ? (bucket.amount ?? 0) : bucket.value;
        const width = (magnitude / max) * 100;
        return (
          <li key={bucket.label}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="text-[0.8125rem] text-charcoal truncate">{bucket.label}</span>
              <span className="text-[0.8125rem] tabular-nums text-muted whitespace-nowrap">
                {showAmount
                  ? formatMoneyWhole(bucket.amount ?? 0)
                  : bucket.value}
                {!showAmount && bucket.amount !== undefined && (
                  <span className="ml-2 text-[0.75rem] text-muted/80">
                    {formatMoneyWhole(bucket.amount)}
                  </span>
                )}
              </span>
            </div>
            <div className="h-1.5 w-full bg-app-border rounded-[1px] overflow-hidden">
              <div
                className="h-full bg-copper/75"
                style={{ width: `${Math.max(magnitude > 0 ? 3 : 0, width)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

interface ColumnChartProps {
  data: Bucket[];
  /** Plots the money figure rather than the count. */
  showAmount?: boolean;
  height?: number;
  caption: string;
}

/** Vertical columns for time series, where order carries meaning. */
export function ColumnChart({ data, showAmount = false, height = 120, caption }: ColumnChartProps) {
  const values = data.map((bucket) => (showAmount ? (bucket.amount ?? 0) : bucket.value));
  const max = Math.max(1, ...values);

  // Bars are sized in pixels, not percentages: the columns are content-sized
  // inside an `items-end` row, and a percentage height against a parent with no
  // definite height resolves to zero — which silently renders an empty chart.
  const LABEL_SPACE = 24;
  const track = Math.max(0, height - LABEL_SPACE);

  return (
    <figure>
      <figcaption className="sr-only">{caption}</figcaption>
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((bucket, index) => {
          const magnitude = values[index];
          const barHeight = magnitude > 0 ? Math.max(3, (magnitude / max) * track) : 2;
          return (
            <div key={bucket.label} className="flex-1 flex flex-col justify-end items-center gap-1">
              <span className="text-[0.6875rem] tabular-nums text-muted">
                {magnitude === 0 ? '' : showAmount ? formatMoneyWhole(magnitude) : magnitude}
              </span>
              <div
                className={`w-full ${magnitude > 0 ? 'bg-copper/70' : 'bg-app-border'}`}
                style={{ height: barHeight }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2">
        {data.map((bucket) => (
          <span
            key={bucket.label}
            className="flex-1 text-center text-[0.6875rem] text-muted truncate"
          >
            {bucket.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

/**
 * Proportional split shown as a single stacked bar plus a legend.
 * Each segment is labelled in the legend, so colour is never the only cue.
 */
export function SplitBar({
  segments,
}: {
  segments: { label: string; value: number; className: string }[];
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  if (total === 0) {
    return <p className="text-[0.875rem] text-muted">No records to compare yet.</p>;
  }

  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-[1px] bg-app-border">
        {segments.map((segment) =>
          segment.value === 0 ? null : (
            <div
              key={segment.label}
              className={segment.className}
              style={{ width: `${(segment.value / total) * 100}%` }}
            />
          ),
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-1.5 text-[0.8125rem]">
            <span aria-hidden="true" className={`w-2 h-2 rounded-[1px] ${segment.className}`} />
            <span className="text-muted">{segment.label}</span>
            <span className="tabular-nums text-charcoal">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
