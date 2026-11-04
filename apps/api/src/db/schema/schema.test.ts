import { getTableColumns, getTableName, is, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { PgTable, PgTimestamp, PgTimestampString } from 'drizzle-orm/pg-core'
import { afterAll, describe, expect, it } from 'vitest'

import { env } from '@/env'
import { cleanupUploads } from '@/test/helpers'

import * as schema from '.'

const tables = Object.values<unknown>(schema).filter(
  (value): value is PgTable => is(value, PgTable)
)

describe('timestamp columns', () => {
  // `timestamp` without a time zone stores a wall time: `defaultNow()` and
  // `now()` write it in the session's time zone while Drizzle reads it back
  // as UTC, so a Postgres outside UTC shifts every date. A calendar day with
  // no time is a `date` column (`todos.date`).
  it('all carry a time zone (timestamptz)', () => {
    const naive = tables.flatMap((table) =>
      Object.values(getTableColumns(table))
        .filter(
          (column) =>
            (is(column, PgTimestamp) || is(column, PgTimestampString)) &&
            !column.withTimezone
        )
        .map((column) => `${getTableName(table)}.${column.name}`)
    )
    expect(naive).toEqual([])
  })

  describe('on a Postgres session outside UTC', () => {
    const url = new URL(env.DATABASE_URL)
    url.searchParams.set('options', '-c timezone=America/Sao_Paulo')
    const saoPaulo = drizzle(url.toString(), { schema, casing: 'snake_case' })

    afterAll(async () => {
      await cleanupUploads()
      await saoPaulo.$client.end()
    })

    it('runs there (control)', async () => {
      const { rows } = await saoPaulo.execute<{ TimeZone: string }>(
        sql`show timezone`
      )
      expect(rows[0].TimeZone).toBe('America/Sao_Paulo')
    })

    it('keeps the instant defaultNow() wrote', async () => {
      const before = Date.now()
      const [upload] = await saoPaulo
        .insert(schema.uploads)
        .values({
          originalName: 'clock.txt',
          mimeType: 'text/plain',
          fileSize: 1,
          storageKey: `${crypto.randomUUID()}/original.txt`,
          url: 'http://localhost/api/files/clock.txt',
        })
        .returning()
      // The second's slack covers the clock of the database container.
      expect(upload.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000)
      expect(upload.createdAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000)
    })
  })
})
