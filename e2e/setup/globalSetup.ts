import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Test server lifecycle.
 *
 * The browser tests run against the real production build served by the real
 * Express server, so what they exercise is what gets deployed — including the
 * SPA fallback that makes a nested route survive a refresh. Vitest starts this
 * once per run and tears it down afterwards, which is what keeps the suite from
 * depending on a dev server somebody remembered to start.
 */

const PORT = Number(process.env.E2E_PORT ?? 8099);
const HOST = '127.0.0.1';
const HEALTH_URL = `http://${HOST}:${PORT}/api/health`;
const STARTUP_TIMEOUT_MS = 45_000;

let server: ChildProcess | null = null;

async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) {
      throw new Error(`The test server exited early with code ${server.exitCode}.`);
    }
    try {
      const response = await fetch(HEALTH_URL);
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`The test server did not become healthy at ${HEALTH_URL} within 45s.`);
}

/** Kills the server and everything it spawned, on every platform. */
function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    const child = server;
    server = null;
    if (!child || child.exitCode !== null) return resolve();

    const done = () => resolve();
    child.once('exit', done);

    if (process.platform === 'win32' && child.pid) {
      // A plain kill() leaves the Windows process tree behind.
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }

    // Never hang the run waiting for a process that refuses to exit.
    setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 5_000).unref();
  });
}

export async function setup(): Promise<void> {
  const root = process.cwd();
  const entry = path.join(root, 'server.js');
  const dist = path.join(root, 'dist', 'index.html');

  if (!existsSync(entry) || !existsSync(dist)) {
    throw new Error(
      'The production build is missing. Run `npm run build` before the browser tests ' +
        '(the `test:e2e` scripts do this for you).',
    );
  }

  const logs: string[] = [];
  server = spawn(process.execPath, [entry], {
    cwd: root,
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  server.stdout?.on('data', (chunk: Buffer) => logs.push(chunk.toString()));
  server.stderr?.on('data', (chunk: Buffer) => logs.push(chunk.toString()));

  try {
    await waitForHealth();
  } catch (error) {
    await stopServer();
    const output = logs.join('').trim();
    throw new Error(`${(error as Error).message}${output ? `\nServer output:\n${output}` : ''}`);
  }
}

export async function teardown(): Promise<void> {
  await stopServer();
}
