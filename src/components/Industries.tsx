import { useRef, useState, KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Container } from './ui/Container';
import { SectionHeader } from './ui/SectionHeader';
import { DURATION, EASE } from '../lib/motion';
import { WorkflowChain } from './ui/WorkflowChain';
import { track } from '../lib/analytics';

interface Industry {
  id: string;
  name: string;
  summary: string;
  workflow: string[];
  centralizes: { label: string; detail: string }[];
}

const industries: Industry[] = [
  {
    id: 'contractors',
    name: 'Contractors & Field Services',
    summary:
      'Work is won in the office and executed in the field, so job information usually ends up split between estimates, messages and paper records.',
    workflow: ['Leads', 'Estimates', 'Jobs', 'Crews', 'Invoices', 'Follow-up'],
    centralizes: [
      { label: 'Estimates', detail: 'Quotes tied to the job they belong to.' },
      { label: 'Scheduling', detail: 'Crew assignment and job calendars in one view.' },
      { label: 'Field records', detail: 'Completion notes captured where the work happens.' },
      { label: 'Invoicing', detail: 'Billing that follows the job, not a spreadsheet.' },
    ],
  },
  {
    id: 'dealers',
    name: 'Dealers & Automotive Businesses',
    summary:
      'Inventory and customer interest change daily, and the two rarely live in the same place, which is where reservations and follow-ups get lost.',
    workflow: ['Inventory', 'Leads', 'Customers', 'Reservations', 'Sales'],
    centralizes: [
      { label: 'Unit records', detail: 'Each unit with its own status and history.' },
      { label: 'Lead routing', detail: 'Inquiries connected to the unit requested.' },
      { label: 'Reservations', detail: 'Holds and commitments visible to the whole team.' },
      { label: 'Sales closing', detail: 'Documentation and handover inside one flow.' },
    ],
  },
  {
    id: 'distribution',
    name: 'Distribution & Wholesale',
    summary:
      'Purchasing, stock and customer orders depend on each other, so a single unreliable number affects every step downstream.',
    workflow: ['Purchasing', 'Inventory', 'Orders', 'Customers', 'Reporting'],
    centralizes: [
      { label: 'Purchasing', detail: 'Supplier orders linked to incoming stock.' },
      { label: 'Stock control', detail: 'Movements recorded as they happen.' },
      { label: 'Order fulfillment', detail: 'Customer orders checked against real stock.' },
      { label: 'Reporting', detail: 'Operational reporting without manual assembly.' },
    ],
  },
];

export function Industries() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const reduceMotion = useReducedMotion();
  const industry = industries[active];

  const select = (index: number) => {
    setActive(index);
    track('industry_select', { industry: industries[index].id });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const directions: Record<string, number> = {
      ArrowDown: 1,
      ArrowRight: 1,
      ArrowUp: -1,
      ArrowLeft: -1,
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const next = (active + direction + industries.length) % industries.length;
    select(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section
      id="industries"
      aria-labelledby="industries-title"
      className="bg-white-surface border-y border-light-border py-20 sm:py-24 lg:py-32"
    >
      <Container>
        <SectionHeader
          index="04"
          eyebrow="Industries"
          titleId="industries-title"
          title="Three operations we know in depth."
          lead="We build for businesses where the work itself is operational, and where scheduling, stock and customer commitments have to stay in sync."
          className="mb-14 lg:mb-20"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-14">
          <div
            role="tablist"
            aria-orientation="vertical"
            aria-label="Priority industries"
            className="lg:col-span-4 border-t border-light-border"
          >
            {industries.map((item, i) => {
              const selected = i === active;
              return (
                <button
                  key={item.id}
                  ref={(node) => {
                    tabRefs.current[i] = node;
                  }}
                  role="tab"
                  id={`industry-tab-${item.id}`}
                  aria-selected={selected}
                  aria-controls={`industry-panel-${item.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => select(i)}
                  onKeyDown={handleKeyDown}
                  className={`relative w-full text-left border-b border-light-border py-5 pl-5 pr-4 transition-colors ${
                    selected ? 'bg-ivory' : 'hover:bg-ivory/60'
                  }`}
                >
                  {selected && (
                    <motion.span
                      aria-hidden="true"
                      layoutId={reduceMotion ? undefined : 'industry-marker'}
                      transition={{ duration: DURATION.medium, ease: EASE }}
                      className="absolute left-0 top-0 bottom-0 w-[2px] bg-copper"
                    />
                  )}
                  <span className="flex items-baseline gap-3">
                    <span
                      className={`text-ui font-semibold tabular-nums ${
                        selected ? 'text-copper' : 'text-muted/70'
                      }`}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={`font-heading font-semibold text-[1.125rem] sm:text-[1.25rem] ${
                        selected ? 'text-charcoal' : 'text-muted'
                      }`}
                    >
                      {item.name}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-8">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={industry.id}
                role="tabpanel"
                id={`industry-panel-${industry.id}`}
                aria-labelledby={`industry-tab-${industry.id}`}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.26, ease: EASE } }}
                exit={reduceMotion ? {} : { opacity: 0, y: 4, transition: { duration: 0.18 } }}
                className="h-full border border-light-border rounded-[4px] bg-ivory p-6 sm:p-8 lg:p-10"
              >
                <p className="text-lead text-charcoal/85 max-w-[56ch]">{industry.summary}</p>

                <div className="mt-8">
                  <h3 className="text-eyebrow uppercase text-muted mb-4">Typical workflow</h3>
                  <WorkflowChain steps={industry.workflow} animate />
                </div>

                <div className="mt-9 pt-8 border-t border-light-border">
                  <h3 className="text-eyebrow uppercase text-muted mb-5">
                    What the system centralizes
                  </h3>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5">
                    {industry.centralizes.map((item) => (
                      <div key={item.label} className="flex gap-3">
                        <span
                          aria-hidden="true"
                          className="mt-2.5 w-1.5 h-1.5 bg-copper shrink-0"
                        />
                        <div>
                          <dt className="font-semibold text-charcoal text-[0.9375rem]">
                            {item.label}
                          </dt>
                          <dd className="text-ui leading-relaxed text-muted">{item.detail}</dd>
                        </div>
                      </div>
                    ))}
                  </dl>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <p className="mt-10 text-ui text-muted">
          Also adaptable to other operations-heavy businesses.
        </p>
      </Container>
    </section>
  );
}
