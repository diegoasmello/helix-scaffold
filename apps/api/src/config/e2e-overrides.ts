import type { AppConfig } from './define-config'

// Applied by `src/scripts/e2e-server.ts`, the API the web's Playwright suite
// starts (`apps/web/playwright.config.ts`), on top of `src/app.config.ts` and
// `testConfigOverrides`: E2E runs in the same mode as the API suite (open
// registration, subscriptions on, known plans), whatever the product
// configures. Only what lets it run beside `pnpm dev` and the API suite
// belongs here.
export const e2eConfigOverrides: AppConfig = {
  // `pnpm dev` keeps 3333; the web's E2E server points VITE_API_URL here.
  server: { port: 3334 },
  // Apart from the API suite's directory, which its tests empty.
  uploads: { dir: '/tmp/helix-e2e-uploads' },
  logger: { level: 'warn' },
}

let e2e = false

/**
 * Makes `src/config/index.ts` apply `testConfigOverrides` and then
 * `e2eConfigOverrides`. Must run before anything imports `@/config`, which
 * resolves once, on first import.
 */
export function enableE2E() {
  e2e = true
}

export function isE2E() {
  return e2e
}
