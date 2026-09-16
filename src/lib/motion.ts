/**
 * Shared motion tokens.
 *
 * Motion on this site communicates precision and workflow, never entertainment:
 * short durations, one easing curve, reveals that run once. Keeping the values
 * here is what stops each section from inventing its own motion language.
 */

/** Single easing curve used site-wide (fast out, settled end). */
export const EASE = [0.16, 1, 0.3, 1] as const;

export const DURATION = {
  /** Hover and state changes. */
  fast: 0.2,
  /** Panel swaps and tab transitions. */
  medium: 0.3,
  /** Scroll reveals. */
  reveal: 0.5,
} as const;

/** Delay between staggered siblings. */
export const STAGGER_STEP = 0.06;

/** Viewport configuration: every reveal runs once, slightly before full entry. */
export const VIEWPORT = { once: true, margin: '-60px 0px' } as const;
