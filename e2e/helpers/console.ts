import type { Page } from 'puppeteer-core';

/**
 * Browser problem collection.
 *
 * A demo that logs errors is a demo that is broken in a way nobody noticed, so
 * every test attaches one of these and asserts it stayed empty. Nothing is
 * discarded silently: anything ignored has to be listed in `BENIGN` below with
 * the reason it is safe.
 */

export interface BrowserProblem {
  kind: 'console.error' | 'pageerror' | 'unhandledrejection' | 'requestfailed';
  text: string;
}

/**
 * Known-benign messages, matched against the full text.
 *
 * - Chrome reports a cancelled navigation as a failed request whenever a test
 *   navigates away while something is still in flight. It says nothing about
 *   the application.
 * - DevTools autofill domains are unavailable in headless Chrome and are logged
 *   by the browser itself, not by the page.
 */
const BENIGN: RegExp[] = [
  /net::ERR_ABORTED/,
  /Autofill\.(enable|setAddresses)/,
];

function isBenign(text: string): boolean {
  return BENIGN.some((pattern) => pattern.test(text));
}

export interface ProblemCollector {
  /** Everything seen so far that is not documented as benign. */
  problems: BrowserProblem[];
  /** Throws with the collected detail when anything went wrong. */
  assertClean(context?: string): void;
  /** Drops what has been collected — used between phases of a long test. */
  clear(): void;
}

export function collectProblems(page: Page): ProblemCollector {
  const problems: BrowserProblem[] = [];

  const push = (kind: BrowserProblem['kind'], text: string) => {
    if (!isBenign(text)) problems.push({ kind, text });
  };

  page.on('console', (message) => {
    if (message.type() === 'error') push('console.error', message.text());
  });

  page.on('pageerror', (error: unknown) => {
    push('pageerror', error instanceof Error ? error.message : String(error));
  });

  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'unknown';
    push('requestfailed', `${request.url()} — ${failure}`);
  });

  // Puppeteer surfaces rejections only through the page context, so the page
  // has to report them itself. The binding is installed for every document.
  void page
    .exposeFunction('__e2eUnhandledRejection', (text: string) => {
      push('unhandledrejection', text);
    })
    .then(() =>
      page.evaluateOnNewDocument(() => {
        window.addEventListener('unhandledrejection', (event) => {
          const reason: unknown = event.reason;
          const text =
            reason instanceof Error ? reason.message : String(reason as string | number | boolean);
          const report = (window as unknown as Record<string, unknown>).__e2eUnhandledRejection;
          if (typeof report === 'function') (report as (value: string) => void)(text);
        });
      }),
    )
    .catch(() => {
      // The binding already exists on this page; the listener is in place.
    });

  return {
    problems,
    clear() {
      problems.length = 0;
    },
    assertClean(context = 'page') {
      if (problems.length === 0) return;
      const detail = problems.map((p) => `  [${p.kind}] ${p.text}`).join('\n');
      throw new Error(`Browser reported ${problems.length} problem(s) on ${context}:\n${detail}`);
    },
  };
}
