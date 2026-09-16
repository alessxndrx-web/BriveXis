import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { EASE } from '../../lib/motion';
import { AppChrome } from './AppChrome';

const moduleLabels = [
  'Customers',
  'Leads',
  'Sales',
  'Orders',
  'Inventory',
  'Operations',
  'Reporting',
];

/** Sidebar module the workflow belongs to. */
const ORDERS_INDEX = 3;

const tabs = ['Pipeline', 'Records', 'Automations'];

const stages = [
  { label: 'Intake', automated: true, width: 'w-16' },
  { label: 'Qualification', automated: false, width: 'w-24' },
  { label: 'Order', automated: false, width: 'w-14' },
  { label: 'Fulfillment', automated: true, width: 'w-20' },
  { label: 'Invoice', automated: false, width: 'w-12' },
];

/** Stage the pipeline rests on once the sequence finishes. */
const RESTING_STAGE = 2;

const records = [
  { widths: ['w-20', 'w-12'], status: 'Open' },
  { widths: ['w-16', 'w-14'], status: 'In review' },
  { widths: ['w-24', 'w-10'], status: 'Scheduled' },
];

/**
 * Phases of the one-time introduction:
 *   0        module highlight lands on Orders
 *   1..5     the copper state walks the five workflow stages
 *   6        settled — the static interface the visitor keeps looking at
 */
const SETTLED_PHASE = stages.length + 1;
const PHASE_MS = 320;
const FIRST_PHASE_DELAY = 260;

export function SystemPanel() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px 0px' });

  // Reduced motion skips straight to the settled interface.
  const [phase, setPhase] = useState(reduceMotion ? SETTLED_PHASE : -1);

  useEffect(() => {
    if (reduceMotion) {
      setPhase(SETTLED_PHASE);
      return;
    }
    if (!inView) return;

    const timers = Array.from({ length: SETTLED_PHASE + 1 }, (_, next) =>
      window.setTimeout(() => setPhase(next), FIRST_PHASE_DELAY + next * PHASE_MS),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [inView, reduceMotion]);

  const settled = phase >= SETTLED_PHASE;
  const activeStage = settled ? RESTING_STAGE : phase - 1;
  const ordersActive = phase >= 0;

  const modules = moduleLabels.map((label, i) => ({
    label,
    active: i === ORDERS_INDEX && ordersActive,
  }));

  return (
    <div ref={ref}>
      <AppChrome
        appName="Operations Workspace"
        modules={modules}
        tone="dark"
        status={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-copper" />
              Single source of record
            </span>
            <span className="hidden sm:inline text-muted-dark/60">Role-based access</span>
          </span>
        }
      >
        {/* Tab row */}
        <div className="flex items-center gap-5 border-b border-dark-border px-4 sm:px-5">
          {tabs.map((tab, i) => (
            <span
              key={tab}
              className={`relative py-3 text-ui ${
                i === 0 ? 'text-white-surface' : 'text-muted-dark/70'
              }`}
            >
              {tab}
              {i === 0 && <span className="absolute inset-x-0 -bottom-px h-[2px] bg-copper" />}
            </span>
          ))}
        </div>

        {/* Workflow pipeline */}
        <div className="px-4 sm:px-5 py-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-eyebrow uppercase text-muted-dark/70">Order workflow</span>
            <span className="text-ui text-muted-dark/60">5 stages</span>
          </div>

          <div className="relative pl-5">
            {/* Connector spine */}
            <motion.span
              className="absolute left-[3px] top-2 bottom-2 w-px bg-dark-border origin-top"
              initial={reduceMotion ? false : { scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
            />

            <ul className="space-y-3.5">
              {stages.map((stage, i) => {
                const isActive = i === activeStage;
                return (
                  <li key={stage.label} className="relative flex items-center gap-3">
                    <span
                      className={`absolute -left-5 w-[7px] h-[7px] rounded-full border transition-colors duration-200 ${
                        isActive
                          ? 'bg-copper border-copper'
                          : 'bg-[#0D1015] border-muted-dark/40'
                      }`}
                    />
                    <span
                      className={`text-ui transition-colors duration-200 ${
                        isActive ? 'text-white-surface' : 'text-muted-dark'
                      }`}
                    >
                      {stage.label}
                    </span>
                    <span className={`h-[3px] rounded-[1px] bg-dark-border ${stage.width}`} />
                    {stage.automated && (
                      <span className="ml-auto shrink-0 rounded-[2px] border border-dark-border px-1.5 py-0.5 text-[0.75rem] text-muted-dark/80">
                        Auto
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Record structure */}
        <div className="border-t border-dark-border px-4 sm:px-5 py-4">
          <div className="grid grid-cols-[1fr_auto] gap-3 pb-2.5 mb-1 border-b border-dark-border text-[0.75rem] uppercase tracking-[0.14em] text-muted-dark/60">
            <span>Linked records</span>
            <span>Status</span>
          </div>
          <ul>
            {records.map((record) => (
              <li
                key={record.status}
                className="grid grid-cols-[1fr_auto] items-center gap-3 py-2.5 border-b border-dark-border/60 last:border-b-0"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`h-[5px] rounded-[1px] bg-dark-border ${record.widths[0]}`} />
                  <span
                    className={`h-[5px] rounded-[1px] bg-dark-border/60 ${record.widths[1]}`}
                  />
                </span>
                <span className="text-[0.75rem] text-muted-dark/80 whitespace-nowrap">
                  {record.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </AppChrome>
    </div>
  );
}
