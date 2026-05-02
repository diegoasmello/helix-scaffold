import { describe, expect, it } from 'vitest'

import { sortingQuerySchema } from './sorting'

describe('sortingQuerySchema', () => {
  const schema = sortingQuerySchema(['title', 'createdAt'])

  it('applies defaults when no input is provided', () => {
    const result = schema.parse({})
    expect(result).toEqual({ sortOrder: 'asc' })
    expect(result.sortBy).toBeUndefined()
  })

  it('accepts a valid sortBy column', () => {
    expect(schema.parse({ sortBy: 'title' })).toEqual({
      sortBy: 'title',
      sortOrder: 'asc',
    })
    expect(schema.parse({ sortBy: 'createdAt' })).toEqual({
      sortBy: 'createdAt',
      sortOrder: 'asc',
    })
  })

  it('accepts both sortOrder values', () => {
    expect(schema.parse({ sortOrder: 'asc' }).sortOrder).toBe('asc')
    expect(schema.parse({ sortOrder: 'desc' }).sortOrder).toBe('desc')
  })

  it('accepts sortBy together with sortOrder', () => {
    expect(schema.parse({ sortBy: 'title', sortOrder: 'desc' })).toEqual({
      sortBy: 'title',
      sortOrder: 'desc',
    })
  })

  it('rejects an unknown sortBy column', () => {
    expect(() => schema.parse({ sortBy: 'unknown' })).toThrow()
  })

  it('rejects an invalid sortOrder value', () => {
    expect(() => schema.parse({ sortOrder: 'random' })).toThrow()
  })

  it('works with a single-column tuple', () => {
    const singleSchema = sortingQuerySchema(['name'])
    expect(singleSchema.parse({ sortBy: 'name' })).toEqual({
      sortBy: 'name',
      sortOrder: 'asc',
    })
    expect(() => singleSchema.parse({ sortBy: 'other' })).toThrow()
  })
})
