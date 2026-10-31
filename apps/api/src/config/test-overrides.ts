import type { AppConfig } from './define-config'

// Applied on top of `src/app.config.ts` when running tests (`NODE_ENV=test`).
// The scaffold's test suite exercises open registration and subscription
// gating regardless of what the product configures, so these are pinned here.
export const testConfigOverrides: AppConfig = {
  registration: { mode: 'open' },
  subscriptions: {
    enabled: true,
    plans: [
      { id: 'starter', name: 'Starter', features: [] },
      { id: 'pro', name: 'Pro', features: ['todos'] },
      { id: 'enterprise', name: 'Enterprise', features: ['todos'] },
    ],
    trial: false,
    pastDueGraceDays: 7,
  },
  uploads: { dir: '/tmp/helix-test-uploads' },
}
