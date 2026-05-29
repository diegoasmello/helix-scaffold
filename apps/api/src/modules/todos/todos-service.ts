import { asc, count, desc, eq, inArray } from 'drizzle-orm'

import type { Database } from '@/db'
import { todoAttachments, todos, uploads } from '@/db/schema'
import { buildFilterWhereClause } from '@/lib/filtering'
import { getPaginationParams } from '@/lib/pagination'
import type { StorageProvider } from '@/lib/storage'

import type {
  CreateTodoInput,
  TodosExportQuery,
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

async function getUploadsById(
  database: Database,
  ids: string[],
): Promise<Record<string, typeof uploads.$inferSelect>> {
  if (ids.length === 0) return {}
  const rows = await database
    .select()
    .from(uploads)
    .where(inArray(uploads.id, ids))
  return Object.fromEntries(rows.map((u) => [u.id, u]))
}

function deleteUploadKeys(
  storage: StorageProvider,
  uploadList: (typeof uploads.$inferSelect)[],
) {
  const keys = uploadList.flatMap((u) => {
    const result = [u.storageKey]
    if (u.variants) {
      result.push(
        u.variants.thumbnail.key,
        u.variants.small.key,
        u.variants.medium.key,
        u.variants.large.key,
      )
    }
    return result
  })
  return Promise.allSettled(keys.map((k) => storage.delete(k)))
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

    const todoIds = data.map((t) => t.id)
    const singleUploadIds = [
      ...new Set(
        data.flatMap((t) => [t.fileId, t.imageId].filter(Boolean) as string[]),
      ),
    ]

    const [attachmentsMap, uploadsById] = await Promise.all([
      getAttachmentsForTodos(database, todoIds),
      getUploadsById(database, singleUploadIds),
    ])

    return {
      data: data.map((t) => ({
        ...t,
        attachments: attachmentsMap[t.id] ?? [],
        file: t.fileId ? (uploadsById[t.fileId] ?? null) : null,
        image: t.imageId ? (uploadsById[t.imageId] ?? null) : null,
      })),
      total,
    }
  }

  async function getById(id: string) {
    const [todo] = await database.select().from(todos).where(eq(todos.id, id))
    if (!todo) return null

    const singleUploadIds = [todo.fileId, todo.imageId].filter(
      Boolean,
    ) as string[]

    const [attachmentsMap, uploadsById] = await Promise.all([
      getAttachmentsForTodos(database, [id]),
      getUploadsById(database, singleUploadIds),
    ])

    return {
      ...todo,
      attachments: attachmentsMap[id] ?? [],
      file: todo.fileId ? (uploadsById[todo.fileId] ?? null) : null,
      image: todo.imageId ? (uploadsById[todo.imageId] ?? null) : null,
    }
  }

  async function create(data: CreateTodoInput) {
    const { attachmentIds = [], ...todoData } = data
    const [todo] = await database.insert(todos).values(todoData).returning()
    await syncAttachments(database, todo.id, attachmentIds)

    const singleUploadIds = [todo.fileId, todo.imageId].filter(
      Boolean,
    ) as string[]
    const [attachmentsMap, uploadsById] = await Promise.all([
      getAttachmentsForTodos(database, [todo.id]),
      getUploadsById(database, singleUploadIds),
    ])

    return {
      ...todo,
      attachments: attachmentsMap[todo.id] ?? [],
      file: todo.fileId ? (uploadsById[todo.fileId] ?? null) : null,
      image: todo.imageId ? (uploadsById[todo.imageId] ?? null) : null,
    }
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

    const singleUploadIds = [todo.fileId, todo.imageId].filter(
      Boolean,
    ) as string[]
    const [attachmentsMap, uploadsById] = await Promise.all([
      getAttachmentsForTodos(database, [id]),
      getUploadsById(database, singleUploadIds),
    ])

    return {
      ...todo,
      attachments: attachmentsMap[id] ?? [],
      file: todo.fileId ? (uploadsById[todo.fileId] ?? null) : null,
      image: todo.imageId ? (uploadsById[todo.imageId] ?? null) : null,
    }
  }

  async function remove(id: string) {
    const [todo] = await database.select().from(todos).where(eq(todos.id, id))
    if (!todo) return

    const singleUploadIds = [todo.fileId, todo.imageId].filter(
      Boolean,
    ) as string[]

    const [attachmentsMap, singleUploads] = await Promise.all([
      getAttachmentsForTodos(database, [id]),
      singleUploadIds.length > 0
        ? database.select().from(uploads).where(inArray(uploads.id, singleUploadIds))
        : Promise.resolve([]),
    ])

    const attachmentList = attachmentsMap[id] ?? []
    const allUploads = [...attachmentList, ...singleUploads]
    const allUploadIds = allUploads.map((u) => u.id)

    await database.delete(todos).where(eq(todos.id, id))

    if (allUploadIds.length > 0) {
      await database.delete(uploads).where(inArray(uploads.id, allUploadIds))
      await deleteUploadKeys(storage, allUploads)
    }
  }

  async function generateReport(query: TodosExportQuery): Promise<Buffer> {
    const sortCol = SORT_COLUMNS[query.sortBy ?? 'createdAt']
    const sortFn = query.sortOrder === 'desc' ? desc : asc
    const where = buildFilterWhereClause(
      query.filters,
      query.filterLogic,
      FILTER_COLUMNS,
      FILTER_COERCE,
    )

    const data = await database
      .select()
      .from(todos)
      .where(where)
      .orderBy(sortFn(sortCol))
      .limit(5000)

    const { renderTodosReport } = await import('./templates/todos-report')
    return renderTodosReport(data)
  }

  return { list, getById, create, update, remove, generateReport }
}

export type TodosService = ReturnType<typeof createTodosService>
