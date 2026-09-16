/**
 * Primitives shared by every BriveXis demo application.
 *
 * Money is whole cents everywhere. Float arithmetic on currency accumulates
 * error across line items, tax and partial payments — precisely where a
 * balance has to be exact — so every amount in every demo is an integer and is
 * converted to dollars only for display and input.
 *
 * Dates are ISO strings: `YYYY-MM-DD` for calendar dates, full ISO 8601 for
 * timestamps. Keeping them as strings is what lets an entire workspace
 * round-trip through browser storage unchanged.
 */

export type Id = string;

/** Whole cents. Never a float. */
export type Cents = number;

/** `YYYY-MM-DD`. */
export type DateOnly = string;

/** Full ISO 8601 timestamp. */
export type Timestamp = string;

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}

/** One measured category in a chart: a count, optionally with a money figure. */
export interface Bucket {
  label: string;
  value: number;
  amount?: Cents;
}
