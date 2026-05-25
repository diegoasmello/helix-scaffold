import { asc, count, desc, eq } from 'drizzle-orm'

import type { Database } from '@/db'
import { uploads } from '@/db/schema'
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

  async function create(data: CreateUploadData) {
    const [item] = await database.insert(uploads).values(data).returning()
    return item
  }

  async function remove(id: string) {
    const item = await getById(id)
    if (!item) return

    const keysToDelete = [item.storageKey]
    if (item.variants) {
      keysToDelete.push(
        item.variants.thumbnail.key,
        item.variants.small.key,
        item.variants.medium.key,
        item.variants.large.key
      )
    }

    await database.delete(uploads).where(eq(uploads.id, id))

    await Promise.allSettled(keysToDelete.map((key) => storage.delete(key)))
  }

  return { list, getById, create, remove }
}

export type UploadsService = ReturnType<typeof createUploadsService>
