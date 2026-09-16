/**
 * The responsive matrix.
 *
 * Every width the site is expected to work at has a name here so tests refer to
 * "mobile" rather than to a number, and so the layout audit and the workflow
 * tests cannot drift apart.
 */

export interface Viewport {
  name: string;
  width: number;
  height: number;
}

export const VIEWPORTS = {
  mobile: { name: 'mobile-375', width: 375, height: 812 },
  mobileLarge: { name: 'mobile-430', width: 430, height: 860 },
  tablet: { name: 'tablet-768', width: 768, height: 900 },
  laptopSmall: { name: 'laptop-1024', width: 1024, height: 820 },
  laptop: { name: 'laptop-1280', width: 1280, height: 860 },
  desktop: { name: 'desktop-1440', width: 1440, height: 900 },
  desktopWide: { name: 'desktop-1920', width: 1920, height: 1000 },
} as const satisfies Record<string, Viewport>;

/** All seven widths, for the layout audit. */
export const ALL_VIEWPORTS: Viewport[] = Object.values(VIEWPORTS);

/** The two phone widths, for the critical mobile workflows. */
export const MOBILE_VIEWPORTS: Viewport[] = [VIEWPORTS.mobile, VIEWPORTS.mobileLarge];

/** The width full workflows run at unless a test says otherwise. */
export const DEFAULT_VIEWPORT: Viewport = VIEWPORTS.desktop;
