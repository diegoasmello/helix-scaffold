import { fileURLToPath } from 'node:url'

import {
  compareMigrations,
  readAppliedMigrations,
  readLocalMigrations,
} from './migration-status'

// `pnpm db:check` / `pnpm db:check:test`: does the database match this
// branch's migrations? Exits 1 when it holds migrations the branch does not
// know (another branch's), edited ones, or ones the migrator would skip.
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url))
const database = new URL(databaseUrl).pathname.slice(1)
const at = (millis: number) => new Date(millis).toISOString()

try {
  const status = compareMigrations(
    readLocalMigrations(migrationsFolder),
    await readAppliedMigrations(databaseUrl)
  )
  console.log(
    `${database}: ${status.applied} applied, ${status.pending.length} pending`
  )
  for (const migration of status.pending)
    console.log(`  pending  ${migration.tag}`)

  const problems = [
    ...status.unknown.map(
      (row) =>
        `  unknown  applied ${at(row.createdAt)} (hash ${row.hash.slice(0, 12)}…) — not a migration of this branch`
    ),
    ...status.changed.map(
      (migration) =>
        `  changed  ${migration.tag} — its .sql file changed after it was applied`
    ),
    ...status.skipped.map(
      (migration) =>
        `  skipped  ${migration.tag} — older than the last applied migration, so db:migrate never applies it`
    ),
  ]
  if (problems.length > 0) {
    console.error(
      [
        `${database} does not match this branch's migrations:`,
        ...problems,
        'Leftovers of another branch: its tables, columns and enums are still there, and a new migration may fail on them.',
        'Test database: pnpm db:recreate:test. Dev database: it holds your data — see apps/api/CLAUDE.md → Scripts.',
      ].join('\n')
    )
    process.exit(1)
  }
} catch (error) {
  console.error('Migration check failed:', error)
  process.exit(1)
}
