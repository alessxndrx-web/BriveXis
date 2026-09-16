import type { ReactElement } from 'react';
import { Check, Info, TriangleAlert, X } from 'lucide-react';

/**
 * Notification stack.
 *
 * Understated on purpose: an operations tool confirms an action and gets out of
 * the way. The region is a polite live region, so a screen reader announces the
 * confirmation without stealing focus from whatever the user is doing next.
 */

export type ToastTone = 'default' | 'success' | 'warning';

export interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

const ICONS: Record<ToastTone, ReactElement> = {
  default: <Info size={15} aria-hidden="true" className="text-muted-dark shrink-0" />,
  success: <Check size={15} aria-hidden="true" className="text-copper shrink-0" />,
  warning: <TriangleAlert size={15} aria-hidden="true" className="text-app-warning shrink-0" />,
};

interface ToastsProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

export function Toasts({ toasts, onDismiss }: ToastsProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[min(22rem,calc(100vw-2rem))] print:hidden"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-start gap-2.5 border border-app-border bg-app-panel rounded-[3px] px-3.5 py-2.5 shadow-sm"
        >
          {ICONS[toast.tone]}
          <p className="flex-1 text-[0.8125rem] leading-snug text-charcoal">{toast.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
            className="shrink-0 text-muted hover:text-charcoal transition-colors"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
