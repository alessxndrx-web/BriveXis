import { defineConfig } from 'vitest/config';

/**
 * Unit tests.
 *
 * Scoped to `src` on purpose: the browser suites live under `e2e/` and need a
 * built application and a real Chrome, so `npm run test` must never pick them
 * up. Anything here runs in plain Node in a second.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    clearMocks: true,
  },
});
