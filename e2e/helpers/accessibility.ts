import type { Page } from 'puppeteer-core';

/**
 * Structural accessibility checks.
 *
 * These are the defects that a full audit tool would also flag but that can be
 * detected cheaply and deterministically from the DOM: a duplicate id silently
 * re-points a `<label for>` at the wrong control, an unlabelled input is
 * unusable with a screen reader, and a heading that skips a level breaks
 * document navigation. They run on every screen the suites visit, which is what
 * keeps them from regressing.
 */

export interface AccessibilityReport {
  duplicateIds: string[];
  unlabelledControls: string[];
  namelessControls: string[];
  imagesWithoutAlt: string[];
  headingLevels: number[];
  h1Count: number;
  headingSkips: string[];
}

export async function auditAccessibility(page: Page): Promise<AccessibilityReport> {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const style = window.getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') return false;
      return (el as HTMLElement).offsetParent !== null || style.position === 'fixed';
    };

    const counts = new Map<string, number>();
    for (const el of Array.from(document.querySelectorAll('[id]'))) {
      counts.set(el.id, (counts.get(el.id) ?? 0) + 1);
    }
    const duplicateIds = Array.from(counts.entries())
      .filter(([, n]) => n > 1)
      .map(([id, n]) => `${id} (x${n})`);

    const named = (el: Element) => {
      if (el.getAttribute('aria-label')?.trim()) return true;
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy && labelledBy.split(/\s+/).some((id) => document.getElementById(id))) return true;
      return false;
    };

    const unlabelledControls = Array.from(
      document.querySelectorAll('input, select, textarea'),
    )
      .filter(visible)
      .filter((el) => (el as HTMLInputElement).type !== 'hidden')
      .filter((el) => {
        if (named(el)) return false;
        if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return false;
        return !el.closest('label');
      })
      .map((el) => `${el.tagName}#${el.id || '(no id)'}[name=${(el as HTMLInputElement).name || ''}]`);

    const namelessControls = Array.from(document.querySelectorAll('button, a'))
      .filter(visible)
      .filter((el) => {
        const text = ((el as HTMLElement).innerText || '').trim();
        if (text) return false;
        if (named(el)) return false;
        if ((el as HTMLElement).title?.trim()) return false;
        // An icon-only control is named when it wraps titled SVG content.
        return !el.querySelector('title');
      })
      .map((el) => `${el.tagName}.${(el.className?.toString() ?? '').slice(0, 50)}`);

    const imagesWithoutAlt = Array.from(document.querySelectorAll('img'))
      .filter((img) => !img.hasAttribute('alt'))
      .map((img) => img.getAttribute('src') ?? '(no src)');

    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .filter(visible)
      .map((el) => Number(el.tagName[1]));

    const headingSkips: string[] = [];
    for (let i = 1; i < headings.length; i += 1) {
      if (headings[i] - headings[i - 1] > 1) headingSkips.push(`h${headings[i - 1]} → h${headings[i]}`);
    }

    return {
      duplicateIds,
      unlabelledControls,
      namelessControls,
      imagesWithoutAlt,
      headingLevels: headings,
      h1Count: headings.filter((level) => level === 1).length,
      headingSkips,
    };
  });
}

/** Throws a single readable error listing every structural problem found. */
export async function assertAccessible(page: Page, context: string): Promise<void> {
  const report = await auditAccessibility(page);
  const failures: string[] = [];

  if (report.duplicateIds.length) failures.push(`duplicate ids: ${report.duplicateIds.join(', ')}`);
  if (report.unlabelledControls.length)
    failures.push(`controls without a label: ${report.unlabelledControls.join(', ')}`);
  if (report.namelessControls.length)
    failures.push(`controls without an accessible name: ${report.namelessControls.join(', ')}`);
  if (report.imagesWithoutAlt.length)
    failures.push(`images without alt: ${report.imagesWithoutAlt.join(', ')}`);
  if (report.h1Count !== 1) failures.push(`expected exactly one h1, found ${report.h1Count}`);
  if (report.headingSkips.length) failures.push(`heading levels skipped: ${report.headingSkips.join(', ')}`);

  if (failures.length) {
    throw new Error(`Accessibility problems on ${context}:\n${failures.map((f) => `  - ${f}`).join('\n')}`);
  }
}

/** True while focus is inside the open dialog after `steps` tab presses. */
export async function focusStaysInDialog(page: Page, steps = 12): Promise<boolean> {
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return !dialog || dialog.contains(document.activeElement);
    });
    if (!inside) return false;
  }
  return true;
}

/** Accessible name of the element that currently has focus. */
export async function focusedName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return '';
    return (el.getAttribute('aria-label') || el.innerText || el.tagName).trim().replace(/\s+/g, ' ');
  });
}
