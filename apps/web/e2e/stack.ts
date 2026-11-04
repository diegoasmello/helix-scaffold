// The servers `playwright.config.ts` starts for the suite — on their own ports
// and database, so the suite runs beside `pnpm dev` and the API suite.

export const API_ORIGIN = 'http://localhost:3334'
export const WEB_ORIGIN = 'http://localhost:5174'

/** Where the API's routes live — the origin plus `/api`, like `src/lib/api-url.ts`. */
export const API_URL = `${API_ORIGIN}/api`

/** Emptied on every run (`docker compose up -d db_e2e`). */
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5438/helix_e2e'
