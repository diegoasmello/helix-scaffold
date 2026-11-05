import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'

/** A migration of this branch: an entry of `meta/_journal.json` and its file. */
export interface LocalMigration {
  tag: string
  /** The journal's `when` — what the migrator records as `created_at`. */
  when: number
  /** sha256 of the `.sql` file, as the migrator computes it. */
  hash: string
}

/** A row of `drizzle.__drizzle_migrations`. */
export interface AppliedMigration {
  hash: string
  createdAt: number
}

export interface MigrationStatus {
  applied: number
  /** Not applied yet; the next `db:migrate` applies them. */
  pending: LocalMigration[]
  /**
   * Not applied, and older than the last applied migration: the migrator only
   * applies what is newer than that one, so these never run.
   */
  skipped: LocalMigration[]
  /** Applied, but the `.sql` file changed since (same `when`, other hash). */
  changed: LocalMigration[]
  /** Applied, but unknown to this branch — another branch's migration. */
  unknown: AppliedMigration[]
}

/** The branch's migrations, read the way drizzle-orm's migrator reads them. */
export function readLocalMigrations(
  migrationsFolder: string
): LocalMigration[] {
  const journal = JSON.parse(
    readFileSync(join(migrationsFolder, 'meta/_journal.json'), 'utf8')
  ) as { entries: { tag: string; when: number }[] }
  return journal.entries.map(({ tag, when }) => ({
    tag,
    when,
    hash: createHash('sha256')
      .update(readFileSync(join(migrationsFolder, `${tag}.sql`)).toString())
      .digest('hex'),
  }))
}

/** The rows of `drizzle.__drizzle_migrations`, or none before the first migration. */
export async function readAppliedMigrations(
  databaseUrl: string
): Promise<AppliedMigration[]> {
  const database = drizzle(databaseUrl)
  try {
    const exists = await database.execute<{ table: string | null }>(
      sql`select to_regclass('drizzle.__drizzle_migrations')::text as table`
    )
    if (!exists.rows[0]?.table) return []
    const rows = await database.execute<{ hash: string; created_at: string }>(
      sql`select hash, created_at from drizzle.__drizzle_migrations`
    )
    return rows.rows.map((row) => ({
      hash: row.hash,
      createdAt: Number(row.created_at),
    }))
  } finally {
    await database.$client.end()
  }
}

/**
 * Compares a database with the branch's migrations, by hash. `pending` alone
 * is a normal state; anything in `skipped`, `changed` or `unknown` means the
 * database does not match this branch — typically left over from another
 * branch's migrations — and a later migration may fail on what they created.
 */
export function compareMigrations(
  local: LocalMigration[],
  applied: AppliedMigration[]
): MigrationStatus {
  const appliedHashes = new Set(applied.map((row) => row.hash))
  const localHashes = new Set(local.map((migration) => migration.hash))
  const lastApplied = Math.max(...applied.map((row) => row.createdAt), 0)
  const appliedAt = new Set(applied.map((row) => row.createdAt))

  const notApplied = local.filter(
    (migration) => !appliedHashes.has(migration.hash)
  )
  const changed = notApplied.filter((migration) =>
    appliedAt.has(migration.when)
  )
  const changedAt = new Set(changed.map((migration) => migration.when))

  return {
    applied: applied.length,
    pending: notApplied.filter((migration) => migration.when > lastApplied),
    skipped: notApplied.filter(
      (migration) =>
        migration.when <= lastApplied && !changedAt.has(migration.when)
    ),
    changed,
    unknown: applied.filter(
      (row) => !localHashes.has(row.hash) && !changedAt.has(row.createdAt)
    ),
  }
}
