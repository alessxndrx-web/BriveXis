import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { useRouter } from '../../../lib/router';
import { paths } from '../contractor.routes';
import { LeadForm } from '../forms/LeadForm';
import { CustomerForm } from '../forms/CustomerForm';
import { JobForm } from '../forms/JobForms';

/**
 * Quick Create menu.
 *
 * Every option opens something that works — there are no placeholder entries.
 * Built on the menu button pattern: arrows move between items, Escape closes
 * and returns focus to the trigger.
 */

type Target = 'lead' | 'customer' | 'estimate' | 'job';

const OPTIONS: { id: Target; label: string; hint: string }[] = [
  { id: 'lead', label: 'Lead', hint: 'New opportunity' },
  { id: 'customer', label: 'Customer', hint: 'With a service location' },
  { id: 'estimate', label: 'Estimate', hint: 'Open the estimate editor' },
  { id: 'job', label: 'Job', hint: 'Unscheduled job' },
];

export function QuickCreate() {
  const { navigate } = useRouter();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<Target | null>(null);
  const [cursor, setCursor] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !triggerRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    items?.[cursor]?.focus();
  }, [open, cursor]);

  const choose = (target: Target) => {
    setOpen(false);
    if (target === 'estimate') {
      navigate(paths.estimateNew());
      return;
    }
    setDialog(target);
  };

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setCursor(0);
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setCursor(0);
            setOpen(true);
          }
        }}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 bg-ivory text-midnight rounded-[2px] text-[0.8125rem] font-semibold transition-colors hover:bg-white-surface"
      >
        <Plus size={14} aria-hidden="true" />
        <span className="hidden sm:inline">Create</span>
        <ChevronDown size={13} aria-hidden="true" className="opacity-60" />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Quick create"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              close();
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              setCursor((current) => (current + 1) % OPTIONS.length);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setCursor((current) => (current - 1 + OPTIONS.length) % OPTIONS.length);
            }
          }}
          className="absolute right-0 top-full mt-1 z-40 w-56 bg-app-panel border border-app-border-strong rounded-[3px] shadow-xl py-1"
        >
          {OPTIONS.map((option) => (
            <button
              key={option.id}
              role="menuitem"
              type="button"
              tabIndex={-1}
              onClick={() => choose(option.id)}
              className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-app-hover focus:bg-app-hover focus:outline-none"
            >
              <span className="text-[0.875rem] text-charcoal">{option.label}</span>
              <span className="text-[0.75rem] text-muted">{option.hint}</span>
            </button>
          ))}
        </div>
      )}

      <LeadForm open={dialog === 'lead'} onClose={() => setDialog(null)} />
      <CustomerForm open={dialog === 'customer'} onClose={() => setDialog(null)} />
      <JobForm open={dialog === 'job'} onClose={() => setDialog(null)} />
    </div>
  );
}
