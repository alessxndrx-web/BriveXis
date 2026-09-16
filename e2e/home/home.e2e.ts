import { afterAll, describe, expect, it } from 'vitest';
import { closeBrowser, withPage } from '../helpers/browser';
import { VIEWPORTS } from '../helpers/viewport';
import { clickText, goto, hasText, pageText, pathname, wait } from '../helpers/navigation';
import { assertNoPageOverflow } from '../helpers/overflow';
import { assertAccessible, focusedName } from '../helpers/accessibility';
import { capture } from '../helpers/screenshots';
import { demos } from '../../src/data/demos';

/**
 * Marketing site behaviour.
 *
 * These cover what a visitor does before they reach a demo: navigating the
 * page, opening a demo, and the routes around it. The demo catalogue
 * expectations are derived from `src/data/demos.ts` rather than hard-coded, so
 * shipping a demo updates the test's expectation with it.
 */

// Read from the catalogue rather than restated here: the Home section is driven
// by `status`, so shipping a demo must update this expectation with it.
const LIVE_DEMOS = demos.filter((demo) => demo.status === 'live').map((demo) => demo.title);
const PREVIEW_DEMOS = demos.filter((demo) => demo.status === 'preview').map((demo) => demo.title);

afterAll(async () => {
  await closeBrowser();
});

describe('home', () => {
  it('loads, is accessible and reports no browser problems', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await goto(page, '/');
      expect(await hasText(page, 'BriveXis')).toBe(true);
      await assertAccessible(page, 'home');
      await assertNoPageOverflow(page, 'home @1440');
      await capture(page, 'home-desktop');
    });
  });

  it('carries the metadata search engines read', async () => {
    await withPage({}, async ({ page }) => {
      await goto(page, '/');
      const meta = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '',
        ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? '',
        structured: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).length,
      }));

      expect(meta.title).toContain('BriveXis');
      expect(meta.description.length).toBeGreaterThan(50);
      expect(meta.canonical).toMatch(/^https?:\/\//);
      expect(meta.ogTitle.length).toBeGreaterThan(0);
      expect(meta.structured).toBeGreaterThan(0);
    });
  });

  it('resolves every in-page anchor used by the navigation', async () => {
    await withPage({}, async ({ page }) => {
      await goto(page, '/');
      const missing = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href^="/#"], a[href^="#"]'))
          .map((a) => (a.getAttribute('href') ?? '').split('#')[1])
          .filter(Boolean)
          .filter((id) => !document.getElementById(id!)),
      );
      expect(missing).toEqual([]);
    });
  });

  it('navigates from the header to a section', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await goto(page, '/');
      await clickText(page, 'Industries', { exact: true, within: 'header' });
      await wait(900);
      const hash = await page.evaluate(() => window.location.hash);
      expect(hash).toBe('#industries');
    });
  });

  it('switches the Industries tabs', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await goto(page, '/#industries');
      await wait(600);
      await clickText(page, 'Distribution', { selector: '[role="tab"]' });
      await wait(500);
      const selected = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[role="tab"]'))
          .filter((tab) => tab.getAttribute('aria-selected') === 'true')
          .map((tab) => (tab as HTMLElement).innerText.replace(/\s+/g, ' ').trim()),
      );
      expect(selected.join(' ')).toMatch(/Distribution/);
    });
  });

  it('opens and closes an FAQ answer', async () => {
    await withPage({}, async ({ page }) => {
      await goto(page, '/#faq');
      await wait(500);
      // Scoped to the FAQ: the header's menu toggle also carries aria-expanded.
      // The accordion opens its first answer by default, so the test toggles
      // from whatever the initial state is rather than assuming one.
      const question = '#faq button[aria-expanded]';
      await page.waitForSelector(question, { visible: true });
      const expanded = () => page.$eval(question, (el) => el.getAttribute('aria-expanded'));

      const before = await expanded();
      await page.click(question);
      // React commits the state change on the next tick, so read after it lands.
      await wait(450);
      const toggled = await expanded();
      expect(toggled).not.toBe(before);

      await page.click(question);
      await wait(450);
      expect(await expanded()).toBe(before);
    });
  });

  it('opens the mobile menu, navigates and returns focus on Escape', async () => {
    await withPage({ viewport: VIEWPORTS.mobile }, async ({ page }) => {
      await goto(page, '/');

      const toggle = 'header button[aria-expanded]';
      await page.waitForSelector(toggle, { visible: true });
      await page.click(toggle);
      await wait(500);
      expect(await page.$eval(toggle, (el) => el.getAttribute('aria-expanded'))).toBe('true');

      // Escape closes it and hands focus back to the control that opened it.
      await page.keyboard.press('Escape');
      await wait(400);
      expect(await page.$eval(toggle, (el) => el.getAttribute('aria-expanded'))).toBe('false');
      expect(await focusedName(page)).toMatch(/menu/i);

      await page.click(toggle);
      await wait(400);
      await clickText(page, 'Process', { exact: true, within: '#mobile-navigation' });
      await wait(800);
      expect(await page.$eval(toggle, (el) => el.getAttribute('aria-expanded'))).toBe('false');
      await assertNoPageOverflow(page, 'home @375');
    });
  });

  it('shows Launch Demo only for demos that are live', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await goto(page, '/#demos');
      await wait(700);

      const cards = await page.evaluate(() => {
        const result: { title: string; launch: boolean; soon: boolean; href: string | null }[] = [];
        for (const heading of Array.from(document.querySelectorAll('h3'))) {
          const article = heading.closest('article');
          if (!article) continue;
          const text = article.innerText.replace(/\s+/g, ' ');
          result.push({
            title: heading.innerText.trim(),
            launch: text.includes('Launch Demo'),
            soon: text.includes('Preview coming soon'),
            href: article.querySelector('a[href*="/demos/"]')?.getAttribute('href') ?? null,
          });
        }
        return result;
      });

      for (const title of LIVE_DEMOS) {
        const card = cards.find((entry) => entry.title === title);
        expect(card, `${title} card is missing`).toBeDefined();
        expect(card!.launch, `${title} should offer Launch Demo`).toBe(true);
        expect(card!.href).toMatch(/^\/demos\//);
      }

      for (const title of PREVIEW_DEMOS) {
        const card = cards.find((entry) => entry.title === title);
        expect(card, `${title} card is missing`).toBeDefined();
        expect(card!.soon, `${title} should still read Preview coming soon`).toBe(true);
        expect(card!.launch).toBe(false);
      }
    });
  });

  it('does not download any demo bundle until one is opened', async () => {
    await withPage({}, async ({ page }) => {
      const requested: string[] = [];
      page.on('request', (request) => requested.push(request.url()));
      await goto(page, '/');
      await wait(800);
      expect(requested.some((entry) => /ContractorApp/.test(entry))).toBe(false);
      expect(requested.some((entry) => /DealerApp/.test(entry))).toBe(false);
    });
  });

  it('launches a demo and comes back', async () => {
    await withPage({ viewport: VIEWPORTS.desktop }, async ({ page }) => {
      await goto(page, '/#demos');
      await wait(700);
      await clickText(page, 'Launch Demo', { selector: 'a' });
      await wait(1800);
      expect(await pathname(page)).toMatch(/^\/demos\//);

      await clickText(page, 'Back to BriveXis', { selector: 'a' });
      await wait(1200);
      expect(await pathname(page)).toBe('/');
    });
  });

  it('serves the privacy route and a 404 for anything unknown', async () => {
    await withPage({}, async ({ page }) => {
      await goto(page, '/privacy');
      expect(await hasText(page, 'Privacy')).toBe(true);

      await goto(page, '/this-route-does-not-exist');
      const text = await pageText(page);
      expect(/not found|404/i.test(text)).toBe(true);
    });
  });

  it('remains usable with reduced motion', async () => {
    await withPage({ reducedMotion: true, viewport: VIEWPORTS.laptop }, async ({ page }) => {
      await goto(page, '/');
      await wait(600);
      // Reveal animations must not leave content invisible when they never run.
      const hidden = await page.evaluate(() => {
        const main = document.querySelector('main');
        if (!main) return 'no main';
        const headings = Array.from(main.querySelectorAll('h2'));
        const invisible = headings.filter((h) => Number(window.getComputedStyle(h).opacity) < 0.9);
        return invisible.length;
      });
      expect(hidden).toBe(0);
    });
  });
});
