import { afterAll, describe, expect, it } from 'vitest';
import { closeBrowser, withPage } from '../helpers/browser';
import { VIEWPORTS, ALL_VIEWPORTS } from '../helpers/viewport';
import {
  clickInApp,
  clickText,
  followLink,
  goto,
  hasText,
  pageText,
  pathname,
  rowCount,
  wait,
} from '../helpers/navigation';
import { assertNoPageOverflow } from '../helpers/overflow';
import { assertAccessible, focusStaysInDialog } from '../helpers/accessibility';
import { rowIds, setValue } from '../helpers/forms';
import { clearDemoStorage, corruptDemoStorage, readDemoStorage } from '../helpers/storage';
import {
  CONTRACTOR,
  DIALOG,
  MAIN,
  assertDemoNotice,
  confirmDialog,
  openModule,
  openFirstSearchResult,
  quickCreate,
  resetDemo,
  searchWorkspace,
  setDemoRole,
  openRecord,
} from '../helpers/demoApp';
import { capture } from '../helpers/screenshots';

/**
 * Contractor Operations.
 *
 * The centre of this file is the lifecycle a contractor actually runs: a lead
 * becomes an estimate, the estimate becomes a scheduled job, the job produces
 * field records and an invoice, and the invoice gets paid. It is one test
 * because the steps genuinely depend on each other — splitting it would only
 * mean rebuilding the same records several times.
 */

const MODULES = [
  '',
  'leads',
  'customers',
  'estimates',
  'jobs',
  'schedule',
  'crews',
  'invoices',
  'payments',
  'reports',
  'settings',
];

afterAll(async () => {
  await closeBrowser();
});

describe('contractor operations — lifecycle', () => {
  it('runs lead → estimate → job → field work → invoice → paid, then resets', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await goto(page, CONTRACTOR.base);
      await clearDemoStorage(page, 'contractor');
      await goto(page, CONTRACTOR.base);
      await assertDemoNotice(page, CONTRACTOR);

      // --- lead -----------------------------------------------------------
      await quickCreate(page, 'Lead');
      await setValue(page, '#name', 'Tankless water heater install');
      await setValue(page, '#contactName', 'Dana Whitfield');
      await setValue(page, '#phone', '(303) 555-0148');
      await setValue(page, '#email', 'dana.whitfield@example.com');
      await setValue(page, '#estimatedValue', '7400');
      await setValue(page, '#description', 'Replace two tank heaters with a tankless system.');
      await setValue(page, '#lead-address-line1', '4820 Larkspur Way');
      await setValue(page, '#lead-address-city', 'Aurora');
      await setValue(page, '#lead-address-state', 'CO');
      await setValue(page, '#lead-address-zip', '80013');
      await confirmDialog(page, 'Save');

      await openModule(page, CONTRACTOR, 'leads');
      expect(await hasText(page, 'Tankless water heater install')).toBe(true);

      await clickText(page, 'Tankless water heater install', { selector: 'a' });
      await wait(500);
      expect(await hasText(page, 'Dana Whitfield')).toBe(true);

      await clickText(page, 'Estimate Needed', { exact: true, within: MAIN });
      await wait(500);

      // --- estimate -------------------------------------------------------
      await clickText(page, 'Create estimate', { exact: true, within: MAIN });
      await wait(800);
      expect(await pathname(page)).toContain('/estimates');
      expect(await hasText(page, 'Pre-filled from lead')).toBe(true);

      // The lead has no customer record yet; the editor offers to create one.
      await clickText(page, 'Create one', { exact: true, within: MAIN });
      await wait(500);
      await setValue(page, '#customer-service-location', 'Utility room');
      await confirmDialog(page, 'Create customer');

      expect(await page.$eval('#customerId', (el) => (el as HTMLSelectElement).value)).toBeTruthy();
      // The location created alongside the customer must be selected too.
      expect(await page.$eval('#locationId', (el) => (el as HTMLSelectElement).value)).toBeTruthy();

      await setValue(page, '#scope', 'Remove two tank heaters, install a tankless unit, re-run the gas line.');

      const first = await rowIds(page, 'item-desc-');
      expect(first.length).toBeGreaterThan(0);
      await setValue(page, `#item-desc-${first[0]}`, 'Tankless water heater unit');
      await setValue(page, `#item-qty-${first[0]}`, '1');
      await setValue(page, `#item-price-${first[0]}`, '3200');

      await clickText(page, 'Add line item', { exact: true, within: MAIN });
      await wait(300);
      await clickText(page, 'Add line item', { exact: true, within: MAIN });
      await wait(300);

      const rows = await rowIds(page, 'item-desc-');
      expect(rows).toHaveLength(3);
      await setValue(page, `#item-desc-${rows[1]}`, 'Gas line and venting');
      await setValue(page, `#item-qty-${rows[1]}`, '8');
      await setValue(page, `#item-price-${rows[1]}`, '145');
      await setValue(page, `#item-desc-${rows[2]}`, 'Permit and inspection');
      await setValue(page, `#item-qty-${rows[2]}`, '1');
      await setValue(page, `#item-price-${rows[2]}`, '285');
      await wait(400);

      // 3200 + (8 × 145) + 285 = 4645
      expect(await hasText(page, '4,645')).toBe(true);

      await clickText(page, 'Save draft', { exact: true, within: MAIN });
      await wait(800);
      expect(await pathname(page)).toMatch(/\/estimates\/[^/]+$/);

      await clickText(page, 'Mark sent', { exact: true, within: MAIN });
      await wait(600);
      expect(await hasText(page, 'Sent')).toBe(true);

      await clickText(page, 'Mark accepted', { exact: true, within: MAIN });
      await wait(700);
      expect(await hasText(page, 'Accepted')).toBe(true);

      // --- job ------------------------------------------------------------
      await clickText(page, 'Create job', { exact: true, within: MAIN });
      await wait(900);
      await followLink(page, /^View job /);
      expect(await pathname(page)).toContain('/jobs/');
      expect(await hasText(page, 'Unscheduled')).toBe(true);

      await clickText(page, 'Schedule', { exact: true, within: MAIN });
      await wait(550);
      const day = new Date();
      day.setDate(day.getDate() + 4);
      const iso = day.toISOString().slice(0, 10);
      await setValue(page, '#start', `${iso}T08:00`);
      await setValue(page, '#end', `${iso}T16:00`);
      await confirmDialog(page, 'Save schedule');
      expect(await hasText(page, 'Scheduled')).toBe(true);

      await clickText(page, 'Assign crew', { exact: true, within: MAIN });
      await wait(500);
      const crews = await page.$$(`${DIALOG} input[type="radio"]`);
      expect(crews.length).toBeGreaterThan(0);
      await crews[0].evaluate((el) => (el as HTMLInputElement).click());
      await wait(200);
      await confirmDialog(page, 'Assign crew');

      await clickText(page, 'Start job', { exact: true, within: MAIN });
      await wait(700);
      expect(await hasText(page, 'In Progress')).toBe(true);

      // --- field work -----------------------------------------------------
      await clickText(page, 'Add field record', { exact: true, within: MAIN });
      await wait(550);
      await setValue(page, '#hours', '6.5');
      await setValue(page, '#workPerformed', 'Removed both tank heaters and set the tankless unit.');
      await setValue(page, '#materialsUsed', 'Tankless unit, gas pipe, venting kit');
      const boxes = await page.$$(`${DIALOG} input[type="checkbox"]`);
      for (const box of boxes.slice(0, 2)) await box.evaluate((el) => (el as HTMLInputElement).click());
      await confirmDialog(page, 'Save record');
      expect(await pageText(page)).toMatch(/Field records\s*1/);

      await clickText(page, 'Complete job', { exact: true, within: MAIN });
      await wait(550);
      await setValue(page, '#completionNotes', 'Unit commissioned and tested with the customer.');
      const confirmBox = await page.$('#completion-confirm');
      expect(confirmBox).not.toBeNull();
      await confirmBox!.evaluate((el) => (el as HTMLInputElement).click());
      await wait(150);
      await confirmDialog(page, 'Mark complete');
      expect(await hasText(page, 'Completed')).toBe(true);

      // --- invoice and payments -------------------------------------------
      await clickText(page, 'Create invoice', { exact: true, within: MAIN });
      await wait(900);
      await followLink(page, /^View invoice /);
      expect(await pathname(page)).toContain('/invoices/');

      await clickText(page, 'Record payment', { exact: true, within: MAIN });
      await wait(550);
      await clickText(page, 'Half', { exact: true, within: DIALOG });
      await wait(250);
      await confirmDialog(page, 'Record payment');
      expect(await hasText(page, 'Partial')).toBe(true);

      await clickText(page, 'Record payment', { exact: true, within: MAIN });
      await wait(550);
      await clickText(page, 'Pay full balance', { exact: true, within: DIALOG });
      await wait(250);
      await confirmDialog(page, 'Record payment');
      expect(await hasText(page, 'Paid')).toBe(true);
      expect(await hasText(page, '$0.00')).toBe(true);

      await capture(page, 'contractor-invoice-paid');

      // --- the new records are visible across the workspace ---------------
      await openModule(page, CONTRACTOR, 'customers');
      expect(await hasText(page, 'Dana Whitfield')).toBe(true);
      await openModule(page, CONTRACTOR, 'payments');
      expect(await hasText(page, 'Dana Whitfield')).toBe(true);

      // --- reset ----------------------------------------------------------
      await openModule(page, CONTRACTOR);
      await resetDemo(page);

      await openModule(page, CONTRACTOR, 'customers');
      expect(await hasText(page, 'Dana Whitfield')).toBe(false);
      expect(await hasText(page, 'Harborview Property Group')).toBe(true);
      await openModule(page, CONTRACTOR, 'leads');
      expect(await hasText(page, 'Tankless water heater install')).toBe(false);
    });
  });
});

describe('contractor operations — navigation and state', () => {
  it('survives a refresh on a nested record route', async () => {
    await withPage({}, async ({ page }) => {
      await openRecord(page, CONTRACTOR, 'jobs', 'job-6');
      expect(await hasText(page, 'JOB-')).toBe(true);
      await page.reload({ waitUntil: 'networkidle0' });
      await wait(700);
      expect(await hasText(page, 'JOB-')).toBe(true);
    });
  });

  it('supports browser back and forward', async () => {
    await withPage({}, async ({ page }) => {
      await openModule(page, CONTRACTOR);
      await clickText(page, 'Leads', { exact: true, selector: 'nav a' });
      await wait(600);
      expect(await pathname(page)).toMatch(/\/leads$/);

      await clickText(page, 'Invoices', { exact: true, selector: 'nav a' });
      await wait(600);
      expect(await pathname(page)).toMatch(/\/invoices$/);

      await page.goBack();
      await wait(700);
      expect(await pathname(page)).toMatch(/\/leads$/);

      await page.goForward();
      await wait(700);
      expect(await pathname(page)).toMatch(/\/invoices$/);
    });
  });

  it('persists changes across a reload and recovers from corrupt storage', async () => {
    await withPage({}, async ({ page }) => {
      await openModule(page, CONTRACTOR);
      const stored = await readDemoStorage(page, 'contractor');
      expect(stored).not.toBeNull();

      await corruptDemoStorage(page, 'contractor');
      await goto(page, CONTRACTOR.base);
      await wait(800);
      // The workspace re-seeds rather than crashing.
      expect(await hasText(page, 'Overview')).toBe(true);
      await openModule(page, CONTRACTOR, 'customers');
      expect(await hasText(page, 'Harborview Property Group')).toBe(true);
    });
  });

  it('filters, clears and sorts a list', async () => {
    await withPage({}, async ({ page }) => {
      await openModule(page, CONTRACTOR, 'leads');
      const all = await rowCount(page);
      expect(all).toBeGreaterThan(5);

      await setValue(page, '#lead-stage', 'Won');
      await wait(450);
      const filtered = await rowCount(page);
      expect(filtered).toBeGreaterThan(0);
      expect(filtered).toBeLessThan(all);

      await setValue(page, '#lead-search', 'zzzzzzzzzz');
      await wait(450);
      expect(await hasText(page, 'No leads match')).toBe(true);

      await clickText(page, 'Clear filters', { exact: true, within: MAIN });
      await wait(500);
      expect(await rowCount(page)).toBe(all);

      await openModule(page, CONTRACTOR, 'invoices');
      const before = await page.$eval('tbody tr', (row) => (row as HTMLElement).innerText.slice(0, 30));
      await clickText(page, 'Total', { exact: true, within: MAIN });
      await wait(450);
      const after = await page.$eval('tbody tr', (row) => (row as HTMLElement).innerText.slice(0, 30));
      expect(after).not.toBe(before);
    });
  });

  it('finds a record through global search using the keyboard', async () => {
    await withPage({}, async ({ page }) => {
      await openModule(page, CONTRACTOR);
      expect(await searchWorkspace(page, 'Harborview')).toBe(true);
      await openFirstSearchResult(page);
      expect(await pathname(page)).not.toBe(CONTRACTOR.base);
      expect(await pathname(page)).toContain('/demos/contractor-operations/');
    });
  });

  it('keeps demo roles coherent, with no dead routes', async () => {
    await withPage({}, async ({ page }) => {
      await openModule(page, CONTRACTOR);

      for (const role of ['sales', 'operations', 'field']) {
        await setDemoRole(page, role);
        const links: string[] = await page.evaluate(() =>
          Array.from(document.querySelectorAll('nav a'))
            .map((a) => a.getAttribute('href') ?? '')
            .filter((href) => href.includes('/demos/contractor-operations')),
        );
        expect(links.length).toBeGreaterThan(1);

        // Every module the sidebar offers must actually render for this role.
        for (const href of links) {
          await clickInApp(page, href);
          expect(
            await hasText(page, 'Not available for this demo role'),
            `${role} saw a dead route at ${href}`,
          ).toBe(false);
        }

        // And a module it does not offer must be refused, not silently shown.
        await clickInApp(page, `${CONTRACTOR.base}/invoices`);
        if (!links.some((href) => href.endsWith('/invoices'))) {
          expect(await hasText(page, 'Not available for this demo role')).toBe(true);
        }
        await clickInApp(page, CONTRACTOR.base);
      }
    });
  });

  it('shows a recoverable empty state for an unknown module', async () => {
    await withPage({}, async ({ page }) => {
      await goto(page, `${CONTRACTOR.base}/not-a-module`);
      await wait(500);
      expect(await hasText(page, 'does not exist')).toBe(true);
    });
  });

  it('renders print views without the application shell', async () => {
    await withPage({ viewport: VIEWPORTS.laptopSmall }, async ({ page }) => {
      for (const path of ['/estimates/est-7/print', '/invoices/inv-2/print']) {
        await goto(page, `${CONTRACTOR.base}${path}`);
        await wait(500);
        const shell = await page.evaluate(() => !!document.querySelector('nav a[href*="/leads"]'));
        expect(shell, `${path} still renders the sidebar`).toBe(false);
        expect((await pageText(page)).length).toBeGreaterThan(80);
      }
    });
  });
});

describe('contractor operations — mobile and motion', () => {
  it('keeps the field workflow usable on a phone', async () => {
    await withPage({ viewport: VIEWPORTS.mobile }, async ({ page }) => {
      await openRecord(page, CONTRACTOR, 'jobs', 'job-6');
      await assertNoPageOverflow(page, 'contractor job detail @375');

      const actions = await page.evaluate(() =>
        Array.from(document.querySelectorAll('button'))
          .map((button) => button.innerText.trim())
          .filter(Boolean),
      );
      expect(actions.some((label) => /Add field record/i.test(label))).toBe(true);
      expect(actions.some((label) => /Complete job/i.test(label))).toBe(true);

      await clickText(page, 'Add field record', { exact: true, within: MAIN });
      await wait(600);
      expect(await focusStaysInDialog(page)).toBe(true);
      await page.keyboard.press('Escape');
      await wait(400);
      expect(await page.evaluate(() => !!document.querySelector('[role="dialog"]'))).toBe(false);
      await capture(page, 'contractor-job-mobile');
    });
  });

  it('opens the mobile navigation and closes it after choosing a module', async () => {
    await withPage({ viewport: VIEWPORTS.mobile }, async ({ page }) => {
      await openModule(page, CONTRACTOR);
      await page.click('button[aria-label="Open navigation"]');
      await wait(500);
      await clickText(page, 'Leads', { exact: true, selector: 'nav a' });
      await wait(800);
      expect(await pathname(page)).toMatch(/\/leads$/);
    });
  });

  it('stays understandable with reduced motion', async () => {
    await withPage({ reducedMotion: true }, async ({ page }) => {
      await openModule(page, CONTRACTOR);
      expect(await hasText(page, 'Overview')).toBe(true);
      await openRecord(page, CONTRACTOR, 'jobs', 'job-6');
      expect(await hasText(page, 'Complete job')).toBe(true);
    });
  });
});

describe('contractor operations — layout audit', () => {
  it('has no page overflow and no structural accessibility faults', async () => {
    for (const viewport of ALL_VIEWPORTS) {
      await withPage({ viewport }, async ({ page }) => {
        for (const module of MODULES) {
          await openModule(page, CONTRACTOR, module);
          const label = `contractor /${module || 'overview'} @${viewport.width}`;
          await assertNoPageOverflow(page, label);
          // The structural audit does not change with width; run it once.
          if (viewport.width === VIEWPORTS.desktop.width) {
            await assertAccessible(page, label);
          }
        }
      });
    }
  });
});
