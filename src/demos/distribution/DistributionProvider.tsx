import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createLocalRepository, type DistributionRepository } from './distribution.storage';
import { buildSeedState, seedToday } from './distribution.seed';
import { distributionReducer, type Command } from './distribution.reducer';
import { createId } from './distribution.utils';
import type { DistributionState } from './distribution.types';
import type { DemoRole } from './distribution.routes';
import type { ToastMessage, ToastTone } from '../shared/ui/Toasts';

/**
 * Workspace context.
 *
 * Holds the reducer, the persistence wiring and the session-only state — the
 * demo role and the toasts, neither of which is worth persisting.
 *
 * `execute` is the single way anything is written. It runs the command against
 * the latest committed state before dispatching, which does two things: it
 * surfaces a domain rule violation as a message instead of an exception, and it
 * makes a double click a no-op rather than a second posting.
 */

interface DistributionContextValue {
  state: DistributionState;
  /** Runs a command. Returns null on success, or the reason it was refused. */
  execute: (command: Command, id?: string) => string | null;
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

const DistributionContext = createContext<DistributionContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
  /** Overridable so tests can supply an in-memory repository. */
  repository?: DistributionRepository;
}

function initialize(repository: DistributionRepository): {
  state: DistributionState;
  notice: string | null;
} {
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

export function DistributionProvider({ children, repository }: ProviderProps) {
  // Created once: recreating it per render would re-run the storage probe on
  // every keystroke.
  const repo = useMemo(() => repository ?? createLocalRepository(), [repository]);

  const bootstrap = useRef<{ state: DistributionState; notice: string | null } | null>(null);
  if (!bootstrap.current) bootstrap.current = initialize(repo);

  const [state, dispatch] = useReducer(distributionReducer, bootstrap.current.state);
  const [role, setRole] = useState<DemoRole>('owner');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(bootstrap.current.notice);

  // Mirrors the committed state so `execute` can pre-flight against the newest
  // value even when React has not re-rendered yet.
  const committed = useRef(state);
  useEffect(() => {
    committed.current = state;
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

  const execute = useCallback(
    (command: Command, id = createId('op')): string | null => {
      const action = { ...command, id, at: new Date().toISOString() } as Parameters<
        typeof distributionReducer
      >[1];

      try {
        const next = distributionReducer(committed.current, action);
        if (next === committed.current) {
          // Either the operation was already posted, or it changed nothing.
          return 'That operation has already been posted.';
        }
        committed.current = next;
        dispatch(action);
        return null;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'The operation could not be completed.';
        notify(message, 'warning');
        return message;
      }
    },
    [notify],
  );

  const resetDemo = useCallback(() => {
    const seeded = buildSeedState(seedToday());
    committed.current = seeded;
    repo.clear();
    dispatch({ type: 'reset' });
    setRole('owner');
  }, [repo]);

  const clearRecoveryNotice = useCallback(() => setRecoveryNotice(null), []);

  const value = useMemo(
    () => ({
      state,
      execute,
      role,
      setRole,
      toasts,
      notify,
      dismissToast,
      resetDemo,
      recoveryNotice,
      clearRecoveryNotice,
    }),
    [state, execute, role, toasts, notify, dismissToast, resetDemo, recoveryNotice, clearRecoveryNotice],
  );

  return <DistributionContext.Provider value={value}>{children}</DistributionContext.Provider>;
}

export function useDistribution(): DistributionContextValue {
  const value = useContext(DistributionContext);
  if (!value) throw new Error('useDistribution must be used inside <DistributionProvider>.');
  return value;
}

/** Convenience read for the many components that only need the workspace. */
export function useWorkspace(): DistributionState {
  return useDistribution().state;
}

/**
 * Runs a command and reports the outcome through a toast.
 *
 * Every screen wants the same thing after a write: confirm it, or say why it
 * was refused. Doing that here keeps the message consistent and stops each
 * caller inventing its own wording.
 */
export function useCommand() {
  const { execute, notify } = useDistribution();

  return useCallback(
    (command: Command, success: string): string | null => {
      const failure = execute(command);
      if (!failure) notify(success, 'success');
      return failure;
    },
    [execute, notify],
  );
}
