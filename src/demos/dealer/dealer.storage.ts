import type { DealerState } from './dealer.types';
import {
  createLocalRepository as createShared,
  createMemoryRepository as createSharedMemory,
  type DemoRepository,
  type LoadOutcome as SharedLoadOutcome,
} from '../shared/storage';

/**
 * Dealer persistence.
 *
 * The mechanics — versioning, validation, the guarded `localStorage` access —
 * are shared with the other demos. What belongs here is the storage key and the
 * shape check that decides whether a stored payload is still usable.
 */

/** Bump whenever `DealerState` changes shape. */
export const SCHEMA_VERSION = 1;

export const STORAGE_KEY = `dealerDemo:v${SCHEMA_VERSION}`;

export type LoadOutcome = SharedLoadOutcome<DealerState>;
export type DealerRepository = DemoRepository<DealerState>;

/** Every collection the UI reads. A payload missing one is treated as corrupt. */
const REQUIRED_COLLECTIONS = [
  'locations',
  'salespeople',
  'vehicles',
  'leads',
  'customers',
  'reservations',
  'deals',
  'financing',
  'payments',
  'documents',
  'tasks',
  'activity',
] as const;

function isUsableState(value: unknown): value is DealerState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;

  if (candidate.schemaVersion !== SCHEMA_VERSION) return false;
  if (!candidate.settings || typeof candidate.settings !== 'object') return false;
  if (!candidate.counters || typeof candidate.counters !== 'object') return false;

  return REQUIRED_COLLECTIONS.every((key) => Array.isArray(candidate[key]));
}

export function createLocalRepository(key: string = STORAGE_KEY): DealerRepository {
  return createShared<DealerState>({ key, isUsable: isUsableState });
}

/** In-memory repository used by unit tests and any non-browser environment. */
export function createMemoryRepository(): DealerRepository {
  return createSharedMemory<DealerState>(isUsableState);
}
