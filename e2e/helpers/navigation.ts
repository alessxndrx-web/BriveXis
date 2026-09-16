import type { ElementHandle, Page } from 'puppeteer-core';
import { BASE_URL } from './browser';

/**
 * Navigation and element lookup.
 *
 * Elements are found by the text a person actually reads, not by CSS position,
 * so a restyle does not break the suite but a renamed action does — which is
 * the failure a test should report. `data-testid` is deliberately absent: the
 * applications are built from semantic controls and those are enough.
 */

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Absolute URL for an in-app path. */
export const url = (path: string) => `${BASE_URL}${path}`;

export async function goto(page: Page, path: string): Promise<void> {
  await page.goto(url(path), { waitUntil: 'networkidle0' });
  await waitForApp(page);
}

/** Waits for React to have painted something into the root element. */
export async function waitForApp(page: Page, timeout = 15_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return !!root && root.childElementCount > 0 && document.body.innerText.trim().length > 0;
    },
    { timeout },
  );
}

const CLICKABLE = 'button, a, [role="tab"], [role="option"], [role="menuitem"]';

interface FindOptions {
  /** Matches the full trimmed text rather than a substring. */
  exact?: boolean;
  /** Restricts the search, e.g. to `main` or `[role="dialog"]`. */
  within?: string;
  /** Overrides the set of elements considered clickable. */
  selector?: string;
  /** Picks among several matches. Defaults to the first. */
  index?: number;
}

async function findByText(
  page: Page,
  text: string,
  options: FindOptions = {},
): Promise<ElementHandle<Element> | null> {
  const { exact = false, within = '', selector = CLICKABLE, index = 0 } = options;

  const handle = await page.evaluateHandle(
    (sel: string, needle: string, isExact: boolean, root: string, nth: number) => {
      const scope: ParentNode | null = root ? document.querySelector(root) : document;
      if (!scope) return null;

      const visible = (el: Element) => {
        const style = window.getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        return (el as HTMLElement).offsetParent !== null || style.position === 'fixed';
      };

      const label = (el: Element) =>
        ((el as HTMLElement).innerText || el.textContent || '').trim().replace(/\s+/g, ' ');

      const matches = Array.from(scope.querySelectorAll(sel)).filter((el) => {
        if (!visible(el)) return false;
        const value = label(el);
        return isExact ? value === needle : value.includes(needle);
      });

      return matches[nth] ?? null;
    },
    selector,
    text,
    exact,
    within,
    index,
  );

  return handle.asElement() as ElementHandle<Element> | null;
}

/** Clicks the visible control carrying this text. Throws if there is none. */
export async function clickText(page: Page, text: string, options: FindOptions = {}): Promise<void> {
  const element = await findByText(page, text, options);
  if (!element) {
    const scope = options.within ? ` within "${options.within}"` : '';
    throw new Error(`No visible control matching "${text}"${scope}.`);
  }

  await element.scrollIntoView();
  try {
    await element.click();
  } catch {
    // Controls inside a scrolling dialog can fail Puppeteer's clickable-point
    // check even though they are perfectly usable; the DOM click still runs
    // the same handler.
    await element.evaluate((node) => (node as HTMLElement).click());
  }
}

export async function hasText(
  page: Page,
  needle: string,
  options: { ignoreCase?: boolean } = {},
): Promise<boolean> {
  const haystack = await pageText(page);
  // `innerText` reflects CSS text-transform, so a label styled uppercase comes
  // back uppercase. `ignoreCase` is for those, not for sloppy matching.
  return options.ignoreCase
    ? haystack.toLowerCase().includes(needle.toLowerCase())
    : haystack.includes(needle);
}

/** Whitespace-collapsed visible text, for assertions. */
export async function pageText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
}

export async function isVisible(page: Page, text: string, options: FindOptions = {}): Promise<boolean> {
  return (await findByText(page, text, options)) !== null;
}

/**
 * Follows an in-app link whose text matches, using client-side navigation so
 * session state (such as the selected demo role) survives.
 */
export async function followLink(page: Page, pattern: RegExp): Promise<string> {
  const href = await page.evaluate((source: string) => {
    const regex = new RegExp(source);
    const anchor = Array.from(document.querySelectorAll('a')).find((el) =>
      regex.test((el.innerText || '').trim().replace(/\s+/g, ' ')),
    );
    return anchor ? anchor.getAttribute('href') : null;
  }, pattern.source);

  if (!href) throw new Error(`No link matching ${pattern}.`);
  await clickInApp(page, href);
  return href;
}

/**
 * Client-side navigation to a path. A full `goto` would reload the document and
 * discard session state, which is the wrong thing to test for in-app links.
 */
export async function clickInApp(page: Page, path: string): Promise<void> {
  await page.evaluate((target: string) => {
    const anchor = document.createElement('a');
    anchor.href = target;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }, path);
  await wait(500);
}

export async function pathname(page: Page): Promise<string> {
  return page.evaluate(() => window.location.pathname);
}

/** Counts the rows of the first table body on screen. */
export async function rowCount(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelectorAll('tbody tr').length);
}

/** Visible names of the in-app navigation links. */
export async function navLabels(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('nav a'))
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => ((el as HTMLElement).innerText || '').trim())
      .filter(Boolean),
  );
}
