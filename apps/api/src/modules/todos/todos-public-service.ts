import { and, asc, count, desc, eq, inArray, type SQL, sql } from 'drizzle-orm'

import type { Database } from '@/db'
import {
  IMAGE_VARIANT_NAMES,
  TODO_PUBLISHED,
  todos,
  uploads,
} from '@/db/schema'
import { buildSearchClause } from '@/lib/filtering'
import { getPaginationParams } from '@/lib/pagination'

import {
  PUBLIC_TODO_DEFAULT_ORDER,
  type PublicTodosListQuery,
} from './todos-public-schema'

// The columns a site sees (`publicTodoSchema`), plus the ids of its uploads
// to attach them — dropped before the answer. Nothing else is read, whatever
// the response schema would strip.
const PUBLIC_COLUMNS = {
  slug: todos.slug,
  title: todos.title,
  description: todos.description,
  content: todos.content,
  date: todos.date,
  publishedAt: todos.publishedAt,
  updatedAt: todos.updatedAt,
  imageId: todos.imageId,
  fileId: todos.fileId,
}

type VariantName = (typeof IMAGE_VARIANT_NAMES)[number]
type PublicVariants = Record<VariantName, { url: string }>

// The variants' URLs only, built by Postgres — not their storage keys:
// `{ thumbnail: { url }, … }`, or null for a file that is not an image.
const PUBLIC_VARIANTS = sql<PublicVariants | null>`case when ${uploads.variants} is null then null else jsonb_build_object(${sql.join(
  IMAGE_VARIANT_NAMES.map(
    (name) =>
      sql`${sql.raw(`'${name}'`)}, jsonb_build_object('url', ${uploads.variants} -> ${sql.raw(`'${name}'`)} ->> 'url')`
  ),
  sql`, `
)}) end`

// What `publicUploadSchema` shows, plus the id to attach it (`toPublicUpload`
// drops it).
const PUBLIC_UPLOAD_COLUMNS = {
  id: uploads.id,
  url: uploads.url,
  mimeType: uploads.mimeType,
  fileSize: uploads.fileSize,
  variants: PUBLIC_VARIANTS,
}

type PublicUploadRow = {
  id: string
  url: string
  mimeType: string
  fileSize: number
  variants: PublicVariants | null
}

/** An upload as a site sees it — the id that attached it left out. */
function toPublicUpload(row: PublicUploadRow | undefined) {
  if (!row) return null
  const { id: _id, ...upload } = row
  return upload
}

// `title` sorts by its normalized copy, like the admin's list.
const SORT_COLUMNS = {
  publishedAt: todos.publishedAt,
  date: todos.date,
  title: todos.normalizedTitle,
} as const

const SEARCH_COLUMNS = [todos.normalizedTitle, todos.normalizedDescription]

/**
 * The reads of the public API (`todos-public-routes.ts`). Every query filters
 * with `TODO_PUBLISHED` here, not in the route: a draft can never be returned,
 * by any route that uses this service.
 */
export function createTodosPublicService(database: Database) {
  async function uploadsById(
    ids: (string | null)[]
  ): Promise<Map<string, PublicUploadRow>> {
    const wanted = [...new Set(ids.filter((id): id is string => id !== null))]
    if (wanted.length === 0) return new Map()
    const rows = await database
      .select(PUBLIC_UPLOAD_COLUMNS)
      .from(uploads)
      .where(inArray(uploads.id, wanted))
    return new Map(rows.map((row) => [row.id, row]))
  }

  /** The rows with their image and PDF, as `publicUploadSchema` shows them. */
  async function withUploads(rows: Awaited<ReturnType<typeof selectPublic>>) {
    const byId = await uploadsById(rows.flatMap((r) => [r.imageId, r.fileId]))
    return rows.map(({ imageId, fileId, publishedAt, ...todo }) => ({
      ...todo,
      // Never null on a published row (`todos_published_at_check`).
      publishedAt: publishedAt as Date,
      image: imageId ? toPublicUpload(byId.get(imageId)) : null,
      file: fileId ? toPublicUpload(byId.get(fileId)) : null,
    }))
  }

  function selectPublic(where: SQL | undefined) {
    return database
      .select(PUBLIC_COLUMNS)
      .from(todos)
      .where(and(TODO_PUBLISHED, where))
  }

  async function list(query: PublicTodosListQuery) {
    const { limit, offset } = getPaginationParams(query.page, query.pageSize)
    const order = query.sortOrder ?? PUBLIC_TODO_DEFAULT_ORDER[query.sortBy]
    const sortFn = order === 'desc' ? desc : asc
    const search = buildSearchClause(query.search, SEARCH_COLUMNS)

    const [rows, [{ total }]] = await Promise.all([
      // `id` breaks ties in the same direction, so the default sort reads
      // `todos_published_at_idx` in order (either way) instead of sorting.
      selectPublic(search)
        .orderBy(sortFn(SORT_COLUMNS[query.sortBy]), sortFn(todos.id))
        .limit(limit)
        .offset(offset),
      database
        .select({ total: count() })
        .from(todos)
        .where(and(TODO_PUBLISHED, search)),
    ])

    return { data: await withUploads(rows), total }
  }

  /** The published todo at `slug`, or `null` — a draft is not found either. */
  async function getBySlug(slug: string) {
    const rows = await selectPublic(eq(todos.slug, slug))
    const [todo] = await withUploads(rows)
    return todo ?? null
  }

  return { list, getBySlug }
}
