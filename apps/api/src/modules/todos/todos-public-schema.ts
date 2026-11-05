import z from 'zod'

import { searchQuerySchema } from '@/lib/filtering'
import {
  paginatedResponseSchema,
  paginationQuerySchema,
} from '@/lib/pagination'

import { publicUploadSchema } from '../uploads/uploads-schema'

// What a site sees of a published todo — every field listed on purpose. A
// column added to `todos` stays out of the public API until it is added here
// (and to the public service's select). Left out: the id (a site addresses
// todos by slug), `status` (the team's workflow), the attachments (internal
// files) and `createdAt` (a draft's age).
export const publicTodoSchema = z
  .object({
    slug: z.string().describe('The todo’s URL identifier — never changes'),
    title: z.string(),
    description: z.string(),
    content: z
      .string()
      .describe(
        'Rich text (HTML), sanitized by the API on save — safe to insert as HTML'
      ),
    date: z.iso.date().describe('A calendar day, YYYY-MM-DD'),
    image: publicUploadSchema.nullable(),
    file: publicUploadSchema.nullable().describe('A PDF'),
    publishedAt: z.date().describe('When it was first published'),
    updatedAt: z.date(),
  })
  .meta({ id: 'PublicTodo', title: 'PublicTodo' })

export const paginatedPublicTodosSchema = paginatedResponseSchema(
  publicTodoSchema
).meta({ id: 'PaginatedPublicTodos', title: 'PaginatedPublicTodos' })

const PUBLIC_TODO_SORT_COLUMNS = ['publishedAt', 'date', 'title'] as const

/**
 * The direction of each sort column when `sortOrder` is not sent: the
 * newest publication first, like a site's feed; the others ascending (A→Z,
 * the earliest day), like the admin's lists.
 */
export const PUBLIC_TODO_DEFAULT_ORDER = {
  publishedAt: 'desc',
  date: 'asc',
  title: 'asc',
} as const satisfies Record<
  (typeof PUBLIC_TODO_SORT_COLUMNS)[number],
  'asc' | 'desc'
>

// Newest publication first by default. No `filters`: the admin's filter
// language reaches columns a site has no business querying.
export const publicTodosListQuerySchema = paginationQuerySchema
  .extend({
    sortBy: z.enum(PUBLIC_TODO_SORT_COLUMNS).default('publishedAt'),
    sortOrder: z
      .enum(['asc', 'desc'])
      .optional()
      .describe('Default: desc for publishedAt (newest first), asc otherwise'),
  })
  .merge(searchQuerySchema)
export type PublicTodosListQuery = z.infer<typeof publicTodosListQuerySchema>
