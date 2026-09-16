import { AppChrome } from './AppChrome';
import type { DemoProduct } from '../../data/demos';

interface DemoPreviewFrameProps {
  demo: DemoProduct;
  className?: string;
}

const skeleton = 'rounded-[1px] bg-light-border';

function BoardBody({ labels }: { labels: string[] }) {
  return (
    <div className="grid grid-cols-3 divide-x divide-light-border">
      {labels.slice(0, 3).map((label, column) => (
        <div key={label} className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`w-1.5 h-1.5 rounded-full ${column === 1 ? 'bg-copper' : 'bg-light-border'}`}
            />
            <span className="text-[0.75rem] uppercase tracking-[0.12em] text-muted truncate">
              {label}
            </span>
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 - column }).map((_, card) => (
              <div
                key={card}
                className="rounded-[2px] border border-light-border bg-white-surface p-2.5 space-y-1.5"
              >
                <span className={`block h-[5px] w-full ${skeleton}`} />
                <span className={`block h-[5px] w-2/3 ${skeleton} opacity-60`} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TableBody({ labels }: { labels: string[] }) {
  return (
    <div className="p-3 sm:p-4">
      <div className="grid grid-cols-4 gap-3 border-b border-light-border pb-2.5">
        {labels.slice(0, 4).map((label) => (
          <span
            key={label}
            className="text-[0.75rem] uppercase tracking-[0.12em] text-muted truncate"
          >
            {label}
          </span>
        ))}
      </div>
      {['w-4/5', 'w-3/5', 'w-full', 'w-2/3', 'w-3/4'].map((width, row) => (
        <div
          key={width}
          className="grid grid-cols-4 items-center gap-3 border-b border-light-border/70 py-3 last:border-b-0"
        >
          <span className={`h-[5px] ${width} ${skeleton}`} />
          <span className={`h-[5px] w-3/4 ${skeleton} opacity-70`} />
          <span className={`h-[5px] w-1/2 ${skeleton} opacity-70`} />
          <span className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${row === 1 ? 'bg-copper' : 'bg-light-border'}`}
            />
            <span className={`h-[5px] w-8 ${skeleton} opacity-70`} />
          </span>
        </div>
      ))}
    </div>
  );
}

function RecordBody({ labels }: { labels: string[] }) {
  return (
    <div className="p-3 sm:p-4">
      <div className="rounded-[2px] border border-light-border bg-white-surface">
        {labels.map((label, row) => (
          <div
            key={label}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3 border-b border-light-border px-3 py-3 last:border-b-0"
          >
            <span className="text-[0.75rem] uppercase tracking-[0.12em] text-muted truncate">
              {label}
            </span>
            {row === 1 ? (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-copper" />
                <span className={`h-[5px] w-16 ${skeleton}`} />
              </span>
            ) : (
              <span className={`h-[5px] ${row % 2 === 0 ? 'w-2/3' : 'w-1/2'} ${skeleton}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Structural preview of a future demo environment: application chrome, module
 * navigation and screen structure. It intentionally contains no business data.
 */
export function DemoPreviewFrame({ demo, className = '' }: DemoPreviewFrameProps) {
  const { preview } = demo;

  return (
    <AppChrome
      appName={demo.title}
      tone="light"
      className={className}
      modules={demo.modules.map((label, i) => ({ label, active: i === 0 }))}
      status={
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-copper" />
          Interface structure — no live data
        </span>
      }
    >
      <div className="flex items-center justify-between gap-3 border-b border-light-border px-4 py-2.5">
        <span className="text-ui font-medium text-charcoal truncate">{preview.screen}</span>
        <span className="flex gap-1.5 shrink-0">
          <span className="h-5 w-10 rounded-[2px] border border-light-border" />
          <span className="h-5 w-14 rounded-[2px] border border-light-border" />
        </span>
      </div>

      {preview.variant === 'board' && <BoardBody labels={preview.labels} />}
      {preview.variant === 'table' && <TableBody labels={preview.labels} />}
      {preview.variant === 'record' && <RecordBody labels={preview.labels} />}
    </AppChrome>
  );
}
