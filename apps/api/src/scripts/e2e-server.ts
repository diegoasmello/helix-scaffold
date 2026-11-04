// The API the web's Playwright suite runs against (`apps/web/playwright.config.ts`
// starts it through `pnpm --filter api e2e:server`, which migrates and empties
// the E2E database first). The test config plus `src/config/e2e-overrides.ts`:
// port 3334 and its own uploads dir, so it runs beside `pnpm dev`. Its
// environment (`DATABASE_URL`, `BASE_URL`, …) comes from the Playwright config,
// not from `.env`.

import { enableE2E } from '@/config/e2e-overrides'

enableE2E()

// Imported only now: `@/config` resolves on first import and must see the flag.
await import('../server')
