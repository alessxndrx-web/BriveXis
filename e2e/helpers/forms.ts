import type { Page } from 'puppeteer-core';

/**
 * Form interaction.
 *
 * React owns the value of every control in these applications, so assigning to
 * `element.value` would update the DOM and leave React's state behind. Writing
 * through the native setter and then dispatching the events React listens for
 * is what makes the change real.
 */

export async function setValue(page: Page, selector: string, value: string | number): Promise<void> {
  await page.waitForSelector(selector, { visible: true, timeout: 10_000 });
  const rejected = await page.$eval(
    selector,
    (element, next) => {
      // A `<select>` silently accepts a value no option carries: the element
      // ends up with no selection and the application is handed an empty
      // string. That reads as a puzzling validation failure several steps
      // later, so it is reported here instead.
      if (element instanceof HTMLSelectElement) {
        const options = Array.from(element.options).map((option) => option.value);
        if (!options.includes(next)) return options;
      }

      const prototype =
        element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : element instanceof HTMLSelectElement
            ? HTMLSelectElement.prototype
            : HTMLInputElement.prototype;

      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      setter?.call(element, next);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return null;
    },
    String(value),
  );

  if (rejected) {
    throw new Error(
      `"${value}" is not an option of ${selector}. Available: ${rejected.join(', ') || '(none)'}.`,
    );
  }
}

/** Types into a control the way a person would, for fields that react per key. */
export async function typeValue(page: Page, selector: string, value: string): Promise<void> {
  const element = await page.waitForSelector(selector, { visible: true, timeout: 10_000 });
  if (!element) throw new Error(`No control matching ${selector}.`);
  await element.click({ count: 3 });
  await page.keyboard.press('Backspace');
  await element.type(value);
}

export async function readValue(page: Page, selector: string): Promise<string> {
  return page.$eval(selector, (element) => (element as HTMLInputElement).value);
}

export async function setChecked(page: Page, selector: string, checked = true): Promise<void> {
  await page.waitForSelector(selector, { timeout: 10_000 });
  await page.$eval(
    selector,
    (element, target) => {
      const input = element as HTMLInputElement;
      if (input.checked !== target) input.click();
    },
    checked,
  );
}

/** Ticks the first `count` checkboxes inside a scope, e.g. a checklist. */
export async function checkFirst(page: Page, scope: string, count: number): Promise<number> {
  return page.evaluate(
    (root: string, take: number) => {
      const container = document.querySelector(root);
      if (!container) return 0;
      const boxes = Array.from(
        container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
      ).slice(0, take);
      boxes.forEach((box) => {
        if (!box.checked) box.click();
      });
      return boxes.length;
    },
    scope,
    count,
  );
}

/** Selects the first radio in a scope and returns how many were available. */
export async function chooseFirstRadio(page: Page, scope: string): Promise<number> {
  return page.evaluate((root: string) => {
    const container = document.querySelector(root);
    if (!container) return 0;
    const radios = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    radios[0]?.click();
    return radios.length;
  }, scope);
}

/** Option values of a `<select>`, for asserting what a form offers. */
export async function optionValues(page: Page, selector: string): Promise<string[]> {
  return page.$$eval(`${selector} option`, (options) =>
    options.map((option) => (option as HTMLOptionElement).value),
  );
}

/** Ids of repeated rows, e.g. every `item-desc-<id>` in a line item editor. */
export async function rowIds(page: Page, idPrefix: string): Promise<string[]> {
  return page.$$eval(
    `[id^="${idPrefix}"]`,
    (elements, prefix) => elements.map((element) => element.id.replace(prefix as string, '')),
    idPrefix,
  );
}
