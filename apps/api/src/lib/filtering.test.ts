import { type AnyColumn, type SQL } from 'drizzle-orm'
import { integer, PgDialect, pgTable, text } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'

import {
  buildFilterWhereClause,
  buildSearchClause,
  filterQuerySchema,
  searchQuerySchema,
} from './filtering'

const dialect = new PgDialect()

function toSQL(expr: SQL) {
  return dialect.sqlToQuery(expr)
}

const testTable = pgTable('items', {
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  status: text('status').notNull(),
  count: integer('count').notNull(),
})

const columnMap = {
  name: testTable.name,
  status: testTable.status,
  count: testTable.count,
} as const

describe('filterQuerySchema', () => {
  const schema = filterQuerySchema(['name', 'status', 'count'] as const)

  describe('filters field', () => {
    it('defaults to empty array when filters is absent', () => {
      expect(schema.parse({}).filters).toEqual([])
    })

    it('defaults to empty array for empty string', () => {
      expect(schema.parse({ filters: '' }).filters).toEqual([])
    })

    it('defaults to empty array for invalid JSON', () => {
      expect(schema.parse({ filters: 'not-json' }).filters).toEqual([])
    })

    it('defaults to empty array for a non-array JSON value', () => {
      expect(
        schema.parse({ filters: JSON.stringify({ field: 'name' }) }).filters
      ).toEqual([])
    })

    it('parses a valid JSON array of conditions', () => {
      const conditions = [{ field: 'name', op: 'eq', value: 'hello' }]
      expect(
        schema.parse({ filters: JSON.stringify(conditions) }).filters
      ).toEqual(conditions)
    })

    it('accepts a condition without value (isNull / isNotNull)', () => {
      const conditions = [{ field: 'name', op: 'isNull' }]
      expect(
        schema.parse({ filters: JSON.stringify(conditions) }).filters
      ).toEqual(conditions)
    })

    it('accepts array values for the in operator', () => {
      const conditions = [{ field: 'status', op: 'in', value: ['a', 'b'] }]
      expect(
        schema.parse({ filters: JSON.stringify(conditions) }).filters
      ).toEqual(conditions)
    })

    it('accepts all supported operators', () => {
      const ops = [
        'eq',
        'neq',
        'contains',
        'startsWith',
        'endsWith',
        'gt',
        'gte',
        'lt',
        'lte',
        'isNull',
        'isNotNull',
        'in',
        'between',
      ]
      for (const op of ops) {
        const result = schema.parse({
          filters: JSON.stringify([{ field: 'name', op, value: 'x' }]),
        })
        expect(result.filters).toHaveLength(1)
      }
    })

    it('returns empty array when a condition field is not in the allowed list', () => {
      expect(
        schema.parse({
          filters: JSON.stringify([{ field: 'unknown', op: 'eq', value: 'x' }]),
        }).filters
      ).toEqual([])
    })

    it('returns empty array when a condition has an invalid operator', () => {
      expect(
        schema.parse({
          filters: JSON.stringify([
            { field: 'name', op: 'invalid', value: 'x' },
          ]),
        }).filters
      ).toEqual([])
    })
  })

  describe('filterLogic field', () => {
    it('defaults to AND', () => {
      expect(schema.parse({}).filterLogic).toBe('AND')
    })

    it('accepts AND explicitly', () => {
      expect(schema.parse({ filterLogic: 'AND' }).filterLogic).toBe('AND')
    })

    it('accepts OR', () => {
      expect(schema.parse({ filterLogic: 'OR' }).filterLogic).toBe('OR')
    })

    it('rejects invalid values', () => {
      expect(() => schema.parse({ filterLogic: 'and' })).toThrow()
      expect(() => schema.parse({ filterLogic: 'INVALID' })).toThrow()
    })
  })
})

describe('buildFilterWhereClause', () => {
  it('returns undefined for an empty conditions array', () => {
    expect(buildFilterWhereClause([], 'AND', columnMap)).toBeUndefined()
  })

  it('returns undefined when all conditions reference a missing column', () => {
    const result = buildFilterWhereClause<string>(
      [{ field: 'unknown', op: 'eq', value: 'x' }],
      'AND',
      {} as Record<string, AnyColumn>
    )
    expect(result).toBeUndefined()
  })

  describe('operators', () => {
    it('eq: generates an equality condition', () => {
      const result = buildFilterWhereClause(
        [{ field: 'name', op: 'eq', value: 'alice' }],
        'AND',
        columnMap
      )!
      const { sql, params } = toSQL(result)
      expect(sql).toContain('= $1')
      expect(params).toEqual(['alice'])
    })

    it('eq: skips the condition when value is null', () => {
      expect(
        buildFilterWhereClause(
          [{ field: 'name', op: 'eq', value: null }],
          'AND',
          columnMap
        )
      ).toBeUndefined()
    })

    it('neq: generates an inequality condition', () => {
      const result = buildFilterWhereClause(
        [{ field: 'status', op: 'neq', value: 'inactive' }],
        'AND',
        columnMap
      )!
      const { sql, params } = toSQL(result)
      expect(sql).toContain('<>')
      expect(params).toEqual(['inactive'])
    })

    it('neq: skips the condition when value is null', () => {
      expect(
        buildFilterWhereClause(
          [{ field: 'name', op: 'neq', value: null }],
          'AND',
          columnMap
        )
      ).toBeUndefined()
    })

    it('contains: generates case-insensitive ILIKE with %value%', () => {
      const result = buildFilterWhereClause(
        [{ field: 'name', op: 'contains', value: 'hello' }],
        'AND',
        columnMap
      )!
      const { sql, params } = toSQL(result)
      expect(sql.toLowerCase()).toContain('ilike')
      expect(params).toEqual(['%hello%'])
    })

    it('contains: skips the condition for a non-string value', () => {
      expect(
        buildFilterWhereClause(
          [{ field: 'count', op: 'contains', value: 42 }],
          'AND',
          columnMap
        )
      ).toBeUndefined()
    })

    it('startsWith: generates ILIKE with value%', () => {
      const result = buildFilterWhereClause(
        [{ field: 'name', op: 'startsWith', value: 'hel' }],
        'AND',
        columnMap
      )!
      const { sql, params } = toSQL(result)
      expect(sql.toLowerCase()).toContain('ilike')
      expect(params).toEqual(['hel%'])
    })

    it('startsWith: skips the condition for a non-string value', () => {
      expect(
        buildFilterWhereClause(
          [{ field: 'count', op: 'startsWith', value: 1 }],
          'AND',
          columnMap
        )
      ).toBeUndefined()
    })

    it('endsWith: generates ILIKE with %value', () => {
      const result = buildFilterWhereClause(
        [{ field: 'name', op: 'endsWith', value: 'llo' }],
        'AND',
        columnMap
      )!
      const { sql, params } = toSQL(result)
      expect(sql.toLowerCase()).toContain('ilike')
      expect(params).toEqual(['%llo'])
    })

    it('endsWith: skips the condition for a non-string value', () => {
      expect(
        buildFilterWhereClause(
          [{ field: 'count', op: 'endsWith', value: 1 }],
          'AND',
          columnMap
        )
      ).toBeUndefined()
    })

    it('gt: generates a greater-than condition', () => {
      const result = buildFilterWhereClause(
        [{ field: 'count', op: 'gt', value: 5 }],
        'AND',
        columnMap
      )!
      const { sql, params } = toSQL(result)
      expect(sql).toContain('> $1')
      expect(params).toEqual([5])
    })

    it('gt: skips the condition when value is null', () => {
      expect(
        buildFilterWhereClause(
          [{ field: 'count', op: 'gt', value: null }],
          'AND',
          columnMap
        )
      ).toBeUndefined()
    })

    it('gte: generates a greater-than-or-equal condition', () => {
      const result = buildFilterWhereClause(
        [{ field: 'count', op: 'gte', value: 10 }],
        'AND',
        columnMap
      )!
      const { sql, params } = toSQL(result)
      expect(sql).toContain('>= $1')
      expect(params).toEqual([10])
    })

    it('lt: generates a less-than condition', () => {
      const result = buildFilterWhereClause(
        [{ field: 'count', op: 'lt', value: 3 }],
        'AND',
        columnMap
      )!
      const { sql, params } = toSQL(result)
      expect(sql).toContain('< $1')
      expect(params).toEqual([3])
    })

    it('lte: generates a less-than-or-equal condition', () => {
      const result = buildFilterWhereClause(
        [{ field: 'count', op: 'lte', value: 7 }],
        'AND',
        columnMap
      )!
      const { sql, params } = toSQL(result)
      expect(sql).toContain('<= $1')
      expect(params).toEqual([7])
    })

    it('isNull: generates IS NULL without requiring a value', () => {
      const result = buildFilterWhereClause(
        [{ field: 'name', op: 'isNull' }],
        'AND',
        columnMap
      )!
      expect(toSQL(result).sql.toLowerCase()).toContain('is null')
    })

    it('isNotNull: generates IS NOT NULL without requiring a value', () => {
      const result = buildFilterWhereClause(
        [{ field: 'name', op: 'isNotNull' }],
        'AND',
        columnMap
      )!
      expect(toSQL(result).sql.toLowerCase()).toContain('is not null')
    })

    it('in: generates an IN clause for an array of values', () => {
      const result = buildFilterWhereClause(
        [{ field: 'status', op: 'in', value: ['active', 'pending'] }],
        'AND',
        columnMap
      )!
      const { sql, params } = toSQL(result)
      expect(sql.toLowerCase()).toContain(' in (')
      expect(params).toEqual(['active', 'pending'])
    })

    it('in: skips the condition when the array is empty', () => {
      expect(
        buildFilterWhereClause(
          [{ field: 'status', op: 'in', value: [] }],
          'AND',
          columnMap
        )
      ).toBeUndefined()
    })

    it('in: skips the condition when value is not an array', () => {
      expect(
        buildFilterWhereClause(
          [{ field: 'status', op: 'in', value: 'active' }],
          'AND',
          columnMap
        )
      ).toBeUndefined()
    })
  })

  describe('between', () => {
    it('generates an inclusive BETWEEN for a [from, to] pair', () => {
      const result = buildFilterWhereClause(
        [{ field: 'count', op: 'between', value: [2, 5] }],
        'AND',
        columnMap
      )!
      const { sql, params } = toSQL(result)
      expect(sql.toLowerCase()).toContain(' between ')
      expect(params).toEqual([2, 5])
    })

    it.each([
      ['a single value', 3],
      ['one bound', [3]],
      ['three values', [1, 2, 3]],
      ['an empty bound', ['', '5']],
    ])('skips the condition for %s', (_, value) => {
      expect(
        buildFilterWhereClause(
          [{ field: 'count', op: 'between', value }],
          'AND',
          columnMap
        )
      ).toBeUndefined()
    })

    it('coerces each bound', () => {
      const result = buildFilterWhereClause(
        [{ field: 'count', op: 'between', value: ['2', '5'] }],
        'AND',
        columnMap,
        { coerce: { count: (v) => Number(v) } }
      )!
      expect(toSQL(result).params).toEqual([2, 5])
    })
  })

  describe('coerce', () => {
    it('coerces each item of an in list', () => {
      const result = buildFilterWhereClause(
        [{ field: 'count', op: 'in', value: ['1', '2'] }],
        'AND',
        columnMap,
        { coerce: { count: (v) => Number(v) } }
      )!
      expect(toSQL(result).params).toEqual([1, 2])
    })
  })

  describe('logic', () => {
    it('returns the single SQL expression directly when there is only one condition', () => {
      const result = buildFilterWhereClause(
        [{ field: 'name', op: 'eq', value: 'alice' }],
        'AND',
        columnMap
      )!
      const { sql } = toSQL(result)
      expect(sql.toLowerCase()).not.toContain(' and ')
      expect(sql.toLowerCase()).not.toContain(' or ')
    })

    it('AND: wraps multiple conditions with AND', () => {
      const result = buildFilterWhereClause(
        [
          { field: 'name', op: 'eq', value: 'alice' },
          { field: 'status', op: 'eq', value: 'active' },
        ],
        'AND',
        columnMap
      )!
      expect(toSQL(result).sql.toLowerCase()).toContain(' and ')
    })

    it('OR: wraps multiple conditions with OR', () => {
      const result = buildFilterWhereClause(
        [
          { field: 'name', op: 'eq', value: 'alice' },
          { field: 'status', op: 'eq', value: 'active' },
        ],
        'OR',
        columnMap
      )!
      expect(toSQL(result).sql.toLowerCase()).toContain(' or ')
    })

    it('returns undefined when all conditions resolve to nothing (skipped values)', () => {
      const result = buildFilterWhereClause(
        [
          { field: 'name', op: 'eq', value: null },
          { field: 'status', op: 'neq', value: null },
        ],
        'AND',
        columnMap
      )
      expect(result).toBeUndefined()
    })
  })

  describe('coerce', () => {
    it('applies the coerce function to the raw value before the Drizzle operator', () => {
      const coerce = { count: (v: unknown) => (v as number) * 2 }
      const result = buildFilterWhereClause(
        [{ field: 'count', op: 'eq', value: 5 }],
        'AND',
        columnMap,
        { coerce }
      )!
      expect(toSQL(result).params).toEqual([10])
    })

    it('does not call the coerce function when value is null', () => {
      const coerce = {
        name: () => {
          throw new Error('coerce must not be called for null values')
        },
      }
      expect(() =>
        buildFilterWhereClause(
          [{ field: 'name', op: 'eq', value: null }],
          'AND',
          columnMap,
          { coerce }
        )
      ).not.toThrow()
    })

    it('does not call the coerce function for isNull (no value to coerce)', () => {
      const coerce = {
        name: () => {
          throw new Error('coerce must not be called for isNull')
        },
      }
      const result = buildFilterWhereClause(
        [{ field: 'name', op: 'isNull' }],
        'AND',
        columnMap,
        { coerce }
      )
      expect(result).toBeDefined()
    })

    it('transforms ISO strings to Date objects for timestamp comparisons', () => {
      const iso = '2024-06-15T00:00:00.000Z'
      const coerce = { name: (v: unknown) => new Date(v as string) }
      const result = buildFilterWhereClause(
        [{ field: 'name', op: 'eq', value: iso }],
        'AND',
        columnMap,
        { coerce }
      )!
      expect(toSQL(result).params).toEqual([new Date(iso)])
    })
  })
})

describe('normalized text columns', () => {
  const normalized: Partial<Record<keyof typeof columnMap, AnyColumn>> = {
    name: testTable.normalizedName,
  }

  it.each([
    ['contains', '%acao rapida%'],
    ['startsWith', 'acao rapida%'],
    ['endsWith', '%acao rapida'],
  ] as const)(
    '%s: LIKE on the normalized column with the normalized value',
    (op, pattern) => {
      const { sql, params } = toSQL(
        buildFilterWhereClause(
          [{ field: 'name', op, value: '  Ação   RÁPIDA ' }],
          'AND',
          columnMap,
          { normalized }
        )!
      )
      expect(sql).toContain('"normalized_name" like')
      expect(params).toEqual([pattern])
    }
  )

  it('keeps eq exact on the original column', () => {
    const { sql, params } = toSQL(
      buildFilterWhereClause(
        [{ field: 'name', op: 'eq', value: 'Ação' }],
        'AND',
        columnMap,
        { normalized }
      )!
    )
    expect(sql).toContain('"name" =')
    expect(params).toEqual(['Ação'])
  })

  it('escapes LIKE wildcards after normalizing', () => {
    const { params } = toSQL(
      buildFilterWhereClause(
        [{ field: 'name', op: 'contains', value: '50%_OFF' }],
        'AND',
        columnMap,
        { normalized }
      )!
    )
    expect(params).toEqual(['%50\\%\\_off%'])
  })

  it('escapes LIKE wildcards on a field without a normalized column', () => {
    const { params } = toSQL(
      buildFilterWhereClause(
        [{ field: 'status', op: 'contains', value: '50%' }],
        'AND',
        columnMap,
        { normalized }
      )!
    )
    expect(params).toEqual(['%50\\%%'])
  })

  it('skips a value that normalizes to nothing', () => {
    expect(
      buildFilterWhereClause(
        [{ field: 'name', op: 'contains', value: '\u0301' }],
        'AND',
        columnMap,
        { normalized }
      )
    ).toBeUndefined()
  })
})

describe('searchQuerySchema', () => {
  it.each([
    [undefined, undefined],
    ['', undefined],
    ['   ', undefined],
    ['  milk ', 'milk'],
  ])('reads %j as %j', (input, expected) => {
    expect(searchQuerySchema.parse({ search: input }).search).toBe(expected)
  })

  it('rejects more than 200 characters', () => {
    expect(() => searchQuerySchema.parse({ search: 'x'.repeat(201) })).toThrow()
  })
})

describe('buildSearchClause', () => {
  it('returns undefined without a term', () => {
    expect(
      buildSearchClause(undefined, [testTable.normalizedName])
    ).toBeUndefined()
  })

  it('matches the normalized term in any of the columns with LIKE', () => {
    const { sql, params } = toSQL(
      buildSearchClause('  São   PAULO ', [
        testTable.normalizedName,
        testTable.status,
      ])!
    )
    expect(sql.toLowerCase()).toContain(' like ')
    expect(sql.toLowerCase()).not.toContain('ilike')
    expect(sql.toLowerCase()).toContain(' or ')
    expect(params).toEqual(['%sao paulo%', '%sao paulo%'])
  })

  it('escapes LIKE wildcards in the term', () => {
    const { params } = toSQL(
      buildSearchClause('50%_off', [testTable.normalizedName])!
    )
    expect(params).toEqual(['%50\\%\\_off%'])
  })

  it('returns undefined when the term normalizes to nothing', () => {
    expect(
      buildSearchClause('\u0301', [testTable.normalizedName])
    ).toBeUndefined()
  })
})
