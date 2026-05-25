import { and, inArray, lt, notInArray } from 'drizzle-orm'

import type { Database } from '@/db'
import { uploads } from '@/db/schema'
import type { StorageProvider } from '@/lib/storage'

import type { UploadReferenceLoader } from './upload-references'

const DEFAULT_GRACE_HOURS = 24

export async function deleteOrphanUploads(
  database: Database,
  storage: StorageProvider,
  referenceLoaders: readonly UploadReferenceLoader[],
  options?: { graceHours?: number },
): Promise<{ deleted: number }> {
  const graceMs = (options?.graceHours ?? DEFAULT_GRACE_HOURS) * 60 * 60 * 1000
  const cutoff = new Date(Date.now() - graceMs)

  const batches = await Promise.all(referenceLoaders.map((loader) => loader(database)))
  const referencedIds = new Set(batches.flat())

  const orphans = await database
    .select()
    .from(uploads)
    .where(
      referencedIds.size > 0
        ? and(lt(uploads.createdAt, cutoff), notInArray(uploads.id, [...referencedIds]))
        : lt(uploads.createdAt, cutoff),
    )

  if (orphans.length === 0) return { deleted: 0 }

  const storageKeys = orphans.flatMap((u) => {
    const keys = [u.storageKey]
    if (u.variants) {
      keys.push(
        u.variants.thumbnail.key,
        u.variants.small.key,
        u.variants.medium.key,
        u.variants.large.key,
      )
    }
    return keys
  })

  await database.delete(uploads).where(inArray(uploads.id, orphans.map((u) => u.id)))
  await Promise.allSettled(storageKeys.map((k) => storage.delete(k)))

  return { deleted: orphans.length }
}
