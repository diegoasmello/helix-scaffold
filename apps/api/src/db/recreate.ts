import { fileURLToPath } from 'node:url'

import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'

import { runMigrations } from './run-migrations'

// `pnpm db:recreate:test`: drops everything in the database — every table,
// enum and the migration journal, other branches' leftovers included — and
// migrates it from scratch. Only for a disposable database: it refuses any
// whose name does not end in `_test` or `_e2e`, so it never wipes dev data.
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const name = new URL(databaseUrl).pathname.slice(1)
if (!/_(test|e2e)$/.test(name)) {
  console.error(
    `Refusing to recreate "${name}": only a database named *_test or *_e2e.`
  )
  process.exit(1)
}

const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url))

try {
  const database = drizzle(databaseUrl)
  try {
    await database.execute(sql`drop schema if exists drizzle cascade`)
    await database.execute(sql`drop schema if exists public cascade`)
    await database.execute(sql`create schema public`)
  } finally {
    await database.$client.end()
  }
  await runMigrations(databaseUrl, migrationsFolder)
  console.log(`${name} recreated and migrated.`)
} catch (error) {
  console.error('Recreate failed:', error)
  process.exit(1)
}
