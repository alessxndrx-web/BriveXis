import { ArrowRight } from 'lucide-react';
import { Reveal } from '../ui/Reveal';

/** Each row maps information that lives in a disconnected tool today to the module that owns it in a connected system. */
const mapping = [
  { source: 'Spreadsheet', information: 'Customer list', module: 'CRM', offset: 'sm:ml-0' },
  { source: 'WhatsApp', information: 'Order updates', module: 'Orders', offset: 'sm:ml-8' },
  { source: 'Legacy software', information: 'Stock counts', module: 'Inventory', offset: 'sm:ml-3' },
  { source: 'Email', information: 'Approvals', module: 'Workflows', offset: 'sm:ml-10' },
  { source: 'Paper', information: 'Job records', module: 'Reporting', offset: 'sm:ml-5' },
];

export function OperationShift() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-8 lg:gap-6 xl:gap-10 items-center">
      {/* Current reality */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <span className="text-eyebrow uppercase text-muted">Current reality</span>
          <span aria-hidden="true" className="h-px flex-1 bg-light-border" />
        </div>

        <ul className="space-y-3">
          {mapping.map((row) => (
            <li
              key={row.source}
              className={`${row.offset} flex items-baseline justify-between gap-4 border border-dashed border-muted/35 bg-white-surface rounded-[2px] px-4 py-3`}
            >
              <span className="font-medium text-charcoal">{row.source}</span>
              <span className="text-ui text-muted text-right">{row.information}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Transition marker */}
      <div className="flex lg:flex-col items-center justify-center gap-3" aria-hidden="true">
        <span className="hidden lg:block w-px flex-1 bg-light-border" />
        <span className="h-px flex-1 bg-light-border lg:hidden" />
        <span className="flex items-center justify-center w-10 h-10 rounded-[2px] border border-copper/40 text-copper shrink-0">
          <ArrowRight size={18} strokeWidth={1.75} className="rotate-90 lg:rotate-0" />
        </span>
        <span className="hidden lg:block w-px flex-1 bg-light-border" />
        <span className="h-px flex-1 bg-light-border lg:hidden" />
      </div>

      {/* Connected operation */}
      <Reveal y={10}>
        <div className="rounded-[10px] bg-midnight border border-dark-border p-5 sm:p-7">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-eyebrow uppercase text-copper-highlight">
              Connected operation
            </span>
            <span aria-hidden="true" className="h-px flex-1 bg-dark-border" />
          </div>

          <ul className="relative pl-5">
            <span
              aria-hidden="true"
              className="absolute left-[3px] top-3 bottom-3 w-px bg-copper/45"
            />
            {mapping.map((row) => (
              <li
                key={row.module}
                className="relative flex items-baseline justify-between gap-4 py-3 border-b border-dark-border last:border-b-0"
              >
                <span
                  aria-hidden="true"
                  className="absolute -left-5 top-[1.15rem] w-[7px] h-[7px] rounded-full bg-copper"
                />
                <span className="font-medium text-white-surface">{row.module}</span>
                <span className="text-ui text-muted-dark text-right">{row.information}</span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </div>
  );
}
