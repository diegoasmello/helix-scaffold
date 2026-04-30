import z from 'zod'

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
})

export type PaginationQuery = z.infer<typeof paginationQuerySchema>

export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
    totalPages: z.number().int(),
  })
}

export function getPaginationParams(page: number, pageSize: number) {
  return { limit: pageSize, offset: (page - 1) * pageSize }
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  { page, pageSize }: PaginationQuery
) {
  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}
