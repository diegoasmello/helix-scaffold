import { and, eq, inArray } from 'drizzle-orm'

import type { Database } from '@/db'
import { uploads } from '@/db/schema'
import { DomainError } from '@/lib/domain-errors'

/**
 * Refuses (400 `invalid_upload`) a record that references uploads the actor
 * did not upload. A record's readers can open the files it references
 * (`GET /files/*`), and deleting it deletes them, so referencing someone
 * else's upload id would expose that file — or destroy it.
 *
 * `alreadyReferenced` are the ids the record references now: an edit by
 * another user (anyone with `xxx:edit`) re-sends them and keeps them. An
 * unknown id gets the same answer as a foreign one, so it reveals nothing.
 */
export async function assertUsableUploads(
  database: Database,
  actorId: string,
  uploadIds: (string | null | undefined)[],
  alreadyReferenced: (string | null | undefined)[] = []
): Promise<void> {
  const kept = new Set(alreadyReferenced)
  const ids = [
    ...new Set(uploadIds.filter((id): id is string => !!id && !kept.has(id))),
  ]
  if (ids.length === 0) return

  const owned = await database
    .select({ id: uploads.id })
    .from(uploads)
    .where(and(inArray(uploads.id, ids), eq(uploads.uploadedBy, actorId)))
  if (owned.length < ids.length) {
    throw new DomainError(
      400,
      'invalid_upload',
      'Unknown upload, or one you did not upload'
    )
  }
}
