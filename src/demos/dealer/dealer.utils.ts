import type { Counters, Vehicle } from './dealer.types';
import { makeCodeFactory } from '../shared/format';

/**
 * Dealer formatting helpers.
 *
 * Money, dates, phones and addresses are shared with the other demos; what is
 * specific here is vehicle presentation and the demo VIN format.
 */
export * from '../shared/format';

const CODE_PREFIX = {
  lead: 'DL',
  customer: 'CUS',
  vehicle: 'STK',
  reservation: 'RES',
  deal: 'DEA',
  financing: 'FIN',
  payment: 'PAY',
  document: 'DOC',
  task: 'TSK',
} as const;

export type CodeKind = keyof typeof CODE_PREFIX;

const codes = makeCodeFactory<CodeKind>(CODE_PREFIX);

export function formatCode(kind: CodeKind, sequence: number): string {
  return codes.format(kind, sequence);
}

export function nextCode(counters: Counters, kind: CodeKind): { code: string; counters: Counters } {
  return codes.next(counters, kind) as { code: string; counters: Counters };
}

// ------------------------------------------------------------------ vehicles

/** "2021 Toyota RAV4 XLE" — the way a dealership refers to a unit. */
export function vehicleTitle(vehicle: Pick<Vehicle, 'year' | 'make' | 'model' | 'trim'>): string {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ');
}

/** "38,420 mi". */
export function formatMileage(miles: number): string {
  return `${new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(miles)))} mi`;
}

/** Last six characters, the way a VIN is quoted in conversation. */
export function vinSuffix(vin: string): string {
  return vin.slice(-6);
}

/**
 * Characters a real VIN may contain. I, O and Q are excluded from the standard
 * precisely because they are confusable with 1 and 0, and the demo identifiers
 * follow the same rule so they look right next to a genuine one.
 */
const VIN_ALPHABET = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';

export const VIN_LENGTH = 17;

/**
 * Builds a 17-character demonstration identifier from a seed number.
 *
 * Deterministic on purpose: the same seed always produces the same string, so
 * the workspace, the tests and any screenshot stay in agreement. These are not
 * decodable VINs and do not correspond to a real vehicle.
 */
export function demoVin(seed: number): string {
  let value = Math.abs(Math.trunc(seed)) + 1_000_003;
  let out = '';
  for (let i = 0; i < VIN_LENGTH; i += 1) {
    value = (value * 1_103_515_245 + 12_345) % 2_147_483_648;
    out += VIN_ALPHABET[value % VIN_ALPHABET.length];
  }
  return out;
}

export function isValidDemoVin(value: string): boolean {
  const upper = value.trim().toUpperCase();
  if (upper.length !== VIN_LENGTH) return false;
  return upper.split('').every((character) => VIN_ALPHABET.includes(character));
}
