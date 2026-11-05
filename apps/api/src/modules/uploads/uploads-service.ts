import { asc, count, desc, eq, or } from 'drizzle-orm'

import type { Database } from '@/db'
import { IMAGE_VARIANT_NAMES, uploads, variantKey } from '@/db/schema'
import type { ImageVariants } from '@/db/schema/uploads'
import { getPaginationParams } from '@/lib/pagination'
import type { StorageProvider } from '@/lib/storage'

import type { UploadsListQuery } from './uploads-schema'

interface CreateUploadData {
  originalName: string
  mimeType: string
  fileSize: number
  storageKey: string
  url: string
  variants: ImageVariants | null
  uploadedBy: string
}

const SORT_COLUMNS = {
  originalName: uploads.originalName,
  createdAt: uploads.createdAt,
} as const

export function createUploadsService(
  database: Database,
  storage: StorageProvider
) {
  async function list(query: UploadsListQuery) {
    const { limit, offset } = getPaginationParams(query.page, query.pageSize)
    const sortCol = SORT_COLUMNS[query.sortBy ?? 'createdAt']
    const sortFn = query.sortOrder === 'desc' ? desc : asc
    const [data, [{ total }]] = await Promise.all([
      database
        .select()
        .from(uploads)
        .orderBy(sortFn(sortCol))
        .limit(limit)
        .offset(offset),
      database.select({ total: count() }).from(uploads),
    ])
    return { data, total }
  }

  async function getById(id: string) {
    const [item] = await database
      .select()
      .from(uploads)
      .where(eq(uploads.id, id))
    return item ?? null
  }

  /** The upload that owns a storage key: its original or an image variant. */
  async function getByFileKey(key: string) {
    const [item] = await database
      .select()
      .from(uploads)
      .where(
        // Each condition has its index (`src/db/schema/uploads.ts`).
        or(
          eq(uploads.storageKey, key),
          ...IMAGE_VARIANT_NAMES.map((name) =>
            eq(variantKey(uploads.variants, name), key)
          )
        )
      )
      .limit(1)
    return item ?? null
  }

  async function create(data: CreateUploadData) {
    const [item] = await database.insert(uploads).values(data).returning()
    return item
  }

  /** Deletes the row; `false` when the id did not exist (nothing to audit). */
  async function remove(id: string): Promise<boolean> {
    const item = await getById(id)
    if (!item) return false

    const keysToDelete = [item.storageKey]
    if (item.variants) {
      keysToDelete.push(
        item.variants.thumbnail.key,
        item.variants.small.key,
        item.variants.medium.key,
        item.variants.large.key
      )
    }

    const deleted = await database
      .delete(uploads)
      .where(eq(uploads.id, id))
      .returning({ id: uploads.id })
    if (deleted.length === 0) return false

    await Promise.allSettled(keysToDelete.map((key) => storage.delete(key)))
    return true
  }

  return { list, getById, getByFileKey, create, remove }
}
