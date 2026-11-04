import type { Permission } from '@/config/permissions'
import type { Database } from '@/db'

/**
 * A function that returns all upload IDs currently referenced by a module.
 * Register one loader per column that references the uploads table.
 * If no loaders are registered, deleteOrphanUploads treats all old uploads as orphaned.
 */
export type UploadReferenceLoader = (db: Database) => Promise<string[]>

/**
 * Who may read the records behind a reference: the guard of their `GET`
 * route. `resource`/`action` are its `requirePermission()`; `subscription` is
 * its `requireSubscription()` — `true` without a feature, the feature with one
 * — and is omitted when the route has none.
 */
export type UploadReaderAccess = Permission & { subscription?: true | string }

export interface UploadReference {
  /** Every upload ID the column references — the orphan cleanup keeps them. */
  load: UploadReferenceLoader
  /** Whether the column references this upload. */
  references: (db: Database, uploadId: string) => Promise<boolean>
  /** `GET /files/*` serves a referenced upload's files to these users. */
  access: UploadReaderAccess
}

const references: UploadReference[] = []

export function registerUploadReference(reference: UploadReference): void {
  references.push(reference)
}

export function getUploadReferenceLoaders(): readonly UploadReferenceLoader[] {
  return references.map((reference) => reference.load)
}

export function getUploadReferences(): readonly UploadReference[] {
  return references
}
