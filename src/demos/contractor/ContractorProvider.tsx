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
import type { ContractorState, DemoRole } from './contractor.types';
import { buildSeedState, seedToday } from './contractor.seed';
import { contractorReducer, type ContractorAction } from './contractor.reducer';
import {
  createLocalRepository,
  type ContractorRepository,
} from './contractor.storage';

/**
 * Workspace context.
 *
 * Holds the reducer, the persistence wiring and the small pieces of session
 * state that are deliberately not persisted (the demo role, toasts). Screens
 * read state through `useContractor` and never see the repository.
 */

export interface Toast {
  id: number;
  message: string;
  tone: 'default' | 'success' | 'warning';
}

interface ContractorContextValue {
  state: ContractorState;
  dispatch: (action: ContractorAction) => void;
  role: DemoRole;
  setRole: (role: DemoRole) => void;
  toasts: Toast[];
  notify: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
  resetDemo: () => void;
  /** Set when stored data had to be discarded, so the UI can say so once. */
  recoveryNotice: string | null;
  clearRecoveryNotice: () => void;
}

const ContractorContext = createContext<ContractorContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
  /** Overridable so tests can supply an in-memory repository. */
  repository?: ContractorRepository;
}

/** Reads storage once during the initial render, falling back to the seed. */
function initialize(repository: ContractorRepository): {
  state: ContractorState;
  notice: string | null;
} {
  const outcome = repository.load();

  if (outcome.status === 'loaded') {
    return { state: outcome.state, notice: null };
  }

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

export function ContractorProvider({ children, repository }: ProviderProps) {
  // The repository is created once. Recreating it per render would re-run the
  // storage availability probe on every keystroke.
  const repo = useMemo(() => repository ?? createLocalRepository(), [repository]);

  const bootstrap = useRef<{ state: ContractorState; notice: string | null } | null>(null);
  if (!bootstrap.current) bootstrap.current = initialize(repo);

  const [state, dispatch] = useReducer(contractorReducer, bootstrap.current.state);
  const [role, setRole] = useState<DemoRole>('owner');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(
    bootstrap.current.notice,
  );

  // Persist after paint rather than during the reducer, so a storage write can
  // never slow down or break a state transition.
  useEffect(() => {
    repo.save(state);
  }, [repo, state]);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: Toast['tone'] = 'default') => {
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

  return <ContractorContext.Provider value={value}>{children}</ContractorContext.Provider>;
}

export function useContractor(): ContractorContextValue {
  const value = useContext(ContractorContext);
  if (!value) throw new Error('useContractor must be used inside <ContractorProvider>.');
  return value;
}

/** Convenience read for the many components that only need the workspace. */
export function useWorkspace(): ContractorState {
  return useContractor().state;
}
