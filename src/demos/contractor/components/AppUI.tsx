/**
 * Contractor re-export of the shared application primitives.
 *
 * The primitives live in `src/demos/shared/ui` so Dealer and any later demo use
 * the same controls. This file keeps the contractor screens importing from
 * their own module, which is what stopped the extraction from touching them.
 */
export * from '../../shared/ui/AppUI';
