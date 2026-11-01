import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

/**
 * Applies the pending SQL migrations in `migrationsFolder` (the files
 * `pnpm db:generate` writes) with drizzle-orm's runtime migrator — the same
 * `drizzle.__drizzle_migrations` journal as `drizzle-kit migrate`, so the two
 * can be mixed. No-op when everything is applied.
 */
export async function runMigrations(
  databaseUrl: string,
  migrationsFolder: string
): Promise<void> {
  const database = drizzle(databaseUrl)
  try {
    await migrate(database, { migrationsFolder })
  } finally {
    await database.$client.end()
  }
}
