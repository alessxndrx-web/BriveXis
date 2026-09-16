import { existsSync } from 'node:fs';

/**
 * Chrome discovery.
 *
 * `puppeteer-core` deliberately ships without a browser, which keeps the
 * install small but means the tests have to find one. `CHROME_PATH` wins, so
 * CI can point at whatever it provisions; otherwise the usual per-platform
 * install locations are tried in order.
 */

const CANDIDATES: Record<string, string[]> = {
  win32: [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    `${process.env.LOCALAPPDATA ?? ''}/Google/Chrome/Application/chrome.exe`,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ],
};

let cached: string | null = null;

export function resolveChromePath(): string {
  if (cached) return cached;

  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv) {
    if (!existsSync(fromEnv)) {
      throw new Error(`CHROME_PATH is set to "${fromEnv}" but no file exists there.`);
    }
    cached = fromEnv;
    return cached;
  }

  const found = (CANDIDATES[process.platform] ?? []).find((path) => existsSync(path));
  if (!found) {
    throw new Error(
      'No Chrome installation was found for the browser tests. Install Google Chrome, ' +
        'or set CHROME_PATH to the executable.',
    );
  }

  cached = found;
  return cached;
}
