import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import type { DealerState, DemoRole } from './dealer.types';
import { buildSeedState, seedToday } from './dealer.seed';
import { dealerReducer, type DealerAction } from './dealer.reducer';
import { createLocalRepository, type DealerRepository } from './dealer.storage';
import type { ToastMessage, ToastTone } from '../shared/ui/Toasts';

/**
 * Workspace context.
 *
 * Holds the reducer, the persistence wiring and the small pieces of session
 * state that are deliberately not persisted — the demo role and the toasts. A
 * demo role is a view, not an identity, so it starts fresh on every visit.
 */

interface DealerContextValue {
  state: DealerState;
  dispatch: (action: DealerAction) => void;
  role: DemoRole;
  setRole: (role: DemoRole) => void;
  toasts: ToastMessage[];
  notify: (message: string, tone?: ToastTone) => void;
  dismissToast: (id: number) => void;
  resetDemo: () => void;
  /** Set when stored data had to be discarded, so the UI can say so once. */
  recoveryNotice: string | null;
  clearRecoveryNotice: () => void;
}

const DealerContext = createContext<DealerContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
  /** Overridable so tests can supply an in-memory repository. */
  repository?: DealerRepository;
}

function initialize(repository: DealerRepository): { state: DealerState; notice: string | null } {
  const outcome = repository.load();

  if (outcome.status === 'loaded') return { state: outcome.state, notice: null };

  const state = buildSeedState(seedToday());
  if (outcome.status === 'reset') {
    return {
      state,
      notice: `${outcome.reason} The workspace has been restored to its starting data.`,
    };
  }
  return { state, notice: null };
}

let toastSequence = 0;

export function DealerProvider({ children, repository }: ProviderProps) {
  // Created once: recreating it per render would re-run the storage probe on
  // every keystroke.
  const repo = useMemo(() => repository ?? createLocalRepository(), [repository]);

  const bootstrap = useRef<{ state: DealerState; notice: string | null } | null>(null);
  if (!bootstrap.current) bootstrap.current = initialize(repo);

  const [state, dispatch] = useReducer(dealerReducer, bootstrap.current.state);
  const [role, setRole] = useState<DemoRole>('owner');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(bootstrap.current.notice);

  // Persist after paint rather than during the reducer, so a storage write can
  // never slow down or break a state transition.
  useEffect(() => {
    repo.save(state);
  }, [repo, state]);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: ToastTone = 'default') => {
      toastSequence += 1;
      const id = toastSequence;
      setToasts((current) => [...current, { id, message, tone }]);
      window.setTimeout(() => dismissToast(id), 5000);
    },
    [dismissToast],
  );

  const resetDemo = useCallback(() => {
    repo.clear();
    dispatch({ type: 'demo/reset' });
    setRole('owner');
  }, [repo]);

  const clearRecoveryNotice = useCallback(() => setRecoveryNotice(null), []);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      role,
      setRole,
      toasts,
      notify,
      dismissToast,
      resetDemo,
      recoveryNotice,
      clearRecoveryNotice,
    }),
    [state, role, toasts, notify, dismissToast, resetDemo, recoveryNotice, clearRecoveryNotice],
  );

  return <DealerContext.Provider value={value}>{children}</DealerContext.Provider>;
}

export function useDealer(): DealerContextValue {
  const value = useContext(DealerContext);
  if (!value) throw new Error('useDealer must be used inside <DealerProvider>.');
  return value;
}

/** Convenience read for the many components that only need the workspace. */
export function useWorkspace(): DealerState {
  return useDealer().state;
}
