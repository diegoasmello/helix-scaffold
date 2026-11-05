import { fileURLToPath } from 'node:url'

import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { env } from '@/env'
import { testDb } from '@/test/helpers'

import { runMigrations } from './run-migrations'

const MIGRATIONS = fileURLToPath(new URL('./migrations', import.meta.url))

describe('runMigrations', () => {
  // The test DB is already migrated (`pnpm db:migrate:test`, this migrator —
  // or drizzle-kit, on a database migrated before the scripts moved here; both
  // write the same journal): nothing is left to apply.
  it('is a no-op on an already migrated database', async () => {
    const count = async () => {
      const result = await testDb.execute<{ n: string }>(
        sql`select count(*) as n from drizzle.__drizzle_migrations`
      )
      return Number(result.rows[0].n)
    }
    const before = await count()

    await runMigrations(env.DATABASE_URL, MIGRATIONS)

    expect(await count()).toBe(before)
    expect(before).toBeGreaterThan(0)
  })
})
