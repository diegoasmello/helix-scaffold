import { sql } from 'drizzle-orm'
import { pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { testDb } from '@/test/helpers'

import {
  distinctSlugs,
  freeSlug,
  SLUG_PATTERN,
  slugBase,
  slugCandidatesPattern,
  type SlugConfig,
  slugify,
  uniqueSlug,
  withUniqueSlug,
} from './slug'

describe('slugify', () => {
  // The table documents the rules: change a rule here and in the function together.
  it.each([
    ['lowercases and joins words with hyphens', 'Comprar Pão', 'comprar-pao'],
    ['removes accents', 'Ação em São Paulo', 'acao-em-sao-paulo'],
    ['maps letters that do not decompose', 'Straße Øre', 'strasse-ore'],
    ['keeps words whole across apostrophes', "It's d’água", 'its-dagua'],
    ['removes quotes', '“Citação” "dupla"', 'citacao-dupla'],
    ['turns punctuation runs into one hyphen', 'a, b... & c!?', 'a-b-c'],
    ['trims hyphens at the ends', '—Título—', 'titulo'],
    ['keeps digits', 'Versão 2.0 (2025)', 'versao-2-0-2025'],
    ['drops emoji', 'Festa 🎉 hoje', 'festa-hoje'],
    ['collapses whitespace and invisible characters', ' a\n\tb​c ', 'a-bc'],
    ['drops non-latin scripts', 'Ελλάδα 日本 test', 'test'],
    ['returns empty when nothing is left', '日本語 !!!', ''],
  ])('%s', (_rule, input, expected) => {
    expect(slugify(input)).toBe(expected)
  })

  it('cuts at the max length on the last hyphen', () => {
    expect(slugify('alpha beta gamma', 12)).toBe('alpha-beta')
    expect(slugify('alpha beta gamma', 10)).toBe('alpha-beta')
  })

  it('cuts a single long word hard', () => {
    expect(slugify('a'.repeat(150))).toBe('a'.repeat(100))
  })

  it('cuts hard when the last hyphen would keep less than half', () => {
    expect(slugify(`a ${'b'.repeat(150)}`)).toBe(`a-${'b'.repeat(98)}`)
  })

  it('always returns a valid slug or empty', () => {
    for (const input of [
      'Ação',
      ' -- x -- ',
      'a'.repeat(300),
      'a '.repeat(80),
    ]) {
      const slug = slugify(input)
      expect(slug.length).toBeLessThanOrEqual(100)
      expect(slug).toMatch(SLUG_PATTERN)
    }
  })

  it('is idempotent', () => {
    for (const input of ['Ação  RÁPIDA', "It's 2.0", 'a b '.repeat(40)]) {
      expect(slugify(slugify(input))).toBe(slugify(input))
    }
  })
})

describe('freeSlug', () => {
  it('returns the base when free', () => {
    expect(freeSlug('item', new Set(['other']))).toBe('item')
  })

  it('appends the first free numeric suffix', () => {
    expect(freeSlug('item', new Set(['item']))).toBe('item-2')
    expect(freeSlug('item', new Set(['item', 'item-2', 'item-3']))).toBe(
      'item-4'
    )
  })

  it('cuts the base to fit the suffix in the max length', () => {
    const base = 'a'.repeat(10)
    expect(freeSlug(base, new Set([base]), 10)).toBe(`${'a'.repeat(8)}-2`)
  })

  it('never ends the cut base with a hyphen', () => {
    expect(freeSlug('abcdefg-ij', new Set(['abcdefg-ij']), 10)).toBe(
      'abcdefg-2'
    )
  })
})

describe('slugCandidatesPattern', () => {
  it('matches only base-N when the base has room for any suffix', () => {
    const pattern = new RegExp(slugCandidatesPattern('item'))
    expect(slugCandidatesPattern('item')).toBe('^item-[0-9]+$')
    expect('item-2').toMatch(pattern)
    expect('item-123').toMatch(pattern)
    for (const other of ['item', 'item-list-2025', 'items-3', 'item-a-2']) {
      expect(other).not.toMatch(pattern)
    }
  })

  it('matches every candidate of a base long enough to be cut', () => {
    // Bases of 98–100 characters with hyphens at every offset, so the cut
    // lands on (and drops) a hyphen in some of them.
    for (let offset = 0; offset < 10; offset++) {
      const base = 'abcdefgh-'
        .repeat(13)
        .slice(offset, offset + 100)
        .replace(/^-+|-+$/g, '')
      const pattern = new RegExp(slugCandidatesPattern(base))
      // One call walks the candidates in order (`-2`, `-3`… past the 4-digit
      // suffixes): `taken` records each one it is asked about and holds the
      // first 1200. Growing a real Set one slug per call would walk them all
      // again on every call — quadratic, seconds instead of milliseconds.
      const candidates: string[] = []
      const taken = {
        has: (slug: string) => {
          if (slug === base) return true
          candidates.push(slug)
          return candidates.length <= 1200
        },
      } as ReadonlySet<string>
      freeSlug(base, taken)
      expect(candidates).toHaveLength(1201)
      expect(new Set(candidates).size).toBe(candidates.length)
      const invalid = candidates.filter(
        (candidate) =>
          candidate.length > 100 ||
          !SLUG_PATTERN.test(candidate) ||
          !pattern.test(candidate)
      )
      expect(invalid).toEqual([])
    }
  })
})

describe('slugBase', () => {
  const config = (fallback: string) =>
    ({ fallback, constraint: 'x' }) as unknown as SlugConfig

  it('falls back when the source leaves nothing', () => {
    expect(slugBase('日本語', config('item'))).toBe('item')
    expect(slugBase('Olá', config('item'))).toBe('ola')
  })

  it('rejects a fallback that is not a slug', () => {
    for (const fallback of ['', 'Item', 'my item', 'item-', 'a'.repeat(101)]) {
      expect(() => slugBase('Olá', config(fallback))).toThrow(/slug fallback/)
    }
  })
})

describe('distinctSlugs', () => {
  const config = { fallback: 'item', constraint: 'x' } as unknown as SlugConfig

  it('suffixes repeated titles and falls back for empty ones', () => {
    expect(distinctSlugs(['Olá', 'ola', 'OLÁ', '日本', '!!!'], config)).toEqual(
      ['ola', 'ola-2', 'ola-3', 'item', 'item-2']
    )
  })
})

describe('against the database', () => {
  // A table of the test's own, declared the way a module declares its slug
  // (apps/api/CLAUDE.md → Slugs), so the helpers stay tested whichever
  // modules use them. Created here and dropped after: it is in no migration.
  const items = pgTable(
    'test_slugged_items',
    { slug: text('slug').notNull() },
    (t) => [
      uniqueIndex('test_slugged_items_slug_unique').on(
        t.slug.op('text_pattern_ops')
      ),
    ]
  )
  const ITEM_SLUG = {
    column: items.slug,
    constraint: 'test_slugged_items_slug_unique',
    fallback: 'item',
  } as const satisfies SlugConfig
  const collision = { code: '23505', constraint: ITEM_SLUG.constraint }

  async function insertSlugs(...slugs: string[]) {
    await testDb.insert(items).values(slugs.map((slug) => ({ slug })))
  }

  beforeAll(async () => {
    await testDb.execute(sql`drop table if exists test_slugged_items`)
    await testDb.execute(
      sql`create table test_slugged_items (slug text not null)`
    )
    await testDb.execute(
      sql`create unique index test_slugged_items_slug_unique on test_slugged_items (slug text_pattern_ops)`
    )
  })

  beforeEach(async () => {
    await testDb.delete(items)
  })

  afterAll(async () => {
    await testDb.execute(sql`drop table if exists test_slugged_items`)
  })

  describe('uniqueSlug', () => {
    it('ignores slugs of other bases', async () => {
      await insertSlugs('item', 'item-2', 'item-list-2025', 'items-3')
      expect(await uniqueSlug(testDb, ITEM_SLUG, '!!!')).toBe('item-3')
    })

    it('finds the cut candidates of a long base', async () => {
      const base = 'a'.repeat(100)
      await insertSlugs(base, `${'a'.repeat(98)}-2`)
      expect(await uniqueSlug(testDb, ITEM_SLUG, base)).toBe(
        `${'a'.repeat(98)}-3`
      )
    })
  })

  describe('withUniqueSlug', () => {
    it('retries with a fresh slug when a concurrent write took it', async () => {
      const write = vi.fn(async (slug: string) => {
        if (write.mock.calls.length === 1) {
          // The concurrent writer: takes the slug, then this insert collides.
          await insertSlugs(slug)
          throw { cause: collision } // Drizzle wraps the driver error
        }
        return slug
      })
      expect(await withUniqueSlug(testDb, ITEM_SLUG, 'Título', write)).toBe(
        'titulo-2'
      )
      expect(write.mock.calls.map(([slug]) => slug)).toEqual([
        'titulo',
        'titulo-2',
      ])
    })

    it('rethrows a violation of another constraint without retrying', async () => {
      const error = { code: '23505', constraint: 'test_slugged_items_pkey' }
      const write = vi.fn(() => Promise.reject(error))
      await expect(
        withUniqueSlug(testDb, ITEM_SLUG, 'Título', write)
      ).rejects.toBe(error)
      expect(write).toHaveBeenCalledTimes(1)
    })

    it('rethrows any other error without retrying', async () => {
      const error = new Error('boom')
      const write = vi.fn(() => Promise.reject(error))
      await expect(
        withUniqueSlug(testDb, ITEM_SLUG, 'Título', write)
      ).rejects.toBe(error)
      expect(write).toHaveBeenCalledTimes(1)
    })

    it('gives up after 5 collisions', async () => {
      const write = vi.fn(() => Promise.reject(collision))
      await expect(
        withUniqueSlug(testDb, ITEM_SLUG, 'Título', write)
      ).rejects.toBe(collision)
      expect(write).toHaveBeenCalledTimes(5)
    })
  })
})
