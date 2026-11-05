import { and, asc, count, desc, eq, inArray, type SQL, sql } from 'drizzle-orm'

import type { Database } from '@/db'
import {
  TODO_NORMALIZED_FIELDS,
  TODO_SLUG,
  todoAttachments,
  todoContentImages,
  todos,
  uploads,
} from '@/db/schema'
import {
  buildFilterWhereClause,
  buildSearchClause,
  coerceCalendarDay,
  coerceInstant,
} from '@/lib/filtering'
import { normalizedValues } from '@/lib/normalize-text'
import { getPaginationParams } from '@/lib/pagination'
import { uploadIdsInHtml } from '@/lib/rich-text-uploads'
import { sanitizeRichText } from '@/lib/sanitize-rich-text'
import { withUniqueSlug } from '@/lib/slug'
import type { StorageProvider } from '@/lib/storage'
import {
  assertUsableUploads,
  IMAGE_TYPES,
  PDF_TYPES,
} from '@/lib/upload-ownership'

import type {
  CreateTodoInput,
  TodosExportQuery,
  TodosListQuery,
  UpdateTodoInput,
} from './todos-schema'

// `title` sorts by its normalized copy: `Árvore` next to `arvore`, not after `z`.
const SORT_COLUMNS = {
  title: todos.normalizedTitle,
  status: todos.status,
  date: todos.date,
  createdAt: todos.createdAt,
} as const

const FILTER_COLUMNS = {
  title: todos.title,
  description: todos.description,
  status: todos.status,
  published: todos.published,
  date: todos.date,
  createdAt: todos.createdAt,
} as const

// `contains`/`startsWith`/`endsWith` on these fields use the normalized copy;
// `eq`/`neq`/`in` stay exact on `FILTER_COLUMNS`.
const NORMALIZED_FILTER_COLUMNS = {
  title: todos.normalizedTitle,
  description: todos.normalizedDescription,
} as const

// The list's search box matches the title or the description.
const SEARCH_COLUMNS = [todos.normalizedTitle, todos.normalizedDescription]

// `date` is a calendar day: a filter value that is not `YYYY-MM-DD` is skipped.
// `createdAt` is an instant: a value that is not an ISO datetime with its zone
// is skipped — the web turns the user's days into instants (`toApiFilters()`).
const FILTER_COERCE = {
  date: coerceCalendarDay,
  createdAt: coerceInstant,
} as const

async function getAttachmentsForTodos(
  database: Database,
  todoIds: string[]
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
  attachmentIds: string[]
) {
  await database
    .delete(todoAttachments)
    .where(eq(todoAttachments.todoId, todoId))
  if (attachmentIds.length > 0) {
    await database
      .insert(todoAttachments)
      .values(attachmentIds.map((uploadId) => ({ todoId, uploadId })))
  }
}

/**
 * Replaces the images `content` shows (`todo_content_images`, filled from the
 * HTML by `uploadIdsInHtml()`). An image taken out of the text is no longer
 * referenced: the orphan cleanup deletes it.
 */
async function syncContentImages(
  database: Database,
  todoId: string,
  uploadIds: string[]
) {
  await database
    .delete(todoContentImages)
    .where(eq(todoContentImages.todoId, todoId))
  if (uploadIds.length > 0) {
    await database
      .insert(todoContentImages)
      .values(uploadIds.map((uploadId) => ({ todoId, uploadId })))
  }
}

async function getContentImages(database: Database, todoId: string) {
  const rows = await database
    .select({ upload: uploads })
    .from(todoContentImages)
    .innerJoin(uploads, eq(todoContentImages.uploadId, uploads.id))
    .where(eq(todoContentImages.todoId, todoId))
  return rows.map((r) => r.upload)
}

async function getUploadsById(
  database: Database,
  ids: string[]
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
  uploadList: (typeof uploads.$inferSelect)[]
) {
  const keys = uploadList.flatMap((u) => {
    const result = [u.storageKey]
    if (u.variants) {
      result.push(
        u.variants.thumbnail.key,
        u.variants.small.key,
        u.variants.medium.key,
        u.variants.large.key
      )
    }
    return result
  })
  return Promise.allSettled(keys.map((k) => storage.delete(k)))
}

export function createTodosService(
  database: Database,
  storage: StorageProvider
) {
  async function list(query: TodosListQuery) {
    const { limit, offset } = getPaginationParams(query.page, query.pageSize)
    const sortCol = SORT_COLUMNS[query.sortBy ?? 'createdAt']
    const sortFn = query.sortOrder === 'desc' ? desc : asc
    const where = and(
      buildFilterWhereClause(query.filters, query.filterLogic, FILTER_COLUMNS, {
        coerce: FILTER_COERCE,
        normalized: NORMALIZED_FILTER_COLUMNS,
      }),
      buildSearchClause(query.search, SEARCH_COLUMNS)
    )

    const [data, [{ total }]] = await Promise.all([
      database
        .select()
        .from(todos)
        .where(where)
        .orderBy(sortFn(sortCol), asc(todos.id))
        .limit(limit)
        .offset(offset),
      database.select({ total: count() }).from(todos).where(where),
    ])

    const todoIds = data.map((t) => t.id)
    const singleUploadIds = [
      ...new Set(
        data.flatMap((t) => [t.fileId, t.imageId].filter(Boolean) as string[])
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
    return findOne(eq(todos.id, id))
  }

  /** The todo a public page shows at `/…/:slug`. */
  async function getBySlug(slug: string) {
    return findOne(eq(todos.slug, slug))
  }

  async function findOne(where: SQL) {
    const [todo] = await database.select().from(todos).where(where)
    if (!todo) return null

    const singleUploadIds = [todo.fileId, todo.imageId].filter(
      Boolean
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

  /**
   * `actorId` must have uploaded every referenced file (400 `invalid_upload`
   * otherwise), and each typed field must hold its type — the `image` and the
   * images of `content` an image, the `file` a PDF (400 `invalid_upload_type`).
   * See `assertUsableUploads`.
   */
  async function create(data: CreateTodoInput, actorId: string) {
    const { attachmentIds = [], ...rest } = data
    // Stored safe to render anywhere — the admin and a public site.
    const todoData = { ...rest, content: sanitizeRichText(rest.content) }
    const contentImageIds = await uploadIdsInHtml(database, todoData.content)
    await assertUsableUploads(database, actorId, [
      ...attachmentIds,
      ...contentImageIds.map((id) => ({ id, accept: IMAGE_TYPES })),
      { id: todoData.fileId, accept: PDF_TYPES },
      { id: todoData.imageId, accept: IMAGE_TYPES },
    ])
    // The slug comes from the title once, here; `update` never touches it.
    const [todo] = await withUniqueSlug(
      database,
      TODO_SLUG,
      todoData.title,
      (slug) =>
        database
          .insert(todos)
          .values({
            ...todoData,
            ...normalizedValues(todoData, TODO_NORMALIZED_FIELDS),
            slug,
            publishedAt: todoData.published ? new Date() : null,
          })
          .returning()
    )
    await syncAttachments(database, todo.id, attachmentIds)
    await syncContentImages(database, todo.id, contentImageIds)

    const singleUploadIds = [todo.fileId, todo.imageId].filter(
      Boolean
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

  /**
   * A newly referenced file must be one `actorId` uploaded (400
   * `invalid_upload`); the todo's current files may be re-sent by anyone.
   * Typed fields keep their type either way (400 `invalid_upload_type`).
   */
  async function update(id: string, data: UpdateTodoInput, actorId: string) {
    const { attachmentIds, ...rest } = data
    const todoData =
      rest.content === undefined
        ? rest
        : { ...rest, content: sanitizeRichText(rest.content) }
    const contentImageIds =
      todoData.content === undefined
        ? undefined
        : await uploadIdsInHtml(database, todoData.content)

    if (
      attachmentIds ||
      contentImageIds?.length ||
      todoData.fileId ||
      todoData.imageId
    ) {
      const [current] = await database
        .select({ fileId: todos.fileId, imageId: todos.imageId })
        .from(todos)
        .where(eq(todos.id, id))
      if (!current) return null
      const [currentAttachments, currentContentImages] = await Promise.all([
        database
          .select({ id: todoAttachments.uploadId })
          .from(todoAttachments)
          .where(eq(todoAttachments.todoId, id)),
        database
          .select({ id: todoContentImages.uploadId })
          .from(todoContentImages)
          .where(eq(todoContentImages.todoId, id)),
      ])
      await assertUsableUploads(
        database,
        actorId,
        [
          ...(attachmentIds ?? []),
          ...(contentImageIds ?? []).map((id) => ({ id, accept: IMAGE_TYPES })),
          { id: todoData.fileId, accept: PDF_TYPES },
          { id: todoData.imageId, accept: IMAGE_TYPES },
        ],
        [
          current.fileId,
          current.imageId,
          ...currentAttachments.map((a) => a.id),
          ...currentContentImages.map((a) => a.id),
        ]
      )
    }

    let todo: typeof todos.$inferSelect | undefined

    if (Object.keys(todoData).length > 0) {
      const [updated] = await database
        .update(todos)
        .set({
          ...todoData,
          ...normalizedValues(todoData, TODO_NORMALIZED_FIELDS),
          // The first publication only: a todo unpublished and published
          // again keeps its date.
          ...(todoData.published && {
            publishedAt: sql`coalesce(${todos.publishedAt}, now())`,
          }),
        })
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
    if (contentImageIds !== undefined) {
      await syncContentImages(database, id, contentImageIds)
    }

    const singleUploadIds = [todo.fileId, todo.imageId].filter(
      Boolean
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

  /** Deletes the row; `false` when the id did not exist (nothing to audit). */
  async function remove(id: string): Promise<boolean> {
    const [todo] = await database.select().from(todos).where(eq(todos.id, id))
    if (!todo) return false

    const singleUploadIds = [todo.fileId, todo.imageId].filter(
      Boolean
    ) as string[]

    const [attachmentsMap, contentImages, singleUploads] = await Promise.all([
      getAttachmentsForTodos(database, [id]),
      getContentImages(database, id),
      singleUploadIds.length > 0
        ? database
            .select()
            .from(uploads)
            .where(inArray(uploads.id, singleUploadIds))
        : Promise.resolve([]),
    ])

    const attachmentList = attachmentsMap[id] ?? []
    // One upload may sit in two places (the image and the content).
    const allUploads = [
      ...new Map(
        [...attachmentList, ...contentImages, ...singleUploads].map((u) => [
          u.id,
          u,
        ])
      ).values(),
    ]
    const allUploadIds = allUploads.map((u) => u.id)

    const deleted = await database
      .delete(todos)
      .where(eq(todos.id, id))
      .returning({ id: todos.id })
    // A concurrent delete got there first: it owns the upload cleanup.
    if (deleted.length === 0) return false

    if (allUploadIds.length > 0) {
      await database.delete(uploads).where(inArray(uploads.id, allUploadIds))
      await deleteUploadKeys(storage, allUploads)
    }
    return true
  }

  async function generateReport(query: TodosExportQuery): Promise<Buffer> {
    const sortCol = SORT_COLUMNS[query.sortBy ?? 'createdAt']
    const sortFn = query.sortOrder === 'desc' ? desc : asc
    const where = and(
      buildFilterWhereClause(query.filters, query.filterLogic, FILTER_COLUMNS, {
        coerce: FILTER_COERCE,
        normalized: NORMALIZED_FILTER_COLUMNS,
      }),
      buildSearchClause(query.search, SEARCH_COLUMNS)
    )

    const data = await database
      .select()
      .from(todos)
      .where(where)
      .orderBy(sortFn(sortCol), asc(todos.id))
      .limit(5000)

    const { renderTodosReport } = await import('./templates/todos-report')
    return renderTodosReport(data)
  }

  return {
    list,
    getById,
    getBySlug,
    create,
    update,
    remove,
    generateReport,
  }
}
