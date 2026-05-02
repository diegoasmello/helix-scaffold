import { describe, expect, it } from 'vitest'
import z from 'zod'

import {
  buildPaginatedResponse,
  getPaginationParams,
  paginatedResponseSchema,
  paginationQuerySchema,
} from './pagination'

describe('paginationQuerySchema', () => {
  it('applies defaults when no input is provided', () => {
    const result = paginationQuerySchema.parse({})
    expect(result).toEqual({ page: 1, pageSize: 10 })
  })

  it('coerces string values to numbers', () => {
    const result = paginationQuerySchema.parse({ page: '3', pageSize: '25' })
    expect(result).toEqual({ page: 3, pageSize: 25 })
  })

  it('accepts values at the boundaries', () => {
    expect(paginationQuerySchema.parse({ page: 1, pageSize: 1 })).toEqual({
      page: 1,
      pageSize: 1,
    })
    expect(paginationQuerySchema.parse({ page: 999, pageSize: 100 })).toEqual({
      page: 999,
      pageSize: 100,
    })
  })

  it('rejects page less than 1', () => {
    expect(() => paginationQuerySchema.parse({ page: 0 })).toThrow()
    expect(() => paginationQuerySchema.parse({ page: -1 })).toThrow()
  })

  it('rejects pageSize less than 1', () => {
    expect(() => paginationQuerySchema.parse({ pageSize: 0 })).toThrow()
  })

  it('rejects pageSize greater than 100', () => {
    expect(() => paginationQuerySchema.parse({ pageSize: 101 })).toThrow()
  })

  it('rejects non-integer values', () => {
    expect(() => paginationQuerySchema.parse({ page: 1.5 })).toThrow()
    expect(() => paginationQuerySchema.parse({ pageSize: 10.9 })).toThrow()
  })
})

describe('paginatedResponseSchema', () => {
  const schema = paginatedResponseSchema(z.object({ id: z.string() }))

  it('validates a correct paginated response', () => {
    const input = {
      data: [{ id: 'abc' }],
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    }
    expect(schema.parse(input)).toEqual(input)
  })

  it('rejects a response missing required fields', () => {
    expect(() => schema.parse({ data: [], total: 0 })).toThrow()
  })

  it('rejects items that do not match the item schema', () => {
    const input = {
      data: [{ id: 123 }],
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    }
    expect(() => schema.parse(input)).toThrow()
  })
})

describe('getPaginationParams', () => {
  it('returns offset 0 for the first page', () => {
    expect(getPaginationParams(1, 10)).toEqual({ limit: 10, offset: 0 })
  })

  it('calculates offset correctly for subsequent pages', () => {
    expect(getPaginationParams(2, 10)).toEqual({ limit: 10, offset: 10 })
    expect(getPaginationParams(3, 10)).toEqual({ limit: 10, offset: 20 })
  })

  it('respects custom pageSize in limit and offset', () => {
    expect(getPaginationParams(2, 5)).toEqual({ limit: 5, offset: 5 })
    expect(getPaginationParams(3, 5)).toEqual({ limit: 5, offset: 10 })
  })
})

describe('buildPaginatedResponse', () => {
  it('returns an empty response when there are no items', () => {
    const result = buildPaginatedResponse([], 0, { page: 1, pageSize: 10 })
    expect(result).toEqual({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    })
  })

  it('calculates totalPages using ceiling division', () => {
    const result = buildPaginatedResponse([], 11, { page: 1, pageSize: 10 })
    expect(result.totalPages).toBe(2)
  })

  it('calculates totalPages exactly when total is divisible by pageSize', () => {
    const result = buildPaginatedResponse([], 20, { page: 1, pageSize: 10 })
    expect(result.totalPages).toBe(2)
  })

  it('returns totalPages 1 when total is less than pageSize', () => {
    const result = buildPaginatedResponse([], 3, { page: 1, pageSize: 10 })
    expect(result.totalPages).toBe(1)
  })

  it('passes data, page, and pageSize through unchanged', () => {
    const data = [{ id: '1' }, { id: '2' }]
    const result = buildPaginatedResponse(data, 50, { page: 3, pageSize: 15 })
    expect(result.data).toBe(data)
    expect(result.page).toBe(3)
    expect(result.pageSize).toBe(15)
    expect(result.total).toBe(50)
  })
})
