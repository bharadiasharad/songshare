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
 */
const baseURL = process.env.API_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  // The flow is stateful (creates and then deletes data), so run serially.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    // better-auth enforces trustedOrigins on auth mutations; present the base URL
    // as the Origin so requests are accepted (the test acts as the trusted frontend).
    extraHTTPHeaders: { Accept: 'application/json', Origin: baseURL },
  },
});
