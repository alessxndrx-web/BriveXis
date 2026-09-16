import type { Page } from 'puppeteer-core';
import { clickText, goto, hasText, wait } from './navigation';
import { setValue } from './forms';

/**
 * Interactions shared by every BriveXis demo application.
 *
 * Contractor, Dealer and Distribution are different products built on the same
 * shell — a top bar with Quick Create and Reset demo, a sidebar, a demo role
 * control and a toast region. Driving that shell lives here so each product
 * suite only contains what is actually specific to its domain.
 */

export const DIALOG = '[role="dialog"]';
export const MAIN = 'main';

export interface DemoApp {
  /** Base path, e.g. `/demos/contractor-operations`. */
  base: string;
  /** Workspace name shown in the demo banner. */
  company: string;
}

export const CONTRACTOR: DemoApp = {
  base: '/demos/contractor-operations',
  company: 'Northline Contracting',
};

export const DEALER: DemoApp = {
  base: '/demos/dealer-operations',
  company: 'Summit Auto & Motors',
};

export const DISTRIBUTION: DemoApp = {
  base: '/demos/distribution-operations',
  company: 'Meridian Supply Co.',
};

/** Opens a demo module, e.g. `openModule(page, DEALER, 'inventory')`. */
export async function openModule(page: Page, app: DemoApp, segment = ''): Promise<void> {
  await goto(page, segment ? `${app.base}/${segment}` : app.base);
  await wait(350);
}

/** Opens a record detail by its path segment and id. */
export async function openRecord(
  page: Page,
  app: DemoApp,
  segment: string,
  id: string,
): Promise<void> {
  await goto(page, `${app.base}/${segment}/${id}`);
  await wait(350);
}

/**
 * Uses Quick Create in the top bar. `option` is the menu item's label.
 *
 * Scoped to the open menu: the demo's own name contains words like "Deal", so
 * an unscoped text match would hit the logo link instead of the menu item.
 */
export async function quickCreate(page: Page, option: string): Promise<void> {
  await clickText(page, 'Create', { exact: true });
  await wait(250);
  await clickText(page, option, { within: '[role="menu"]' });
  await wait(400);
}

/** Confirms the primary action of the dialog that is currently open. */
export async function confirmDialog(page: Page, label: string): Promise<void> {
  await clickText(page, label, { exact: true, within: DIALOG });
  await wait(600);
}

/** True while a dialog is on screen. */
export async function dialogOpen(page: Page): Promise<boolean> {
  return page.evaluate((selector: string) => !!document.querySelector(selector), DIALOG);
}

/**
 * Runs Reset demo from the top bar, including its confirmation. The demo is
 * expected to refuse to reset without one, so a missing dialog fails here.
 */
export async function resetDemo(page: Page): Promise<void> {
  await clickText(page, 'Reset demo', { exact: true });
  await wait(500);
  if (!(await dialogOpen(page))) {
    throw new Error('Reset demo did not ask for confirmation.');
  }
  await confirmDialog(page, 'Reset demo');
  await wait(700);
}

/** Switches the demo role. Session state, so it resets on a hard reload. */
export async function setDemoRole(page: Page, role: string): Promise<void> {
  await setValue(page, '#demo-role', role);
  await wait(450);
}

/** Latest toast message, for asserting that an action reported itself. */
export async function toastText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const region = document.querySelector('[role="status"], [aria-live]');
    return region ? (region as HTMLElement).innerText.replace(/\s+/g, ' ').trim() : '';
  });
}

/** Asserts the fictional-data notice is present, which every demo must show. */
export async function assertDemoNotice(page: Page, app: DemoApp): Promise<void> {
  const hasCompany = await hasText(page, app.company);
  const hasNotice = await hasText(page, 'fictional');
  if (!hasCompany || !hasNotice) {
    throw new Error(
      `The demo workspace notice is missing (company: ${hasCompany}, fictional notice: ${hasNotice}).`,
    );
  }
}

/** Types into the workspace search and returns whether results appeared. */
export async function searchWorkspace(page: Page, query: string): Promise<boolean> {
  await page.click('#workspace-search');
  await page.type('#workspace-search', query, { delay: 12 });
  await wait(600);
  return page.evaluate(
    () => !!document.querySelector('[role="listbox"] [role="option"], [role="option"]'),
  );
}

/** Picks the highlighted search result with the keyboard. */
export async function openFirstSearchResult(page: Page): Promise<void> {
  await page.keyboard.press('ArrowDown');
  await wait(200);
  await page.keyboard.press('Enter');
  await wait(800);
}
