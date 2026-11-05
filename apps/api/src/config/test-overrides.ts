import type { AppConfig } from './define-config'

// Applied on top of `src/app.config.ts` when running tests (`NODE_ENV=test`).
// The scaffold's test suite exercises open registration and subscription
// gating regardless of what the product configures, so these are pinned here.
export const testConfigOverrides: AppConfig = {
  registration: { mode: 'open' },
  subscriptions: {
    enabled: true,
    plans: [
      // `reports` is the suite's own feature: the infrastructure tests gate
      // their throwaway routes and records with it, whichever modules exist.
      { id: 'starter', name: 'Starter', features: [] },
      { id: 'pro', name: 'Pro', features: ['todos', 'reports'] },
      { id: 'enterprise', name: 'Enterprise', features: ['todos', 'reports'] },
    ],
    trial: false,
    pastDueGraceDays: 7,
  },
  // Off whatever the product enables: an enabled provider needs its OAuth
  // credentials, which the suites' environments never have.
  auth: {
    socialProviders: {
      google: { enabled: false },
      facebook: { enabled: false },
      apple: { enabled: false },
    },
  },
  uploads: { dir: '/tmp/helix-test-uploads' },
}
