import { describe, expect, it, vi } from 'vitest'

import {
  filtersSearchParam,
  getFilterBarProps,
  parseFilterConditions,
  searchSearchParam,
} from './list-filters'

const VALID = JSON.stringify([{ field: 'status', op: 'eq', value: 'pending' }])

describe('parseFilterConditions', () => {
  it('returns the conditions of a valid JSON list', () => {
    expect(parseFilterConditions(VALID)).toEqual([
      { field: 'status', op: 'eq', value: 'pending' },
    ])
  })

  it('keeps conditions without a value (isNull / isNotNull)', () => {
    expect(parseFilterConditions('[{"field":"date","op":"isNull"}]')).toEqual([
      { field: 'date', op: 'isNull' },
    ])
  })

  it.each([
    ['undefined', undefined],
    ['an empty string', ''],
    ['malformed JSON', 'abc'],
    ['a truncated list', '[{"field":"status"'],
    ['a JSON object', '{"field":"status","op":"eq"}'],
    ['a number', '123'],
    ['a condition without op', '[{"field":"status"}]'],
    [
      'a condition with an object value',
      '[{"field":"a","op":"eq","value":{}}]',
    ],
  ])('returns no conditions for %s', (_, input) => {
    expect(parseFilterConditions(input)).toEqual([])
  })
})

describe('filtersSearchParam', () => {
  it('keeps a valid JSON string as is', () => {
    expect(filtersSearchParam.parse(VALID)).toBe(VALID)
  })

  it('re-encodes a list TanStack Router already JSON-parsed', () => {
    const parsed = [{ field: 'status', op: 'eq', value: 'pending' }]
    expect(filtersSearchParam.parse(parsed)).toBe(JSON.stringify(parsed))
  })

  it.each([
    ['missing', undefined],
    ['malformed JSON', 'abc'],
    ['a number', 1],
    ['an empty list', '[]'],
    ['an invalid condition', '[{"op":"eq"}]'],
  ])('drops the param when it is %s', (_, input) => {
    expect(filtersSearchParam.parse(input)).toBeUndefined()
  })
})

describe('getFilterBarProps', () => {
  const search = {
    page: 3,
    pageSize: 10,
    filterLogic: 'AND' as const,
    filters: JSON.stringify([
      { field: 'date', op: 'between', value: ['2026-10-01', '2026-10-31'] },
    ]),
  }

  it('reads the conditions and logic from the search', () => {
    const { value } = getFilterBarProps(search, vi.fn())
    expect(value).toEqual({
      logic: 'AND',
      conditions: [
        { field: 'date', op: 'between', value: ['2026-10-01', '2026-10-31'] },
      ],
    })
  })

  it('writes a change back to the URL, on page 1', () => {
    const navigate = vi.fn()
    getFilterBarProps(search, navigate).onChange({
      logic: 'OR',
      conditions: [{ field: 'count', op: 'in', value: [1, 2] }],
    })
    const [{ search: update }] = navigate.mock.calls[0]
    expect(update(search)).toEqual({
      ...search,
      page: 1,
      filterLogic: 'OR',
      filters: '[{"field":"count","op":"in","value":[1,2]}]',
    })
  })

  it('drops the filters param when no condition is left', () => {
    const navigate = vi.fn()
    getFilterBarProps(search, navigate).onChange({
      logic: 'AND',
      conditions: [],
    })
    const [{ search: update }] = navigate.mock.calls[0]
    expect(update(search).filters).toBeUndefined()
  })
})

describe('searchSearchParam', () => {
  it.each([
    [undefined, undefined],
    ['  milk ', 'milk'],
    ['   ', undefined],
    [2026, '2026'],
    [['a'], undefined],
  ])('reads %j as %j', (raw, expected) => {
    expect(searchSearchParam.parse(raw)).toBe(expected)
  })

  it('cuts at 200 characters', () => {
    expect(searchSearchParam.parse('x'.repeat(250))).toHaveLength(200)
  })
})

describe('getFilterBarProps search', () => {
  const search = {
    page: 2,
    filterLogic: 'AND' as const,
    filters: undefined as string | undefined,
    search: 'milk' as string | undefined,
  }

  it('binds the search box only when asked', () => {
    expect(getFilterBarProps(search, vi.fn()).search).toBeUndefined()
    expect(
      getFilterBarProps(search, vi.fn(), { withSearch: true }).search?.value
    ).toBe('milk')
  })

  it('counts a search as narrowing the list', () => {
    expect(getFilterBarProps(search, vi.fn()).active).toBe(true)
    expect(
      getFilterBarProps({ ...search, search: undefined }, vi.fn()).active
    ).toBe(false)
  })

  it('writes the search back, blank removing it', () => {
    const navigate = vi.fn()
    const props = getFilterBarProps(search, navigate, { withSearch: true })
    props.search?.onChange('  ')
    const [{ search: update }] = navigate.mock.calls[0]
    expect(update(search)).toEqual({ ...search, search: undefined, page: 1 })
  })

  it('clears the filters and the search together', () => {
    const navigate = vi.fn()
    getFilterBarProps(
      { ...search, filters: '[{"field":"a","op":"eq","value":1}]' },
      navigate
    ).clearAll()
    const [{ search: update }] = navigate.mock.calls[0]
    const next = update(search)
    expect(next.filters).toBeUndefined()
    expect(next.search).toBeUndefined()
    expect(next.page).toBe(1)
  })
})
