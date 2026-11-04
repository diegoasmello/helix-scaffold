import { inArray } from 'drizzle-orm'

import type { Database } from '@/db'
import { uploads } from '@/db/schema'
import { DomainError } from '@/lib/domain-errors'

/** MIME types in the `accept` attribute's form: exact, or a family (`image/*`). */
export type AcceptedTypes = readonly string[]

/** Any image — the `image` field of a record, the images inside rich text. */
export const IMAGE_TYPES: AcceptedTypes = ['image/*']

export const PDF_TYPES: AcceptedTypes = ['application/pdf']

type MaybeId = string | null | undefined

/**
 * An upload id a record references: bare, or with the types its field
 * accepts (`{ id: data.imageId, accept: IMAGE_TYPES }`).
 */
export type ReferencedUpload = MaybeId | { id: MaybeId; accept: AcceptedTypes }

function accepts(mimeType: string, accept: AcceptedTypes): boolean {
  const type = mimeType.toLowerCase()
  return accept.some((entry) =>
    entry.endsWith('/*')
      ? type.startsWith(entry.slice(0, -1).toLowerCase())
      : type === entry.toLowerCase()
  )
}

/**
 * Refuses a record that references uploads it may not use:
 *
 * - **400 `invalid_upload`** — an upload the actor did not upload. A record's
 *   readers can open the files it references (`GET /files/*`), and deleting
 *   it deletes them, so referencing someone else's upload id would expose
 *   that file — or destroy it. An unknown id gets the same answer as a
 *   foreign one, so it reveals nothing.
 * - **400 `invalid_upload_type`** — an upload whose MIME type its field does
 *   not accept (a PDF as the `image`). The form's `accept` only filters the
 *   file picker; any client can send any id.
 *
 * `alreadyReferenced` are the ids the record references now: an edit by
 * another user (anyone with `xxx:edit`) re-sends them and keeps them. Their
 * owner is not checked again, their type is — it belongs to the field.
 */
export async function assertUsableUploads(
  database: Database,
  actorId: string,
  references: ReferencedUpload[],
  alreadyReferenced: MaybeId[] = []
): Promise<void> {
  const kept = new Set(alreadyReferenced)
  const added = new Set<string>()
  const typed: { id: string; accept: AcceptedTypes }[] = []
  for (const reference of references) {
    const { id, accept } =
      typeof reference === 'object' && reference !== null
        ? reference
        : { id: reference, accept: undefined }
    if (!id) continue
    if (!kept.has(id)) added.add(id)
    if (accept) typed.push({ id, accept })
  }

  const ids = [...new Set([...added, ...typed.map((t) => t.id)])]
  if (ids.length === 0) return

  const rows = await database
    .select({
      id: uploads.id,
      mimeType: uploads.mimeType,
      uploadedBy: uploads.uploadedBy,
    })
    .from(uploads)
    .where(inArray(uploads.id, ids))
  const byId = new Map(rows.map((row) => [row.id, row]))

  for (const id of added) {
    if (byId.get(id)?.uploadedBy !== actorId) {
      throw new DomainError(
        400,
        'invalid_upload',
        'Unknown upload, or one you did not upload'
      )
    }
  }
  for (const { id, accept } of typed) {
    const upload = byId.get(id)
    if (upload && !accepts(upload.mimeType, accept)) {
      throw new DomainError(
        400,
        'invalid_upload_type',
        `Upload ${id} is ${upload.mimeType}; this field accepts ${accept.join(', ')}`
      )
    }
  }
}
