import { emptyAddressIn } from '../../shared/ui/formControls';
import type { Address } from '../contractor.types';

/**
 * Contractor re-export of the shared form primitives, plus the one default that
 * is specific to this demo: Northline Contracting works out of Colorado, so a
 * blank address starts there.
 */
export * from '../../shared/ui/formControls';

export const emptyAddress: Address = emptyAddressIn('CO');
