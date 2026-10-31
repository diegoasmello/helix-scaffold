import type { AppConfig } from './define-config'

// Applied on top of `src/app.config.ts` when running tests (`NODE_ENV=test`).
// The scaffold's test suite exercises open registration and subscription
// gating regardless of what the product configures, so these are pinned here.
export const testConfigOverrides: AppConfig = {
  registration: { mode: 'open' },
  subscriptions: { enabled: true },
  uploads: { dir: '/tmp/helix-test-uploads' },
}
