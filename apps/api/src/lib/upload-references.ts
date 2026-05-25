import type { Database } from '@/db'

/**
 * A function that returns all upload IDs currently referenced by a module.
 * Register one loader per column that references the uploads table.
 * If no loaders are registered, deleteOrphanUploads treats all old uploads as orphaned.
 */
export type UploadReferenceLoader = (db: Database) => Promise<string[]>

const loaders: UploadReferenceLoader[] = []

export function registerUploadReference(loader: UploadReferenceLoader): void {
  loaders.push(loader)
}

export function getUploadReferenceLoaders(): readonly UploadReferenceLoader[] {
  return loaders
}
