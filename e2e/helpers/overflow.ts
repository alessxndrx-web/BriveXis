import type { Page } from 'puppeteer-core';

/**
 * Horizontal overflow detection.
 *
 * The naive check — `documentElement.scrollWidth > innerWidth` — reports a
 * false failure for any screen that contains a deliberate horizontal scroller,
 * because that measurement includes the scroller's *content* width. A wide
 * table inside `overflow-x-auto` is a designed behaviour, not a layout bug.
 *
 * What actually matters is whether the page itself scrolls sideways, so that is
 * what is measured: the body's scroll width against the viewport, confirmed by
 * asking the window to scroll and seeing whether it moved.
 */

export interface OverflowReport {
  overflows: boolean;
  bodyScrollWidth: number;
  innerWidth: number;
  /** True when the window actually scrolled horizontally. */
  scrolled: boolean;
  /** Elements that stick out, ignoring anything inside a scroll container. */
  offenders: string[];
}

export async function measureOverflow(page: Page): Promise<OverflowReport> {
  return page.evaluate(() => {
    const before = window.scrollX;
    window.scrollTo(600, window.scrollY);
    const scrolled = window.scrollX > 0;
    window.scrollTo(before, window.scrollY);

    const innerWidth = window.innerWidth;
    const bodyScrollWidth = document.body.scrollWidth;
    const overflows = scrolled || bodyScrollWidth > innerWidth + 1;

    const offenders: string[] = [];
    if (overflows) {
      for (const el of Array.from(document.querySelectorAll('*'))) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0) continue;
        if (rect.right <= innerWidth + 1 && rect.width <= innerWidth + 1) continue;

        // An element wider than the viewport is fine when an ancestor scrolls it.
        let scrollable = false;
        for (let parent = el.parentElement; parent; parent = parent.parentElement) {
          const overflowX = window.getComputedStyle(parent).overflowX;
          if (overflowX === 'auto' || overflowX === 'scroll') {
            scrollable = true;
            break;
          }
        }
        if (scrollable) continue;

        const classes = (el.className?.toString() ?? '').slice(0, 80);
        offenders.push(`${el.tagName}.${classes} w=${Math.round(rect.width)} right=${Math.round(rect.right)}`);
        if (offenders.length >= 8) break;
      }
    }

    return { overflows, bodyScrollWidth, innerWidth, scrolled, offenders };
  });
}

/** Throws with the offending elements when the page scrolls sideways. */
export async function assertNoPageOverflow(page: Page, context: string): Promise<void> {
  const report = await measureOverflow(page);
  if (!report.overflows) return;

  const detail = report.offenders.length
    ? `\nOffending elements:\n${report.offenders.map((o) => `  ${o}`).join('\n')}`
    : '\nNo single element was identified; check padding or a negative margin.';

  throw new Error(
    `Horizontal page overflow on ${context}: body scrollWidth ${report.bodyScrollWidth} > ` +
      `viewport ${report.innerWidth} (window scrolled: ${report.scrolled}).${detail}`,
  );
}
