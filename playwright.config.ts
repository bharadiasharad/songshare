import { defineConfig } from '@playwright/test';

/**
 * Playwright API test configuration.
 *
 * These are pure HTTP/API tests (no browser) that exercise the full request flow
 * against a running instance of the API. Point them at the server with API_BASE_URL
 * (defaults to the local Docker-published port 3000).
 *
 *   npm run test:api                       # against http://localhost:3000
 *   API_BASE_URL=http://localhost:3000 npm run test:api
 *
 * When the target is local, Playwright manages the server lifecycle via `webServer`:
 *   - In CI it boots a fresh `node dist/main.js` and waits on the health probe.
 *   - Locally it reuses an already-running instance (e.g. `docker compose up`).
 * For a remote target (a non-local API_BASE_URL) the server is assumed to be running.
 */
const baseURL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const isLocalTarget = /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(baseURL);

export default defineConfig({
  testDir: './e2e',
  // The flow is stateful (creates and then deletes data), so run serially.
  fullyParallel: false,
  workers: 1,
  // Fail the build if a test was accidentally committed with `test.only`.
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 30_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    // better-auth enforces trustedOrigins on auth mutations; present the base URL
    // as the Origin so requests are accepted (the test acts as the trusted frontend).
    extraHTTPHeaders: { Accept: 'application/json', Origin: baseURL },
  },
  // Only own the server lifecycle for a local target. The compiled entrypoint
  // (dist/main.js) must exist and the database must be migrated beforehand.
  webServer: isLocalTarget
    ? {
        command: 'node dist/main.js',
        url: `${baseURL}/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        stdout: 'pipe',
        stderr: 'pipe',
      }
    : undefined,
});
