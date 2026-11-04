import { defineConfig, devices } from '@playwright/test'

import { ADMIN_STATE } from './e2e/personas'
import { API_ORIGIN, API_URL, E2E_DATABASE_URL, WEB_ORIGIN } from './e2e/stack'

// The suite brings up its own stack — nothing to start or configure by hand
// besides `docker compose up -d db_e2e`:
// - the API (`pnpm --filter api e2e:server`) migrates and empties `helix_e2e`,
//   then listens on 3334 with the test config (open registration,
//   subscriptions on — `apps/api/src/config/e2e-overrides.ts`);
// - Vite serves the web on 5174, pointed at that API.
// Both ports are apart from `pnpm dev` (3333 / 5173), so it can stay running.
// The environment below is not secret: it exists only for this database.
const apiEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: E2E_DATABASE_URL,
  AUTH_SECRET: 'e2e-only-secret-not-used-anywhere-else',
  BASE_URL: API_ORIGIN,
  CLIENT_URL: WEB_ORIGIN,
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: WEB_ORIGIN,
    locale: 'en-US',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /global\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: ADMIN_STATE,
      },
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter api e2e:server',
      url: `${API_URL}/bootstrap/status`,
      env: apiEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm exec vite --port 5174 --strictPort',
      url: WEB_ORIGIN,
      env: { VITE_API_URL: API_ORIGIN },
      reuseExistingServer: !process.env.CI,
    },
  ],
})
