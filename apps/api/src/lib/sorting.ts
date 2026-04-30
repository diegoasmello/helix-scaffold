import z from 'zod'

export function sortingQuerySchema<const T extends string>(
  columns: [T, ...T[]]
) {
  return z.object({
    sortBy: z.enum(columns).optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  })
}

export type SortingQuery<T extends string = string> = {
  sortBy?: T
  sortOrder: 'asc' | 'desc'
}
