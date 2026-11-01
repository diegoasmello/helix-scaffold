import { fileURLToPath } from 'node:url'

import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { env } from '@/env'
import { testDb } from '@/test/helpers'

import { runMigrations } from './run-migrations'

const MIGRATIONS = fileURLToPath(new URL('./migrations', import.meta.url))

describe('runMigrations', () => {
  // The test DB is migrated by drizzle-kit (`pnpm db:migrate:test`): the
  // runtime migrator must read the same journal and find nothing to apply.
  it('is a no-op on a database drizzle-kit already migrated', async () => {
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
