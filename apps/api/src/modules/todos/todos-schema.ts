import z from 'zod'

import {
  paginatedResponseSchema,
  paginationQuerySchema,
} from '@/lib/pagination'
import { sortingQuerySchema } from '@/lib/sorting'

export const todoSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    content: z.string(),
    status: z.enum(['pending', 'completed']),
    date: z.date(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .meta({ id: 'Todo', title: 'Todo' })

export const createTodoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
  content: z.string().min(1).max(1000),
  date: z.coerce.date(),
})

export const updateTodoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(1000).optional(),
  status: z.enum(['pending', 'completed']).optional(),
  date: z.coerce.date().optional(),
})

export const paginatedTodosSchema = paginatedResponseSchema(todoSchema).meta({
  id: 'PaginatedTodos',
  title: 'PaginatedTodos',
})

export const TODO_SORT_COLUMNS = [
  'title',
  'status',
  'date',
  'createdAt',
] as const
export type TodoSortColumn = (typeof TODO_SORT_COLUMNS)[number]

export const todosSortingSchema = sortingQuerySchema([...TODO_SORT_COLUMNS])
export const todosListQuerySchema =
  paginationQuerySchema.merge(todosSortingSchema)
export type TodosListQuery = z.infer<typeof todosListQuerySchema>

export type CreateTodoInput = z.infer<typeof createTodoSchema>
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>
export type PaginatedTodos = z.infer<typeof paginatedTodosSchema>
