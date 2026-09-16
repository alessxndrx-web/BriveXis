import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Page } from 'puppeteer-core';

/**
 * Screenshots.
 *
 * Captured on demand for layout review, written under `test-results/` which is
 * git-ignored: these are an inspection aid, not a committed baseline, so they
 * never turn into a pile of binaries that has to be re-approved on every
 * styling change.
 */

export const SCREENSHOT_DIR = path.resolve(process.cwd(), 'test-results', 'screenshots');

/** Set E2E_SCREENSHOTS=1 to capture; off by default so normal runs stay fast. */
export const screenshotsEnabled = process.env.E2E_SCREENSHOTS === '1';

let prepared = false;

function ensureDir(): void {
  if (prepared) return;
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  prepared = true;
}

const safeName = (value: string) => value.replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();

/**
 * Writes `<name>.png` when screenshots are enabled and returns its path.
 * Returns null otherwise, so callers never branch on the environment.
 */
export async function capture(
  page: Page,
  name: string,
  options: { fullPage?: boolean } = {},
): Promise<string | null> {
  if (!screenshotsEnabled) return null;
  ensureDir();
  const file = path.join(SCREENSHOT_DIR, `${safeName(name)}.png`);
  await page.screenshot({ path: file as `${string}.png`, fullPage: options.fullPage ?? false });
  return file;
}

/** Always captures, whatever the environment — used when a test fails. */
export async function captureFailure(page: Page, name: string): Promise<string> {
  ensureDir();
  const file = path.join(SCREENSHOT_DIR, `failure-${safeName(name)}.png`);
  await page.screenshot({ path: file as `${string}.png`, fullPage: true });
  return file;
}
