import { isNotNull } from 'drizzle-orm'

import { todoAttachments, todos } from '@/db/schema'
import { registerUploadReference } from '@/lib/upload-references'

// When a new module adds columns or junction tables that reference uploads,
// register them here so orphan cleanup knows which uploads are still in use.

registerUploadReference(async (db) => {
  const rows = await db.selectDistinct({ id: todoAttachments.uploadId }).from(todoAttachments)
  return rows.map((r) => r.id)
})

registerUploadReference(async (db) => {
  const rows = await db.select({ id: todos.fileId }).from(todos).where(isNotNull(todos.fileId))
  return rows.map((r) => r.id).filter((id): id is string => id !== null)
})

registerUploadReference(async (db) => {
  const rows = await db.select({ id: todos.imageId }).from(todos).where(isNotNull(todos.imageId))
  return rows.map((r) => r.id).filter((id): id is string => id !== null)
})
