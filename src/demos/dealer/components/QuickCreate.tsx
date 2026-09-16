import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { useRouter } from '../../../lib/router';
import { paths } from '../dealer.routes';
import { LeadForm } from '../forms/LeadForm';
import { CustomerForm } from '../forms/CustomerForm';
import { ReservationForm } from '../forms/ReservationForms';
import { DealForm } from '../forms/DealForms';
import { TaskForm } from '../forms/WorkspaceForms';

/**
 * Quick Create menu.
 *
 * Every option opens something that works on its own — there are no entries
 * that lead to a dead end. Built on the menu button pattern: arrows move
 * between items, Escape closes and returns focus to the trigger.
 */

type Target = 'lead' | 'customer' | 'reservation' | 'deal' | 'task';

const OPTIONS: { id: Target; label: string; hint: string }[] = [
  { id: 'lead', label: 'Lead', hint: 'New opportunity' },
  { id: 'customer', label: 'Customer', hint: 'Buyer record' },
  { id: 'reservation', label: 'Reservation', hint: 'Hold a vehicle' },
  { id: 'deal', label: 'Deal', hint: 'Open a sale' },
  { id: 'task', label: 'Task', hint: 'Follow-up' },
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

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const choose = (target: Target) => {
    setOpen(false);
    setDialog(target);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((current) => (current + 1) % OPTIONS.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((current) => (current - 1 + OPTIONS.length) % OPTIONS.length);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(OPTIONS[cursor].id);
    }
  };

  return (
    <>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => {
            setOpen((current) => !current);
            setCursor(0);
          }}
          className="inline-flex items-center gap-1 h-8 px-2.5 bg-copper text-white rounded-[2px] text-[0.8125rem] font-medium transition-colors hover:bg-copper-highlight"
        >
          <Plus size={14} strokeWidth={2.2} aria-hidden="true" />
          <span className="hidden sm:inline">Create</span>
          <ChevronDown size={13} aria-hidden="true" className="hidden sm:inline" />
        </button>

        {open && (
          <div
            ref={menuRef}
            role="menu"
            aria-label="Create a record"
            tabIndex={-1}
            onKeyDown={onKeyDown}
            className="absolute right-0 z-50 mt-1 w-56 border border-app-border bg-app-panel rounded-[3px] shadow-lg py-1"
          >
            {OPTIONS.map((option, index) => (
              <button
                key={option.id}
                type="button"
                role="menuitem"
                onMouseEnter={() => setCursor(index)}
                onClick={() => choose(option.id)}
                className={`flex w-full items-baseline gap-2 px-3 py-2 text-left transition-colors ${
                  index === cursor ? 'bg-app-bg' : ''
                }`}
              >
                <span className="text-[0.875rem] text-charcoal">{option.label}</span>
                <span className="text-[0.75rem] text-muted">{option.hint}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <LeadForm
        open={dialog === 'lead'}
        onClose={() => setDialog(null)}
        onCreated={(id) => navigate(paths.lead(id))}
      />
      <CustomerForm
        open={dialog === 'customer'}
        onClose={() => setDialog(null)}
        onCreated={(id) => navigate(paths.customer(id))}
      />
      <ReservationForm
        open={dialog === 'reservation'}
        onClose={() => setDialog(null)}
        onCreated={(id) => navigate(paths.reservation(id))}
      />
      <DealForm
        open={dialog === 'deal'}
        onClose={() => setDialog(null)}
        onCreated={(id) => navigate(paths.deal(id))}
      />
      <TaskForm open={dialog === 'task'} onClose={() => setDialog(null)} />
    </>
  );
}
