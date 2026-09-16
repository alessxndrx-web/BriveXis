import { spawnSync } from 'node:child_process';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { resolveChromePath } from './chrome';
import { collectProblems, type ProblemCollector } from './console';
import { DEFAULT_VIEWPORT, type Viewport } from './viewport';

/**
 * Browser lifecycle for the end-to-end tests.
 *
 * One browser is shared per test file and pages are opened per test, which is
 * the balance that keeps the suite fast without letting state leak: a fresh
 * page means a fresh `localStorage` read and a fresh set of listeners.
 */

export const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_PORT ?? 8099}`;

export interface SessionOptions {
  viewport?: Viewport;
  /** Emulates `prefers-reduced-motion: reduce`. */
  reducedMotion?: boolean;
}

export interface Session {
  page: Page;
  problems: ProblemCollector;
  close: () => Promise<void>;
}

let shared: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (shared) return shared;
  shared = await puppeteer.launch({
    executablePath: resolveChromePath(),
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      // Keeps rendering deterministic between machines, which matters for the
      // layout audit and for screenshots.
      '--force-device-scale-factor=1',
      '--hide-scrollbars',
      '--disable-lcd-text',
    ],
  });
  return shared;
}

/**
 * Closes the shared browser.
 *
 * `browser.close()` alone is not reliable enough to end a run: on Windows it
 * regularly leaves the renderer and GPU children behind, which piles up across
 * suites. The launcher's own process is killed as a fallback, and the whole
 * thing is time-boxed so a browser that refuses to exit cannot hang the run.
 */
export async function closeBrowser(): Promise<void> {
  if (!shared) return;
  const browser = shared;
  shared = null;

  const child = browser.process();

  try {
    await Promise.race([
      browser.close(),
      new Promise((resolve) => setTimeout(resolve, 8_000)),
    ]);
  } catch {
    // Already gone, or the connection dropped first.
  }

  if (child?.pid && child.exitCode === null) {
    killTree(child.pid);
  }
}

function killTree(pid: number): void {
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGKILL');
    }
  } catch {
    // The process ended between the check and the kill.
  }
}

// A suite that throws before `afterAll` would otherwise strand a browser.
process.once('exit', () => {
  const child = shared?.process();
  if (child?.pid && child.exitCode === null) killTree(child.pid);
});

export async function openSession(options: SessionOptions = {}): Promise<Session> {
  const { viewport = DEFAULT_VIEWPORT, reducedMotion = false } = options;

  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setViewport({
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
  });

  if (reducedMotion) {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  }

  const problems = collectProblems(page);

  return {
    page,
    problems,
    async close() {
      await page.close();
    },
  };
}

/**
 * Runs a test body against a fresh page and asserts the browser stayed quiet.
 * The page is closed even when the body throws, so one failure cannot leak a
 * page into the next test.
 */
export async function withPage(
  options: SessionOptions,
  body: (session: Session) => Promise<void>,
): Promise<void> {
  const session = await openSession(options);
  try {
    await body(session);
    session.problems.assertClean(session.page.url());
  } finally {
    await session.close();
  }
}
