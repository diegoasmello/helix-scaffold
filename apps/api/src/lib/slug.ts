/**
 * Slugs: the URL identifier of a record on a public page (a site reading the
 * API as a CMS: `/todos/comprar-pao`). Internal to the API — generated from a
 * source field (`title`) on create, never accepted in a request body, never
 * changed afterwards, and unique in its table. See `apps/api/CLAUDE.md` →
 * _Slugs_.
 */
import { eq, or, sql } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

import type { Database } from '@/db'

import { normalizeText } from './normalize-text'
import {
  getPgErrorCode,
  getPgErrorConstraint,
  PG_UNIQUE_VIOLATION,
} from './pg-errors'

const SLUG_MAX_LENGTH = 100

/** Lowercase ASCII letters and digits, in groups joined by single hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Room for a suffix up to `-999999` (7 characters) plus a trailing hyphen the
 * cut may drop: a base this much shorter than `maxLength` is never cut by
 * `freeSlug()`, and every cut candidate of a longer one starts with its first
 * `maxLength - SUFFIX_RESERVE` characters (`slugCandidatesPattern()`).
 */
const SUFFIX_RESERVE = 8

/**
 * The slug of a text, in this order:
 *
 * 1. `normalizeText()` — the same rules as the normalized columns: lowercase,
 *    no accents, `ß` → `ss`, ligatures undone, typographic quotes and dashes
 *    → ASCII, invisible characters removed.
 * 2. Removes apostrophes and quotes, so a word stays whole: `it's` → `its`,
 *    `d'água` → `dagua`.
 * 3. Turns every run of anything else (spaces, punctuation, other scripts,
 *    emoji) into one hyphen, and trims hyphens at the ends.
 * 4. Cuts at `maxLength`: on the last hyphen before it when that keeps at
 *    least half of `maxLength`, else hard (`a-bbbb…` keeps the `b`s instead
 *    of becoming `a`).
 *
 * Returns `''` when nothing is left (`'日本語'`, `'!!!'`): the caller picks a
 * fallback (`SlugConfig.fallback`).
 */
export function slugify(value: string, maxLength = SLUG_MAX_LENGTH): string {
  const slug = normalizeText(value)
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return truncateSlug(slug, maxLength)
}

function truncateSlug(slug: string, maxLength: number): string {
  if (slug.length <= maxLength) return slug
  const cut = slug.slice(0, maxLength + 1)
  const lastHyphen = cut.lastIndexOf('-')
  const truncated =
    lastHyphen >= maxLength / 2
      ? cut.slice(0, lastHyphen)
      : cut.slice(0, maxLength)
  return truncated.replace(/-+$/, '')
}

/**
 * The first of `base`, `base-2`, `base-3`… not in `taken`. A suffix that
 * would pass `maxLength` cuts the base (hard cut, so every candidate keeps
 * the same prefix).
 */
export function freeSlug(
  base: string,
  taken: ReadonlySet<string>,
  maxLength = SLUG_MAX_LENGTH
): string {
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) {
    const suffix = `-${n}`
    const candidate =
      base.length + suffix.length <= maxLength
        ? `${base}${suffix}`
        : `${base.slice(0, maxLength - suffix.length).replace(/-+$/, '')}${suffix}`
    if (!taken.has(candidate)) return candidate
  }
}

/**
 * How a table stores its slug — declared once per module, next to the table:
 *
 * ```ts
 * export const TODO_SLUG = {
 *   column: todos.slug,
 *   constraint: 'todos_slug_unique',
 *   fallback: 'todo',
 * } as const satisfies SlugConfig
 * ```
 */
export interface SlugConfig {
  /**
   * The `slug` column — `text NOT NULL`, with a unique index on
   * `text_pattern_ops` (see `apps/api/CLAUDE.md` → _Slugs_).
   */
  column: PgColumn
  /** Name of that unique index, to recognize a collision on insert. */
  constraint: string
  /**
   * The base when the source has no character a slug keeps: the entity name.
   * Must match `SLUG_PATTERN` and fit `maxLength` — `slugBase()` throws
   * otherwise, so the module's first create test catches it.
   */
  fallback: string
  maxLength?: number
}

/** `slugify(source)`, or the config's fallback when that is empty. */
export function slugBase(source: string, config: SlugConfig): string {
  const maxLength = config.maxLength ?? SLUG_MAX_LENGTH
  if (
    !SLUG_PATTERN.test(config.fallback) ||
    config.fallback.length > maxLength
  ) {
    throw new Error(
      `Invalid slug fallback "${config.fallback}": it must match SLUG_PATTERN and fit ${maxLength} characters`
    )
  }
  return slugify(source, maxLength) || config.fallback
}

/**
 * A regex matching every suffixed candidate `freeSlug()` can return for
 * `base` (`base` itself is compared with `=`). A base with room for any
 * suffix only gets `base-N`: `^todo-[0-9]+$`, which leaves out `todo-list-2`
 * and `todos-3`. A longer one has its suffixed candidates cut, so it matches
 * what starts with the prefix every cut keeps. Slug characters are regex-safe:
 * `[a-z0-9-]` has no metacharacter outside a class.
 */
export function slugCandidatesPattern(
  base: string,
  maxLength = SLUG_MAX_LENGTH
): string {
  const keep = maxLength - SUFFIX_RESERVE
  return base.length <= keep
    ? `^${base}-[0-9]+$`
    : `^${base.slice(0, keep)}.*-[0-9]+$`
}

/**
 * A slug for `source` that no row of the table holds yet: the base, or the
 * base with the first free numeric suffix. One query: the rows whose slug is
 * the base or matches `slugCandidatesPattern()` — every candidate
 * `freeSlug()` can return is in that set. The regex is anchored, so the
 * planner turns its fixed prefix into a range on the `text_pattern_ops`
 * index — as long as it sees the value: never `.prepare()` this query (a
 * generic plan reads the whole index).
 *
 * Another write can take the same slug before the insert: use
 * `withUniqueSlug()`, which retries on that collision.
 */
export async function uniqueSlug(
  database: Database,
  config: SlugConfig,
  source: string
): Promise<string> {
  const maxLength = config.maxLength ?? SLUG_MAX_LENGTH
  const base = slugBase(source, config)
  const pattern = slugCandidatesPattern(base, maxLength)
  const { column } = config
  const rows = await database
    .select({ slug: column })
    .from(column.table)
    .where(or(eq(column, base), sql`${column} ~ ${pattern}`))
  return freeSlug(
    base,
    new Set(rows.map((row) => row.slug as string)),
    maxLength
  )
}

// N concurrent writes of the same base need up to N attempts.
const MAX_ATTEMPTS = 5

/**
 * Runs `write(slug)` with a `uniqueSlug()`, and again with a new one when a
 * concurrent write took it first (unique violation on `config.constraint`).
 * Any other error goes through. `write` is the insert alone — a failed
 * statement aborts a surrounding transaction, so inside one, wrap the insert
 * in a savepoint (`tx.transaction(...)`).
 */
export async function withUniqueSlug<T>(
  database: Database,
  config: SlugConfig,
  source: string,
  write: (slug: string) => Promise<T>
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const slug = await uniqueSlug(database, config, source)
    try {
      return await write(slug)
    } catch (error) {
      const collision =
        getPgErrorCode(error) === PG_UNIQUE_VIOLATION &&
        getPgErrorConstraint(error) === config.constraint
      if (!collision || attempt >= MAX_ATTEMPTS) throw error
    }
  }
}

/**
 * Slugs for rows written together into a table that holds none of them yet
 * (the seed, an import into an empty table): distinct among themselves.
 */
export function distinctSlugs(
  sources: readonly string[],
  config: SlugConfig
): string[] {
  const taken = new Set<string>()
  return sources.map((source) => {
    const slug = freeSlug(slugBase(source, config), taken, config.maxLength)
    taken.add(slug)
    return slug
  })
}
