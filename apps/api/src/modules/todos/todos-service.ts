import { asc, count, desc, eq } from 'drizzle-orm'

import type { Database } from '@/db'
import { todos } from '@/db/schema'
import { getPaginationParams } from '@/lib/pagination'

import type {
  CreateTodoInput,
  TodosListQuery,
  UpdateTodoInput,
} from './todos-schema'

const SORT_COLUMNS = {
  title: todos.title,
  status: todos.status,
  date: todos.date,
  createdAt: todos.createdAt,
} as const

export function createTodosService(database: Database) {
  async function list(query: TodosListQuery) {
    const { limit, offset } = getPaginationParams(query.page, query.pageSize)
    const sortCol = SORT_COLUMNS[query.sortBy ?? 'createdAt']
    const sortFn = query.sortOrder === 'desc' ? desc : asc

    const [data, [{ total }]] = await Promise.all([
      database
        .select()
        .from(todos)
        .orderBy(sortFn(sortCol))
        .limit(limit)
        .offset(offset),
      database.select({ total: count() }).from(todos),
    ])
    return { data, total }
  }

  async function getById(id: string) {
    const [todo] = await database.select().from(todos).where(eq(todos.id, id))
    return todo ?? null
  }

  async function create(data: CreateTodoInput) {
    const [todo] = await database.insert(todos).values(data).returning()
    return todo
  }

  async function update(id: string, data: UpdateTodoInput) {
    const [todo] = await database
      .update(todos)
      .set(data)
      .where(eq(todos.id, id))
      .returning()
    return todo ?? null
  }

  async function remove(id: string) {
    await database.delete(todos).where(eq(todos.id, id))
  }

  return { list, getById, create, update, remove }
}

export type TodosService = ReturnType<typeof createTodosService>
