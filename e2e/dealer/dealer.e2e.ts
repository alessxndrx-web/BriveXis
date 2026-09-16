import { afterAll, describe, expect, it } from 'vitest';
import { closeBrowser, withPage } from '../helpers/browser';
import { ALL_VIEWPORTS, VIEWPORTS } from '../helpers/viewport';
import {
  clickInApp,
  clickText,
  goto,
  hasText,
  isVisible,
  pageText,
  pathname,
  rowCount,
  wait,
} from '../helpers/navigation';
import { assertNoPageOverflow } from '../helpers/overflow';
import { assertAccessible, focusStaysInDialog } from '../helpers/accessibility';
import { setValue } from '../helpers/forms';
import { clearDemoStorage, corruptDemoStorage, readDemoStorage } from '../helpers/storage';
import {
  DEALER,
  DIALOG,
  MAIN,
  assertDemoNotice,
  confirmDialog,
  openFirstSearchResult,
  openModule,
  openRecord,
  quickCreate,
  resetDemo,
  searchWorkspace,
  setDemoRole,
} from '../helpers/demoApp';
import { capture } from '../helpers/screenshots';

/**
 * Dealer Operations.
 *
 * The centre of this file is the lifecycle a dealership actually runs: a lead
 * picks a vehicle, becomes a customer, reserves the car with a deposit, turns
 * into a deal with paperwork and financing, closes, and gets delivered. It is
 * one test because each step genuinely depends on the last.
 *
 * The edge cases are separate, because what they check is the opposite: that
 * the workspace refuses to do the wrong thing.
 */

const MODULES = [
  '',
  'leads',
  'customers',
  'inventory',
  'reservations',
  'deals',
  'financing',
  'payments',
  'documents',
  'tasks',
  'reports',
  'settings',
];

/** Reads the stock number of the first available vehicle on the lot. */
async function firstAvailableVehicle(page: import('puppeteer-core').Page): Promise<string> {
  await openModule(page, DEALER, 'inventory');
  await setValue(page, '#inventory-status', 'In Stock');
  await wait(450);
  const code = await page.$eval('tbody tr', (row) => {
    const text = (row as HTMLElement).innerText;
    const match = text.match(/STK-\d+/);
    return match ? match[0] : '';
  });
  expect(code, 'no in-stock vehicle found').toMatch(/^STK-\d+$/);
  return code;
}

afterAll(async () => {
  await closeBrowser();
});

describe('dealer operations — lifecycle', () => {
  it('runs lead → reservation → deal → financing → close → delivery, then resets', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await goto(page, DEALER.base);
      await clearDemoStorage(page, 'dealer');
      await goto(page, DEALER.base);
      await assertDemoNotice(page, DEALER);

      const stock = await firstAvailableVehicle(page);

      // --- lead, with a vehicle of interest -------------------------------
      await openModule(page, DEALER);
      await quickCreate(page, 'Lead');
      await setValue(page, '#lead-name', 'Imogen Radcliffe');
      await setValue(page, '#lead-phone', '(303) 555-0199');
      await setValue(page, '#lead-email', 'imogen.radcliffe@example.com');
      await setValue(page, '#lead-source', 'Website');
      await setValue(page, '#lead-budget-min', '20000');
      await setValue(page, '#lead-budget-max', '30000');
      await setValue(page, '#lead-notes', 'Wants something with all-wheel drive.');

      // Pick the vehicle by its stock number, so the test follows the lot.
      const vehicleValue = await page.evaluate((code: string) => {
        const select = document.querySelector<HTMLSelectElement>('#lead-vehicle');
        const option = Array.from(select?.options ?? []).find((entry) =>
          entry.text.startsWith(code),
        );
        return option?.value ?? '';
      }, stock);
      expect(vehicleValue, `${stock} was not offered on the lead form`).toBeTruthy();
      await setValue(page, '#lead-vehicle', vehicleValue);

      await confirmDialog(page, 'Create lead');
      expect(await pathname(page)).toContain('/leads/');
      expect(await hasText(page, 'Imogen Radcliffe')).toBe(true);
      expect(await hasText(page, stock)).toBe(true);

      // --- move the lead along -------------------------------------------
      await clickText(page, 'Contacted', { exact: true, within: MAIN });
      await wait(400);
      await clickText(page, 'Vehicle Selected', { exact: true, within: MAIN });
      await wait(400);
      expect(await hasText(page, 'Vehicle Selected')).toBe(true);

      // --- convert to a customer ------------------------------------------
      await clickText(page, 'Convert to customer', { exact: true, within: MAIN });
      await wait(500);
      await setValue(page, '#customer-address-line1', '1180 Kipling St');
      await setValue(page, '#customer-address-city', 'Lakewood');
      await setValue(page, '#customer-address-state', 'CO');
      await setValue(page, '#customer-address-zip', '80215');
      await confirmDialog(page, 'Create customer');
      expect(await pathname(page)).toContain('/customers/');
      expect(await hasText(page, 'Imogen Radcliffe')).toBe(true);

      // --- reservation ----------------------------------------------------
      await clickText(page, 'New reservation', { exact: true, within: MAIN });
      await wait(600);
      const reservationVehicle = await page.evaluate((code: string) => {
        const select = document.querySelector<HTMLSelectElement>('#reservation-vehicle');
        const option = Array.from(select?.options ?? []).find((entry) => entry.text.startsWith(code));
        return option?.value ?? '';
      }, stock);
      expect(reservationVehicle).toBeTruthy();
      await setValue(page, '#reservation-vehicle', reservationVehicle);
      await setValue(page, '#reservation-deposit', '750');
      await confirmDialog(page, 'Create reservation');

      expect(await pathname(page)).toContain('/reservations/');
      const reservationPath = await pathname(page);

      // --- deposit, then confirm -------------------------------------------
      await clickText(page, 'Record deposit', { exact: true, within: MAIN });
      await wait(600);
      await confirmDialog(page, 'Record payment');
      expect(await hasText(page, '$750.00')).toBe(true);

      await clickText(page, 'Confirm reservation', { exact: true, within: MAIN });
      await wait(700);
      expect(await hasText(page, 'Confirmed')).toBe(true);

      // The vehicle is now held and must say so.
      await openModule(page, DEALER, 'inventory');
      await setValue(page, '#inventory-search', stock);
      await wait(500);
      expect(await hasText(page, 'Reserved')).toBe(true);

      // --- documents -------------------------------------------------------
      await clickInApp(page, reservationPath);
      await clickText(page, 'Add document', { exact: true, within: MAIN });
      await wait(500);
      await setValue(page, '#document-status', 'Received');
      await confirmDialog(page, 'Add document');
      expect(await hasText(page, 'Reservation Receipt')).toBe(true);

      // --- deal from the reservation ---------------------------------------
      await clickText(page, 'Create deal', { exact: true, within: MAIN });
      await wait(600);
      await setValue(page, '#deal-plan', 'Financing');
      await setValue(page, '#deal-price', '24000');
      await setValue(page, '#deal-discount', '500');
      await setValue(page, '#deal-down', '3000');
      await confirmDialog(page, 'Create deal');

      expect(await pathname(page)).toContain('/deals/');
      const dealPath = await pathname(page);
      // The deposit already paid follows the reservation onto the deal.
      expect(await hasText(page, '$750.00')).toBe(true);

      // --- financing --------------------------------------------------------
      await clickText(page, 'Open financing', { exact: true, within: MAIN });
      await wait(600);
      await confirmDialog(page, 'Open application');

      await clickText(page, 'FIN-', { within: MAIN, selector: 'a' });
      await wait(700);
      expect(await pathname(page)).toContain('/financing/');
      const financingPath = await pathname(page);

      await clickText(page, 'Record status', { exact: true, within: MAIN });
      await wait(500);
      await setValue(page, '#financing-status', 'Submitted');
      await confirmDialog(page, 'Record status');
      expect(await hasText(page, 'Submitted')).toBe(true);

      await clickText(page, 'Record status', { exact: true, within: MAIN });
      await wait(500);
      await setValue(page, '#financing-status', 'Approved');
      await setValue(page, '#financing-notes', 'Approved at 60 months by the finance desk.');
      await confirmDialog(page, 'Record status');
      expect(await hasText(page, 'Approved')).toBe(true);
      void financingPath;

      // --- remaining documents ---------------------------------------------
      await clickInApp(page, dealPath);
      await clickText(page, 'Documents', { selector: '[role="tab"]' });
      await wait(400);

      // Everything the deal is still missing, added as received.
      for (let i = 0; i < 6; i += 1) {
        const outstanding = await page.evaluate(() => {
          const match = document.body.innerText.match(/Outstanding:\s*([^.]+)\./);
          return match ? match[1].split(',').map((entry) => entry.trim()).filter(Boolean) : [];
        });
        if (outstanding.length === 0) break;

        await clickText(page, 'Add document', { exact: true, within: MAIN });
        await wait(500);
        await setValue(page, '#document-type', outstanding[0]);
        await setValue(page, '#document-status', 'Received');
        await confirmDialog(page, 'Add document');
        await wait(300);
      }
      expect(await hasText(page, 'Everything required is on file')).toBe(true);

      // --- down payment ------------------------------------------------------
      await clickText(page, 'Record payment', { exact: true, within: MAIN });
      await wait(600);
      await setValue(page, '#payment-amount', '3000');
      await confirmDialog(page, 'Record payment');
      await wait(400);

      // --- ready to close ----------------------------------------------------
      await clickText(page, 'Ready to Close', { exact: true, within: MAIN });
      await wait(600);
      expect(await hasText(page, 'Ready to Close')).toBe(true);

      await clickText(page, 'Close deal', { exact: true, within: MAIN });
      await wait(600);
      const confirmBox = await page.$('#close-confirm');
      expect(confirmBox, 'the close dialog has no confirmation checkbox').not.toBeNull();
      await confirmBox!.evaluate((el) => (el as HTMLInputElement).click());
      await wait(200);
      await confirmDialog(page, 'Close deal');
      expect(await hasText(page, 'Closed')).toBe(true);

      // --- the vehicle is sold -----------------------------------------------
      await openModule(page, DEALER, 'inventory');
      await setValue(page, '#inventory-search', stock);
      await wait(500);
      expect(await hasText(page, 'Sold')).toBe(true);

      // --- delivery -----------------------------------------------------------
      await clickInApp(page, dealPath);
      await clickText(page, 'Delivery', { exact: true, within: MAIN });
      await wait(600);
      const checks = await page.$$(`${DIALOG} input[type="checkbox"]`);
      expect(checks.length).toBeGreaterThan(3);
      for (const check of checks) {
        await check.evaluate((el) => {
          const input = el as HTMLInputElement;
          if (!input.checked) input.click();
        });
        await wait(120);
      }
      await setValue(page, '#delivery-notes', 'Handed over at the main lot.');
      await confirmDialog(page, 'Complete delivery');
      await wait(500);
      await clickText(page, 'Delivery', { selector: '[role="tab"]' });
      await wait(400);
      expect(await hasText(page, 'Handed over at the main lot.')).toBe(true);

      await capture(page, 'dealer-deal-delivered');

      // --- the post-sale follow-up exists --------------------------------------
      await openModule(page, DEALER, 'tasks');
      await setValue(page, '#task-search', 'Post-sale');
      await wait(500);
      expect(await rowCount(page)).toBeGreaterThan(0);

      // --- the workspace reflects all of it ------------------------------------
      await openModule(page, DEALER, 'customers');
      expect(await hasText(page, 'Imogen Radcliffe')).toBe(true);
      await openModule(page, DEALER, 'reports');
      expect(await hasText(page, 'Units sold')).toBe(true);
      await openModule(page, DEALER);
      // Metric labels are styled uppercase.
      expect(await hasText(page, 'Sold this month', { ignoreCase: true })).toBe(true);

      // --- reset ----------------------------------------------------------------
      await resetDemo(page);
      await openModule(page, DEALER, 'customers');
      expect(await hasText(page, 'Imogen Radcliffe')).toBe(false);
      expect(await hasText(page, 'Osvaldo Marin')).toBe(true);
      await openModule(page, DEALER, 'leads');
      expect(await hasText(page, 'Imogen Radcliffe')).toBe(false);
    });
  });

  it('closes a cash deal without any financing', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await goto(page, DEALER.base);
      await clearDemoStorage(page, 'dealer');
      await goto(page, DEALER.base);

      const stock = await firstAvailableVehicle(page);

      await quickCreate(page, 'Deal');
      const customerValue = await page.evaluate(() => {
        const select = document.querySelector<HTMLSelectElement>('#deal-customer');
        // The first entry is the "Select a customer" placeholder.
        return select?.options[1]?.value ?? '';
      });
      expect(customerValue, 'the deal form offered no customers').toBeTruthy();
      await setValue(page, '#deal-customer', customerValue);
      await wait(200);
      const vehicleValue = await page.evaluate((code: string) => {
        const select = document.querySelector<HTMLSelectElement>('#deal-vehicle');
        const option = Array.from(select?.options ?? []).find((entry) => entry.text.startsWith(code));
        return option?.value ?? '';
      }, stock);
      await setValue(page, '#deal-vehicle', vehicleValue);
      await setValue(page, '#deal-plan', 'Cash');
      await setValue(page, '#deal-price', '18000');
      await setValue(page, '#deal-discount', '0');
      await confirmDialog(page, 'Create deal');

      const dealPath = await pathname(page);
      expect(dealPath).toContain('/deals/');

      // A cash deal must not ask for a financing application.
      await clickText(page, 'Documents', { selector: '[role="tab"]' });
      await wait(400);
      const outstandingText = await pageText(page);
      expect(outstandingText).not.toContain('Financing Application');

      for (let i = 0; i < 5; i += 1) {
        const outstanding = await page.evaluate(() => {
          const match = document.body.innerText.match(/Outstanding:\s*([^.]+)\./);
          return match ? match[1].split(',').map((entry) => entry.trim()).filter(Boolean) : [];
        });
        if (outstanding.length === 0) break;
        await clickText(page, 'Add document', { exact: true, within: MAIN });
        await wait(500);
        await setValue(page, '#document-type', outstanding[0]);
        await setValue(page, '#document-status', 'Received');
        await confirmDialog(page, 'Add document');
        await wait(300);
      }

      // Paid in full, which is what a cash deal needs.
      await clickText(page, 'Record payment', { exact: true, within: MAIN });
      await wait(600);
      await clickText(page, 'Pay full balance', { exact: true, within: DIALOG });
      await wait(250);
      await confirmDialog(page, 'Record payment');
      await wait(400);

      await clickText(page, 'Close deal', { exact: true, within: MAIN });
      await wait(600);
      const confirmBox = await page.$('#close-confirm');
      await confirmBox!.evaluate((el) => (el as HTMLInputElement).click());
      await wait(200);
      await confirmDialog(page, 'Close deal');
      expect(await hasText(page, 'Closed')).toBe(true);
    });
  });
});

describe('dealer operations — the workspace refuses the wrong thing', () => {
  it('will not reserve a vehicle that is already held', async () => {
    await withPage({}, async ({ page }) => {
      await goto(page, DEALER.base);
      await clearDemoStorage(page, 'dealer');
      await openModule(page, DEALER, 'reservations');

      // A vehicle held by a confirmed reservation is not offered again.
      const held = await page.evaluate(() => {
        const row = Array.from(document.querySelectorAll('tbody tr')).find((entry) =>
          (entry as HTMLElement).innerText.includes('Confirmed'),
        );
        const match = (row as HTMLElement | undefined)?.innerText.match(/STK-\d+/);
        return match ? match[0] : '';
      });
      expect(held).toMatch(/^STK-\d+$/);

      await clickText(page, 'New reservation', { exact: true, within: MAIN });
      await wait(600);
      const offered = await page.evaluate(
        (code: string) =>
          Array.from(document.querySelectorAll<HTMLOptionElement>('#reservation-vehicle option')).some(
            (option) => option.text.startsWith(code),
          ),
        held,
      );
      expect(offered, `${held} is held but was still offered for reservation`).toBe(false);
    });
  });

  it('will not reserve a vehicle that has been sold', async () => {
    await withPage({}, async ({ page }) => {
      await goto(page, DEALER.base);
      await clearDemoStorage(page, 'dealer');
      await openModule(page, DEALER, 'inventory');
      await setValue(page, '#inventory-status', 'Sold');
      await wait(500);

      const sold = await page.evaluate(() => {
        const match = (document.querySelector('tbody tr') as HTMLElement | null)?.innerText.match(/STK-\d+/);
        return match ? match[0] : '';
      });
      expect(sold).toMatch(/^STK-\d+$/);

      await openModule(page, DEALER, 'reservations');
      await clickText(page, 'New reservation', { exact: true, within: MAIN });
      await wait(600);
      const offered = await page.evaluate(
        (code: string) =>
          Array.from(document.querySelectorAll<HTMLOptionElement>('#reservation-vehicle option')).some(
            (option) => option.text.startsWith(code),
          ),
        sold,
      );
      expect(offered, `${sold} is sold but was still offered for reservation`).toBe(false);
    });
  });

  it('releases the vehicle when a reservation is cancelled', async () => {
    await withPage({}, async ({ page }) => {
      await goto(page, DEALER.base);
      await clearDemoStorage(page, 'dealer');
      await openRecord(page, DEALER, 'reservations', 'res-2');
      expect(await hasText(page, 'Confirmed')).toBe(true);

      const stock = await page.evaluate(() => {
        const match = document.body.innerText.match(/STK-\d+/);
        return match ? match[0] : '';
      });

      await clickText(page, 'Cancel', { exact: true, within: MAIN });
      await wait(500);
      await confirmDialog(page, 'Cancel reservation');
      expect(await hasText(page, 'Cancelled')).toBe(true);

      await openModule(page, DEALER, 'inventory');
      await setValue(page, '#inventory-search', stock);
      await wait(500);
      expect(await hasText(page, 'In Stock')).toBe(true);
    });
  });

  it('rejects a payment larger than the balance', async () => {
    await withPage({}, async ({ page }) => {
      await goto(page, DEALER.base);
      await clearDemoStorage(page, 'dealer');
      await openRecord(page, DEALER, 'deals', 'deal-7');

      await clickText(page, 'Record payment', { exact: true, within: MAIN });
      await wait(600);
      await setValue(page, '#payment-amount', '99999999');
      await clickText(page, 'Record payment', { exact: true, within: DIALOG });
      await wait(500);

      // The dialog stays open and says why.
      expect(await page.evaluate(() => !!document.querySelector('[role="dialog"]'))).toBe(true);
      expect(await hasText(page, 'more than the')).toBe(true);
    });
  });

  it('will not close a deal while something is outstanding', async () => {
    await withPage({}, async ({ page }) => {
      await goto(page, DEALER.base);
      await clearDemoStorage(page, 'dealer');
      await openRecord(page, DEALER, 'deals', 'deal-5');

      expect(await hasText(page, 'Before this deal can close')).toBe(true);

      await clickText(page, 'Close deal', { exact: true, within: MAIN });
      await wait(600);
      const confirmBox = await page.$('#close-confirm');
      await confirmBox!.evaluate((el) => (el as HTMLInputElement).click());
      await wait(200);

      // The confirm button stays disabled while blockers remain.
      const disabled = await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
          (entry) => (entry as HTMLElement).innerText.trim() === 'Close deal',
        );
        return (button as HTMLButtonElement | undefined)?.disabled ?? null;
      });
      expect(disabled).toBe(true);

      await page.keyboard.press('Escape');
      await wait(400);
      expect(await hasText(page, 'Closed')).toBe(false);
    });
  });

  it('never approves financing on its own', async () => {
    await withPage({}, async ({ page }) => {
      await goto(page, DEALER.base);
      await clearDemoStorage(page, 'dealer');
      await openRecord(page, DEALER, 'financing', 'fin-5');

      const text = await pageText(page);
      expect(text).toContain('no real credit decision or financing submission is performed');
      expect(text).toContain('It does not assess credit or produce a score.');
      // Submitted stays submitted until somebody records otherwise.
      expect(await hasText(page, 'Submitted')).toBe(true);
    });
  });
});

describe('dealer operations — navigation and state', () => {
  it('survives a refresh on a nested record route', async () => {
    await withPage({}, async ({ page }) => {
      await openRecord(page, DEALER, 'inventory', 'veh-1');
      expect(await hasText(page, 'STK-')).toBe(true);
      await page.reload({ waitUntil: 'networkidle0' });
      await wait(700);
      expect(await hasText(page, 'STK-')).toBe(true);
    });
  });

  it('supports browser back and forward', async () => {
    await withPage({}, async ({ page }) => {
      await openModule(page, DEALER);
      await clickText(page, 'Inventory', { exact: true, selector: 'nav a' });
      await wait(600);
      expect(await pathname(page)).toMatch(/\/inventory$/);

      await clickText(page, 'Deals', { exact: true, selector: 'nav a' });
      await wait(600);
      expect(await pathname(page)).toMatch(/\/deals$/);

      await page.goBack();
      await wait(700);
      expect(await pathname(page)).toMatch(/\/inventory$/);

      await page.goForward();
      await wait(700);
      expect(await pathname(page)).toMatch(/\/deals$/);
    });
  });

  it('persists changes and recovers from corrupt storage', async () => {
    await withPage({}, async ({ page }) => {
      await openModule(page, DEALER);
      expect(await readDemoStorage(page, 'dealer')).not.toBeNull();

      await corruptDemoStorage(page, 'dealer');
      await goto(page, DEALER.base);
      await wait(800);
      expect(await hasText(page, 'Overview')).toBe(true);
      await openModule(page, DEALER, 'inventory');
      expect(await rowCount(page)).toBeGreaterThan(20);
    });
  });

  it('filters, clears and sorts inventory', async () => {
    await withPage({}, async ({ page }) => {
      await goto(page, DEALER.base);
      await clearDemoStorage(page, 'dealer');
      await openModule(page, DEALER, 'inventory');
      const all = await rowCount(page);
      expect(all).toBeGreaterThan(20);

      await setValue(page, '#inventory-type', 'Motorcycle');
      await wait(450);
      const bikes = await rowCount(page);
      expect(bikes).toBeGreaterThan(0);
      expect(bikes).toBeLessThan(all);

      await setValue(page, '#inventory-search', 'zzzzzzzz');
      await wait(450);
      expect(await hasText(page, 'No vehicles match')).toBe(true);

      await clickText(page, 'Clear filters', { exact: true, within: MAIN });
      await wait(500);
      expect(await rowCount(page)).toBe(all);

      const before = await page.$eval('tbody tr', (row) => (row as HTMLElement).innerText.slice(0, 30));
      await clickText(page, 'Price', { exact: true, within: MAIN });
      await wait(450);
      const after = await page.$eval('tbody tr', (row) => (row as HTMLElement).innerText.slice(0, 30));
      expect(after).not.toBe(before);
    });
  });

  it('finds a vehicle by stock number through global search', async () => {
    await withPage({}, async ({ page }) => {
      await openModule(page, DEALER);
      expect(await searchWorkspace(page, 'STK-2001')).toBe(true);
      await openFirstSearchResult(page);
      expect(await pathname(page)).toContain('/demos/dealer-operations/');
      expect(await pathname(page)).not.toBe(DEALER.base);
    });
  });

  it('keeps every demo role coherent, with no dead routes', async () => {
    await withPage({}, async ({ page }) => {
      await openModule(page, DEALER);

      for (const role of ['sales', 'sales_manager', 'finance', 'operations']) {
        await setDemoRole(page, role);
        const links: string[] = await page.evaluate(() =>
          Array.from(document.querySelectorAll('nav a'))
            .map((a) => a.getAttribute('href') ?? '')
            .filter((href) => href.includes('/demos/dealer-operations')),
        );
        expect(links.length, `${role} has no navigation`).toBeGreaterThan(1);

        for (const href of links) {
          await clickInApp(page, href);
          expect(
            await hasText(page, 'Not available for this demo role'),
            `${role} saw a dead route at ${href}`,
          ).toBe(false);
        }

        // A module the role does not offer must be refused, not silently shown.
        if (!links.some((href) => href.endsWith('/financing'))) {
          await clickInApp(page, `${DEALER.base}/financing`);
          expect(await hasText(page, 'Not available for this demo role')).toBe(true);
        }
        await clickInApp(page, DEALER.base);
      }
    });
  });

  it('reserves closing a deal for the roles that should have it', async () => {
    await withPage({}, async ({ page }) => {
      await openRecord(page, DEALER, 'deals', 'deal-7');
      expect(await isVisible(page, 'Close deal', { exact: true, within: MAIN })).toBe(true);

      await setDemoRole(page, 'sales_manager');
      await clickInApp(page, `${DEALER.base}/deals/deal-7`);
      expect(await isVisible(page, 'Close deal', { exact: true, within: MAIN })).toBe(true);

      // Sales has no Deals module at all, which is the stronger separation.
      await setDemoRole(page, 'sales');
      await clickInApp(page, `${DEALER.base}/deals/deal-7`);
      expect(await hasText(page, 'Not available for this demo role')).toBe(true);
    });
  });

  it('shows a recoverable empty state for an unknown module', async () => {
    await withPage({}, async ({ page }) => {
      await goto(page, `${DEALER.base}/not-a-module`);
      await wait(500);
      expect(await hasText(page, 'does not exist')).toBe(true);
    });
  });

  it('renders print views without the application shell', async () => {
    await withPage({ viewport: VIEWPORTS.laptopSmall }, async ({ page }) => {
      for (const path of ['/deals/deal-1/print', '/reservations/res-1/print', '/payments/pay-1/print']) {
        await goto(page, `${DEALER.base}${path}`);
        await wait(500);
        const shell = await page.evaluate(() => !!document.querySelector('nav a[href*="/inventory"]'));
        expect(shell, `${path} still renders the sidebar`).toBe(false);
        expect((await pageText(page)).length).toBeGreaterThan(80);
      }
      // The deal document must not call itself a binding order.
      await goto(page, `${DEALER.base}/deals/deal-1/print`);
      await wait(400);
      // The letterhead styles the label uppercase.
      expect(await hasText(page, 'Demo Deal Summary', { ignoreCase: true })).toBe(true);
    });
  });
});

describe('dealer operations — mobile and motion', () => {
  it('keeps the reservation flow usable on a phone', async () => {
    await withPage({ viewport: VIEWPORTS.mobile }, async ({ page }) => {
      await goto(page, DEALER.base);
      await clearDemoStorage(page, 'dealer');
      await openRecord(page, DEALER, 'reservations', 'res-3');
      await assertNoPageOverflow(page, 'dealer reservation @375');

      const actions = await page.evaluate(() =>
        Array.from(document.querySelectorAll('button'))
          .map((button) => button.innerText.trim())
          .filter(Boolean),
      );
      expect(actions.some((label) => /Record deposit/i.test(label))).toBe(true);
      expect(actions.some((label) => /Confirm reservation/i.test(label))).toBe(true);

      await clickText(page, 'Record deposit', { exact: true, within: MAIN });
      await wait(600);
      expect(await focusStaysInDialog(page)).toBe(true);
      await page.keyboard.press('Escape');
      await wait(400);
      expect(await page.evaluate(() => !!document.querySelector('[role="dialog"]'))).toBe(false);
      await capture(page, 'dealer-reservation-mobile');
    });
  });

  it('opens the mobile navigation and closes it after choosing a module', async () => {
    await withPage({ viewport: VIEWPORTS.mobile }, async ({ page }) => {
      await openModule(page, DEALER);
      await page.click('button[aria-label="Open navigation"]');
      await wait(500);
      await clickText(page, 'Inventory', { exact: true, selector: 'nav a' });
      await wait(800);
      expect(await pathname(page)).toMatch(/\/inventory$/);
    });
  });

  it('stays understandable with reduced motion', async () => {
    await withPage({ reducedMotion: true }, async ({ page }) => {
      await openModule(page, DEALER);
      expect(await hasText(page, 'Overview')).toBe(true);
      await openRecord(page, DEALER, 'deals', 'deal-7');
      expect(await hasText(page, 'Close deal')).toBe(true);
    });
  });
});

describe('dealer operations — layout audit', () => {
  it('has no page overflow and no structural accessibility faults', async () => {
    for (const viewport of ALL_VIEWPORTS) {
      await withPage({ viewport }, async ({ page }) => {
        for (const module of MODULES) {
          await openModule(page, DEALER, module);
          const label = `dealer /${module || 'overview'} @${viewport.width}`;
          await assertNoPageOverflow(page, label);
          if (viewport.width === VIEWPORTS.desktop.width) {
            await assertAccessible(page, label);
          }
        }

        // The detail screens carry the densest layouts.
        for (const record of ['inventory/veh-1', 'deals/deal-5', 'reservations/res-1', 'leads/lead-1']) {
          await goto(page, `${DEALER.base}/${record}`);
          await wait(350);
          await assertNoPageOverflow(page, `dealer /${record} @${viewport.width}`);
        }
      });
    }
  });
});
