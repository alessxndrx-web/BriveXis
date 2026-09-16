import { defineConfig } from 'vitest/config';

/**
 * Browser tests.
 *
 * `globalSetup` starts the production server against `dist/` and shuts it down
 * afterwards. The suites share one browser and drive a real workspace, so they
 * run one file at a time: parallel files would fight over the same demo
 * `localStorage` origin.
 */
export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.ts'],
    environment: 'node',
    globalSetup: ['e2e/setup/globalSetup.ts'],
    testTimeout: 180_000,
    hookTimeout: 90_000,
    fileParallelism: false,
    maxWorkers: 1,
    sequence: { concurrent: false },
  },
});
