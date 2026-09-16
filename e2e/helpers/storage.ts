import type { Page } from 'puppeteer-core';
import { BASE_URL } from './browser';

/**
 * Demo persistence control.
 *
 * Each demo keeps its workspace in the visitor's own `localStorage`, so a test
 * that leaves records behind changes what the next test sees. Clearing before a
 * workflow is what makes each run start from the seed.
 */

export const STORAGE_KEYS = {
  contractor: 'contractorDemo:v1',
  dealer: 'dealerDemo:v1',
  distribution: 'distributionDemo:v2',
} as const;

export type DemoKey = keyof typeof STORAGE_KEYS;

/**
 * Clears a demo's stored workspace. The origin has to be loaded before
 * `localStorage` is reachable, so a blank page on the site is opened first.
 */
export async function clearDemoStorage(page: Page, demo: DemoKey): Promise<void> {
  if (!page.url().startsWith(BASE_URL)) {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  }
  await page.evaluate((key: string) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Storage unavailable in this context; the demo falls back to the seed.
    }
  }, STORAGE_KEYS[demo]);
}

/** Raw stored payload, for asserting that persistence actually happened. */
export async function readDemoStorage(page: Page, demo: DemoKey): Promise<unknown | null> {
  return page.evaluate((key: string) => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as unknown) : null;
    } catch {
      return null;
    }
  }, STORAGE_KEYS[demo]);
}

/** Writes deliberately corrupt data, to exercise the recovery path. */
export async function corruptDemoStorage(page: Page, demo: DemoKey): Promise<void> {
  await page.evaluate((key: string) => {
    try {
      window.localStorage.setItem(key, '{"schemaVersion":');
    } catch {
      // Nothing to corrupt when storage is unavailable.
    }
  }, STORAGE_KEYS[demo]);
}
