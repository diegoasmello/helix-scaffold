import z from 'zod'

import { filterQuerySchema, searchQuerySchema } from '@/lib/filtering'
import {
  paginatedResponseSchema,
  paginationQuerySchema,
} from '@/lib/pagination'
import { sortingQuerySchema } from '@/lib/sorting'

import { uploadSchema } from '../uploads/uploads-schema'

export const todoSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    content: z.string(),
    status: z.enum(['pending', 'completed']),
    date: z.date(),
    attachments: z.array(uploadSchema),
    file: uploadSchema.nullable(),
    image: uploadSchema.nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .meta({ id: 'Todo', title: 'Todo' })

export const createTodoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
  content: z.string().min(1).max(1000),
  date: z.coerce.date(),
  attachmentIds: z.array(z.string()).min(1),
  fileId: z.string(),
  imageId: z.string(),
})

export const updateTodoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(1000).optional(),
  status: z.enum(['pending', 'completed']).optional(),
  date: z.coerce.date().optional(),
  attachmentIds: z.array(z.string()).min(1).optional(),
  fileId: z.string().optional(),
  imageId: z.string().optional(),
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

export const TODO_FILTER_FIELDS = [
  'title',
  'description',
  'status',
  'date',
] as const
export type TodoFilterField = (typeof TODO_FILTER_FIELDS)[number]

export const todosSortingSchema = sortingQuerySchema([...TODO_SORT_COLUMNS])
export const todosFilterQuerySchema = filterQuerySchema([...TODO_FILTER_FIELDS])
export const todosListQuerySchema = paginationQuerySchema
  .merge(todosSortingSchema)
  .merge(todosFilterQuerySchema)
  .merge(searchQuerySchema)
export type TodosListQuery = z.infer<typeof todosListQuerySchema>

export const todosExportQuerySchema = todosSortingSchema
  .merge(todosFilterQuerySchema)
  .merge(searchQuerySchema)
export type TodosExportQuery = z.infer<typeof todosExportQuerySchema>

export type CreateTodoInput = z.infer<typeof createTodoSchema>
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>
export type PaginatedTodos = z.infer<typeof paginatedTodosSchema>
