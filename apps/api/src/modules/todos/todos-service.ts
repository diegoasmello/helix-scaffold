import { asc, count, desc, eq, inArray } from 'drizzle-orm'

import type { Database } from '@/db'
import { todoAttachments, todos, uploads } from '@/db/schema'
import { buildFilterWhereClause } from '@/lib/filtering'
import { getPaginationParams } from '@/lib/pagination'
import type { StorageProvider } from '@/lib/storage'

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

const FILTER_COLUMNS = {
  title: todos.title,
  description: todos.description,
  status: todos.status,
  date: todos.date,
} as const

const FILTER_COERCE = {
  date: (v: unknown) => (typeof v === 'string' ? new Date(v) : v),
} as const

async function getAttachmentsForTodos(
  database: Database,
  todoIds: string[],
): Promise<Record<string, (typeof uploads.$inferSelect)[]>> {
  if (todoIds.length === 0) return {}
  const rows = await database
    .select({
      todoId: todoAttachments.todoId,
      upload: uploads,
    })
    .from(todoAttachments)
    .innerJoin(uploads, eq(todoAttachments.uploadId, uploads.id))
    .where(inArray(todoAttachments.todoId, todoIds))

  const map: Record<string, (typeof uploads.$inferSelect)[]> = {}
  for (const row of rows) {
    if (!map[row.todoId]) map[row.todoId] = []
    map[row.todoId].push(row.upload)
  }
  return map
}

async function syncAttachments(
  database: Database,
  todoId: string,
  attachmentIds: string[],
) {
  await database
    .delete(todoAttachments)
    .where(eq(todoAttachments.todoId, todoId))
  if (attachmentIds.length > 0) {
    await database.insert(todoAttachments).values(
      attachmentIds.map((uploadId) => ({ todoId, uploadId })),
    )
  }
}

export function createTodosService(
  database: Database,
  storage: StorageProvider,
) {
  async function list(query: TodosListQuery) {
    const { limit, offset } = getPaginationParams(query.page, query.pageSize)
    const sortCol = SORT_COLUMNS[query.sortBy ?? 'createdAt']
    const sortFn = query.sortOrder === 'desc' ? desc : asc
    const where = buildFilterWhereClause(
      query.filters,
      query.filterLogic,
      FILTER_COLUMNS,
      FILTER_COERCE,
    )

    const [data, [{ total }]] = await Promise.all([
      database
        .select()
        .from(todos)
        .where(where)
        .orderBy(sortFn(sortCol))
        .limit(limit)
        .offset(offset),
      database.select({ total: count() }).from(todos).where(where),
    ])

    const attachmentsMap = await getAttachmentsForTodos(
      database,
      data.map((t) => t.id),
    )
    return {
      data: data.map((t) => ({ ...t, attachments: attachmentsMap[t.id] ?? [] })),
      total,
    }
  }

  async function getById(id: string) {
    const [todo] = await database.select().from(todos).where(eq(todos.id, id))
    if (!todo) return null
    const attachmentsMap = await getAttachmentsForTodos(database, [id])
    return { ...todo, attachments: attachmentsMap[id] ?? [] }
  }

  async function create(data: CreateTodoInput) {
    const { attachmentIds = [], ...todoData } = data
    const [todo] = await database.insert(todos).values(todoData).returning()
    await syncAttachments(database, todo.id, attachmentIds)
    const attachmentsMap = await getAttachmentsForTodos(database, [todo.id])
    return { ...todo, attachments: attachmentsMap[todo.id] ?? [] }
  }

  async function update(id: string, data: UpdateTodoInput) {
    const { attachmentIds, ...todoData } = data

    let todo: typeof todos.$inferSelect | undefined

    if (Object.keys(todoData).length > 0) {
      const [updated] = await database
        .update(todos)
        .set(todoData)
        .where(eq(todos.id, id))
        .returning()
      todo = updated
    } else {
      const [existing] = await database
        .select()
        .from(todos)
        .where(eq(todos.id, id))
      todo = existing
    }

    if (!todo) return null

    if (attachmentIds !== undefined) {
      await syncAttachments(database, id, attachmentIds)
    }
    const attachmentsMap = await getAttachmentsForTodos(database, [id])
    return { ...todo, attachments: attachmentsMap[id] ?? [] }
  }

  async function remove(id: string) {
    const attachmentsMap = await getAttachmentsForTodos(database, [id])
    const attachmentList = attachmentsMap[id] ?? []

    await database.delete(todos).where(eq(todos.id, id))

    if (attachmentList.length > 0) {
      const uploadIds = attachmentList.map((a) => a.id)
      await database
        .delete(uploads)
        .where(inArray(uploads.id, uploadIds))

      const keysToDelete = attachmentList.flatMap((a) => {
        const keys = [a.storageKey]
        if (a.variants) {
          keys.push(
            a.variants.thumbnail.key,
            a.variants.small.key,
            a.variants.medium.key,
            a.variants.large.key,
          )
        }
        return keys
      })
      await Promise.allSettled(keysToDelete.map((key) => storage.delete(key)))
    }
  }

  return { list, getById, create, update, remove }
}

export type TodosService = ReturnType<typeof createTodosService>
