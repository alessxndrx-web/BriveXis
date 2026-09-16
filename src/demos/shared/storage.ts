/**
 * Persistence boundary for the demo applications.
 *
 * Screens never touch `localStorage`. They talk to a `DemoRepository`, which is
 * the seam that lets a demo become a real product later: swapping the local
 * implementation for an HTTP-backed one changes this file and the provider,
 * and nothing else.
 *
 * The stored payload is versioned. A visitor who returns after the model has
 * changed gets a clean re-seed rather than a half-migrated workspace, which is
 * the only safe outcome for demo data nobody needs to keep.
 *
 * `load` is deliberately free of side effects. Clearing unusable data on the
 * way out would mean a second call — React may render a provider more than once
 * before committing it — sees empty storage and reports a clean first visit,
 * swallowing the notice the visitor is owed. Unusable data is simply
 * overwritten by the next `save`.
 */

export type LoadOutcome<TState> =
  /** Nothing stored yet — first visit. */
  | { status: 'empty' }
  /** Stored workspace read back successfully. */
  | { status: 'loaded'; state: TState }
  /**
   * Something was stored but could not be used: unparseable JSON, a different
   * schema version, or a shape that fails validation. The caller re-seeds.
   */
  | { status: 'reset'; reason: string };

export interface DemoRepository<TState> {
  load(): LoadOutcome<TState>;
  save(state: TState): void;
  clear(): void;
}

/**
 * Detects whether storage can actually be used. Private browsing modes and
 * blocked site data make `localStorage` throw on access rather than return
 * null, so every call below is guarded.
 */
export function storageAvailable(): boolean {
  try {
    const probe = '__brivexis_demo_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export interface LocalRepositoryOptions<TState> {
  /** Storage key, e.g. `dealerDemo:v1`. */
  key: string;
  /**
   * Structural check on data that has been outside the program's control.
   * It should confirm the collections exist and are the right shape — enough to
   * guarantee the screens can render — without validating every field.
   */
  isUsable: (value: unknown) => value is TState;
}

/**
 * Browser-backed repository. Each visitor keeps their own workspace in their
 * own browser — there is no shared mutable dataset anywhere.
 */
export function createLocalRepository<TState>({
  key,
  isUsable,
}: LocalRepositoryOptions<TState>): DemoRepository<TState> {
  const available = typeof window !== 'undefined' && storageAvailable();

  return {
    load() {
      if (!available) {
        return { status: 'reset', reason: 'Browser storage is unavailable in this session.' };
      }

      let raw: string | null;
      try {
        raw = window.localStorage.getItem(key);
      } catch {
        return { status: 'reset', reason: 'Browser storage could not be read.' };
      }

      if (!raw) return { status: 'empty' };

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { status: 'reset', reason: 'Saved demo data could not be read.' };
      }

      if (!isUsable(parsed)) {
        return { status: 'reset', reason: 'Saved demo data was from an older version.' };
      }

      return { status: 'loaded', state: parsed };
    },

    save(state) {
      if (!available) return;
      try {
        window.localStorage.setItem(key, JSON.stringify(state));
      } catch {
        // Quota exceeded or storage disabled mid-session. The workspace keeps
        // working in memory; only persistence across a refresh is lost, which
        // is not worth interrupting the visitor over.
      }
    },

    clear() {
      if (!available) return;
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Nothing to recover from — the next load falls back to the seed.
      }
    },
  };
}

/** In-memory repository used by unit tests and any non-browser environment. */
export function createMemoryRepository<TState>(
  isUsable: (value: unknown) => value is TState,
): DemoRepository<TState> {
  let stored: string | null = null;

  return {
    load() {
      if (!stored) return { status: 'empty' };
      try {
        const parsed: unknown = JSON.parse(stored);
        if (!isUsable(parsed)) return { status: 'reset', reason: 'Stored data was unusable.' };
        return { status: 'loaded', state: parsed };
      } catch {
        return { status: 'reset', reason: 'Stored data could not be read.' };
      }
    },
    save(state) {
      stored = JSON.stringify(state);
    },
    clear() {
      stored = null;
    },
  };
}
