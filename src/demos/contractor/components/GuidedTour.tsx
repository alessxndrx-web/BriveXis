import { useState } from 'react';
import { X } from 'lucide-react';
import { paths } from '../contractor.routes';
import { Button, IconButton } from './AppUI';

/**
 * Guided tour.
 *
 * A dismissible panel on the overview rather than an overlay that takes the
 * screen over. It points at the five steps of the lifecycle and gets out of
 * the way — a visitor who would rather explore never has to dismiss anything
 * to reach the product.
 */

const STEPS = [
  {
    title: 'Work the lead pipeline',
    detail: 'Leads arrive from referrals, the website and repeat customers. Move one to Qualified.',
    href: paths.module('leads'),
    action: 'Open leads',
  },
  {
    title: 'Build an estimate',
    detail: 'Price labor, materials and permits as line items. Totals and tax are calculated live.',
    href: paths.module('estimates'),
    action: 'Open estimates',
  },
  {
    title: 'Schedule the job',
    detail: 'An accepted estimate becomes a job. Give it a date and assign a crew.',
    href: paths.module('schedule'),
    action: 'Open schedule',
  },
  {
    title: 'Log the field work',
    detail: 'Crews record what was done, hours and materials, then close out the checklist.',
    href: paths.module('jobs'),
    action: 'Open jobs',
  },
  {
    title: 'Invoice and record payment',
    detail: 'Completed jobs bill from the accepted estimate. Payments update the balance everywhere.',
    href: paths.module('invoices'),
    action: 'Open invoices',
  },
];

export function GuidedTour() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border border-app-border bg-app-panel rounded-[3px] px-3.5 py-2.5">
        <p className="text-[0.8125rem] text-muted">
          New here? The five steps below walk the full lifecycle, from lead to payment.
        </p>
        <div className="flex items-center gap-1.5">
          <Button size="sm" onClick={() => setOpen(true)}>
            Start tour
          </Button>
          <IconButton label="Dismiss tour" onClick={() => setDismissed(true)} className="!w-7 !h-7">
            <X size={14} aria-hidden="true" />
          </IconButton>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Guided tour"
      className="border border-app-border bg-app-panel rounded-[3px]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-app-border px-3.5 py-2.5">
        <h2 className="font-heading font-semibold text-[0.9375rem] text-charcoal">
          Lead to payment, in five steps
        </h2>
        <IconButton label="Close tour" onClick={() => setDismissed(true)} className="!w-7 !h-7">
          <X size={14} aria-hidden="true" />
        </IconButton>
      </div>

      <ol className="divide-y divide-app-border">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="flex flex-wrap items-start gap-x-3 gap-y-2 px-3.5 py-2.5"
          >
            <span className="mt-0.5 flex items-center justify-center w-5 h-5 shrink-0 rounded-[2px] border border-copper/40 text-[0.6875rem] font-semibold tabular-nums text-copper">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.875rem] font-medium text-charcoal">{step.title}</span>
              <span className="block text-[0.8125rem] text-muted">{step.detail}</span>
            </span>
            <a
              href={step.href}
              className="shrink-0 text-[0.8125rem] text-muted hover:text-copper transition-colors underline underline-offset-2 decoration-app-border-strong"
            >
              {step.action}
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
