import type { ContractorState } from './contractor.types';
import {
  createLocalRepository as createShared,
  createMemoryRepository as createSharedMemory,
  type DemoRepository,
  type LoadOutcome as SharedLoadOutcome,
} from '../shared/storage';

/**
 * Contractor persistence.
 *
 * The mechanics — versioning, validation, the guarded `localStorage` access —
 * are shared with the other demos. What belongs to this demo is the storage key
 * and the shape check that decides whether a stored payload is still usable.
 */

/** Bump whenever `ContractorState` changes shape. */
export const SCHEMA_VERSION = 1;

export const STORAGE_KEY = `contractorDemo:v${SCHEMA_VERSION}`;

export type LoadOutcome = SharedLoadOutcome<ContractorState>;
export type ContractorRepository = DemoRepository<ContractorState>;

/** Every collection the UI reads. A payload missing one is treated as corrupt. */
const REQUIRED_COLLECTIONS = [
  'leads',
  'customers',
  'locations',
  'estimates',
  'jobs',
  'crews',
  'crewMembers',
  'fieldRecords',
  'invoices',
  'payments',
  'activity',
  'followUps',
] as const;

/**
 * Structural check on data that has been outside the program's control.
 * It confirms the collections exist and are arrays — enough to guarantee the
 * screens can render — without pretending to validate every field.
 */
function isUsableState(value: unknown): value is ContractorState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;

  if (candidate.schemaVersion !== SCHEMA_VERSION) return false;
  if (!candidate.settings || typeof candidate.settings !== 'object') return false;
  if (!candidate.counters || typeof candidate.counters !== 'object') return false;

  return REQUIRED_COLLECTIONS.every((key) => Array.isArray(candidate[key]));
}

export function createLocalRepository(key: string = STORAGE_KEY): ContractorRepository {
  return createShared<ContractorState>({ key, isUsable: isUsableState });
}

/** In-memory repository used by unit tests and any non-browser environment. */
export function createMemoryRepository(): ContractorRepository {
  return createSharedMemory<ContractorState>(isUsableState);
}
