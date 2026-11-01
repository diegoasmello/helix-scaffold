import { fileURLToPath } from 'node:url'

import { runMigrations } from './run-migrations'

// Production entry: `pnpm build` bundles this file as dist/migrate.js and
// copies src/db/migrations next to it, so `./migrations` resolves in both
// places (src/db/migrations under tsx, dist/migrations once built). Needs only
// DATABASE_URL — no drizzle-kit, no dev dependencies, no .env file.
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url))

try {
  await runMigrations(databaseUrl, migrationsFolder)
  console.log('Migrations applied.')
} catch (error) {
  console.error('Migration failed:', error)
  process.exit(1)
}
