import {
  createLocalRepository as createSharedLocal,
  createMemoryRepository as createSharedMemory,
  type DemoRepository,
  type LoadOutcome as SharedLoadOutcome,
} from '../shared/storage';
import type { DistributionState } from './distribution.types';

/**
 * Distribution persistence.
 *
 * The mechanics — versioning, validation, the guarded `localStorage` access —
 * are shared with the other demos. What belongs here is the storage key and the
 * shape check that decides whether a stored payload is still usable.
 *
 * The check is deliberately structural rather than exhaustive: it confirms the
 * collections exist, are arrays, and that every row has an id, which is enough
 * to guarantee the screens and the selectors can run. Anything deeper would be
 * re-implementing the type system at runtime for demo data nobody needs to keep.
 */

/** Bump whenever `DistributionState` changes shape. */
export const SCHEMA_VERSION = 2;

export const STORAGE_KEY = `distributionDemo:v${SCHEMA_VERSION}`;

export type LoadOutcome = SharedLoadOutcome<DistributionState>;
export type DistributionRepository = DemoRepository<DistributionState>;

/** Every collection the UI reads. A payload missing one is treated as corrupt. */
const REQUIRED_COLLECTIONS = [
  'products',
  'warehouses',
  'suppliers',
  'customers',
  'movements',
  'purchaseOrders',
  'receipts',
  'orders',
  'allocations',
  'shipments',
  'invoices',
  'payments',
  'transfers',
  'returns',
  'activity',
] as const;

export function isUsableState(value: unknown): value is DistributionState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;

  if (candidate.schemaVersion !== SCHEMA_VERSION) return false;
  if (!candidate.settings || typeof candidate.settings !== 'object') return false;

  return REQUIRED_COLLECTIONS.every((key) => {
    const collection = candidate[key];
    return (
      Array.isArray(collection) &&
      collection.every(
        (row: unknown) =>
          row !== null && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string',
      )
    );
  });
}

export const createLocalRepository = (key: string = STORAGE_KEY): DistributionRepository =>
  createSharedLocal<DistributionState>({ key, isUsable: isUsableState });

/** In-memory repository used by unit tests and any non-browser environment. */
export const createMemoryRepository = (): DistributionRepository =>
  createSharedMemory<DistributionState>(isUsableState);
