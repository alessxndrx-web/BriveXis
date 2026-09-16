import { buildSeedState } from './distribution.seed';
import type { DistributionState } from './distribution.types';

/**
 * Test fixtures.
 *
 * The demo seed is rich on purpose — a visitor should land in a workspace that
 * already has history. That makes it a poor base for domain tests, which need
 * to know exactly how many units exist and exactly which documents are
 * present.
 *
 * `blankWorkspace` keeps the catalogue, the warehouses and the trading
 * partners, so tests can keep using recognisable ids, and drops every
 * transaction. Opening stock is stated explicitly, as ledger movements, which
 * is also how the real workspace starts.
 */

/** [productId, warehouseId, quantity] */
export type Opening = [string, string, number];

export function blankWorkspace(opening: Opening[] = []): DistributionState {
  const seed = buildSeedState();

  return {
    ...seed,
    movements: opening.map(([productId, warehouseId, quantity], index) => ({
      id: `opening-${index}`,
      productId,
      warehouseId,
      type: 'OPENING_BALANCE' as const,
      quantity,
      at: '2026-09-01T08:00:00.000Z',
      source: 'Test opening balance',
      note: '',
    })),
    purchaseOrders: [],
    receipts: [],
    orders: [],
    allocations: [],
    shipments: [],
    invoices: [],
    payments: [],
    transfers: [],
    returns: [],
    activity: [],
  };
}
