export type LogoVariant = 'full' | 'mark';
export type LogoTheme = 'dark' | 'light';

interface BriveXisLogoProps {
  /** 'full' renders the mark plus the wordmark, 'mark' renders the BX monogram only. */
  variant?: LogoVariant;
  /** 'dark' = placed on midnight surfaces, 'light' = placed on ivory surfaces. */
  theme?: LogoTheme;
  /** Cap height of the monogram in pixels. The width follows from the viewBox. */
  size?: number;
  className?: string;
}

/**
 * BX monogram geometry — the single source of truth for the mark.
 * `public/favicon.svg` is a static mirror of these two shapes; if the geometry
 * changes here, regenerate that file with the same numbers.
 *
 * The B is drawn on a 32-unit cap height and is deliberately over-specified for
 * legibility at 16px, where a softer B collapses into a D:
 *   - a dead-straight full-height stem on the left (x 0-6), never a curve;
 *   - two counters carved out with `evenodd`, stacked around a solid 4.8-unit
 *     middle bar, so the glyph shows two bowls rather than one;
 *   - a stepped waist: the upper bowl stops at x=17, the lower bowl runs to
 *     x=20, which is the silhouette cue that separates B from D, P and R;
 *   - 45 degree chamfers on the outer corners instead of radii, echoing the
 *     diagonals of the X and keeping the mark technical rather than app-icon.
 *
 * The X keeps its own column (x 26-45), leaving a 6-unit gap so the two
 * characters read as B + X and can never fuse into one shape.
 */
const MARK_WIDTH = 45;
const MARK_HEIGHT = 32;

const B_PATH =
  'M0 0 H13.8 L17 3.2 V18.2 L20 21.2 V28.8 L16.8 32 H0 Z ' +
  'M6 4.8 H12.6 V13.6 H6 Z ' +
  'M6 18.4 H12.9 L15.9 21.4 V27.2 H6 Z';

/** Two independent strokes: they overlap at the crossing instead of cancelling. */
const X_PATHS = ['M26 0 H32 L45 32 H39 Z', 'M39 0 H45 L32 32 H26 Z'];

/** The monogram on its own. The B inherits its colour from `currentColor`. */
function Mark({ size }: { size: number }) {
  return (
    <svg
      viewBox={`0 0 ${MARK_WIDTH} ${MARK_HEIGHT}`}
      height={size}
      width={(size * MARK_WIDTH) / MARK_HEIGHT}
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <path d={B_PATH} fill="currentColor" fillRule="evenodd" />
      {X_PATHS.map((d) => (
        <path key={d} d={d} className="fill-copper" />
      ))}
    </svg>
  );
}

const themeColor: Record<LogoTheme, string> = {
  dark: 'text-ivory',
  light: 'text-charcoal',
};

export function BriveXisLogo({
  variant = 'full',
  theme = 'dark',
  size = 20,
  className = '',
}: BriveXisLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${themeColor[theme]} ${className}`}>
      <Mark size={size} />
      {variant === 'full' ? (
        <span
          className="font-heading font-bold tracking-[-0.02em] leading-none"
          style={{ fontSize: size * 0.82 }}
        >
          Brive<span className="text-copper">X</span>is
        </span>
      ) : (
        /* The mark alone carries no text, so it needs its own accessible name.
           An aria-label on the wrapping link overrides this when one is set. */
        <span className="sr-only">BriveXis</span>
      )}
    </span>
  );
}
