import { eq, isNotNull } from 'drizzle-orm'

import { todoAttachments, todoContentImages, todos } from '@/db/schema'
import {
  registerUploadReference,
  type UploadReaderAccess,
} from '@/lib/upload-references'

// When a new module adds columns or junction tables that reference uploads,
// register them here so orphan cleanup knows which uploads are still in use,
// and `GET /files/*` knows who may read their files.

// The guard of `GET /todos/:id`.
const TODO_READERS: UploadReaderAccess = {
  resource: 'todos',
  action: 'view',
  subscription: 'todos',
}

registerUploadReference({
  access: TODO_READERS,
  load: async (db) => {
    const rows = await db
      .selectDistinct({ id: todoAttachments.uploadId })
      .from(todoAttachments)
    return rows.map((r) => r.id)
  },
  references: async (db, uploadId) => {
    const rows = await db
      .select({ id: todoAttachments.uploadId })
      .from(todoAttachments)
      .where(eq(todoAttachments.uploadId, uploadId))
      .limit(1)
    return rows.length > 0
  },
})

registerUploadReference({
  access: TODO_READERS,
  load: async (db) => {
    const rows = await db
      .select({ id: todos.fileId })
      .from(todos)
      .where(isNotNull(todos.fileId))
    return rows.map((r) => r.id).filter((id): id is string => id !== null)
  },
  references: async (db, uploadId) => {
    const rows = await db
      .select({ id: todos.id })
      .from(todos)
      .where(eq(todos.fileId, uploadId))
      .limit(1)
    return rows.length > 0
  },
})

registerUploadReference({
  access: TODO_READERS,
  load: async (db) => {
    const rows = await db
      .select({ id: todos.imageId })
      .from(todos)
      .where(isNotNull(todos.imageId))
    return rows.map((r) => r.id).filter((id): id is string => id !== null)
  },
  references: async (db, uploadId) => {
    const rows = await db
      .select({ id: todos.id })
      .from(todos)
      .where(eq(todos.imageId, uploadId))
      .limit(1)
    return rows.length > 0
  },
})

// The images inside `content` (rich text), which the service keeps in
// `todo_content_images`.
registerUploadReference({
  access: TODO_READERS,
  load: async (db) => {
    const rows = await db
      .selectDistinct({ id: todoContentImages.uploadId })
      .from(todoContentImages)
    return rows.map((r) => r.id)
  },
  references: async (db, uploadId) => {
    const rows = await db
      .select({ id: todoContentImages.uploadId })
      .from(todoContentImages)
      .where(eq(todoContentImages.uploadId, uploadId))
      .limit(1)
    return rows.length > 0
  },
})
