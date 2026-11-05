import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { env } from '@/env'

import {
  compareMigrations,
  readAppliedMigrations,
  readLocalMigrations,
} from './migration-status'

const local = [
  { tag: '0000_a', when: 100, hash: 'a' },
  { tag: '0001_b', when: 200, hash: 'b' },
  { tag: '0002_c', when: 300, hash: 'c' },
]
const appliedRow = (hash: string, createdAt: number) => ({ hash, createdAt })

describe('compareMigrations', () => {
  it('matches when every migration is applied', () => {
    expect(
      compareMigrations(local, [
        appliedRow('a', 100),
        appliedRow('b', 200),
        appliedRow('c', 300),
      ])
    ).toEqual({
      applied: 3,
      pending: [],
      skipped: [],
      changed: [],
      unknown: [],
    })
  })

  it('lists what is newer than the last applied migration as pending', () => {
    const status = compareMigrations(local, [appliedRow('a', 100)])
    expect(status.pending.map((m) => m.tag)).toEqual(['0001_b', '0002_c'])
    expect([status.skipped, status.changed, status.unknown]).toEqual([
      [],
      [],
      [],
    ])
  })

  it('lists everything as pending on an empty database', () => {
    expect(compareMigrations(local, []).pending).toHaveLength(3)
  })

  // Another branch applied its migration (created later than this branch's
  // last one): db:migrate on this branch has nothing to do and says so.
  it("flags another branch's migration as unknown", () => {
    const status = compareMigrations(local, [
      appliedRow('a', 100),
      appliedRow('b', 200),
      appliedRow('c', 300),
      appliedRow('news', 400),
    ])
    expect(status.unknown).toEqual([appliedRow('news', 400)])
    expect(status.pending).toEqual([])
  })

  // The migrator only applies what is newer than the last applied row, so a
  // migration older than another branch's never runs.
  it('flags a migration older than the last applied one as skipped', () => {
    const status = compareMigrations(local, [
      appliedRow('a', 100),
      appliedRow('b', 200),
      appliedRow('news', 350),
    ])
    expect(status.skipped.map((m) => m.tag)).toEqual(['0002_c'])
    expect(status.unknown).toEqual([appliedRow('news', 350)])
  })

  it('flags a migration whose file changed after it was applied', () => {
    const status = compareMigrations(local, [
      appliedRow('a', 100),
      appliedRow('b-draft', 200),
      appliedRow('c', 300),
    ])
    expect(status.changed.map((m) => m.tag)).toEqual(['0001_b'])
    expect([status.unknown, status.skipped, status.pending]).toEqual([
      [],
      [],
      [],
    ])
  })
})

describe('the test database', () => {
  // `pnpm db:check:test` on the suite's own database: it was migrated from
  // this branch, so it must match.
  it("matches this branch's migrations", async () => {
    const migrations = fileURLToPath(new URL('./migrations', import.meta.url))
    const status = compareMigrations(
      readLocalMigrations(migrations),
      await readAppliedMigrations(env.DATABASE_URL)
    )
    expect(status).toMatchObject({
      pending: [],
      skipped: [],
      changed: [],
      unknown: [],
    })
    expect(status.applied).toBeGreaterThan(0)
  })
})
