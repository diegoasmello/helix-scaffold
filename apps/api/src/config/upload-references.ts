import { and, eq, isNotNull } from 'drizzle-orm'

import {
  TODO_PUBLISHED,
  todoAttachments,
  todoContentImages,
  todos,
} from '@/db/schema'
import {
  hasRows,
  registerUploadReference,
  type UploadReaderAccess,
} from '@/lib/upload-references'

// When a new module adds columns or junction tables that reference uploads,
// register them here so orphan cleanup knows which uploads are still in use,
// and `GET /files/*` knows who may read their files — `isPublic` on the columns
// the module's public schema returns, so a published record's files open for
// anyone.

// The guard of `GET /todos/:id`.
const TODO_READERS: UploadReaderAccess = {
  resource: 'todos',
  action: 'view',
  subscription: 'todos',
}

// `publicTodoSchema` returns the image, the PDF and the content (with its
// images) — their files open for anyone while the todo is published. The
// attachments stay internal: no `isPublic`.

registerUploadReference({
  access: TODO_READERS,
  load: async (db) => {
    const rows = await db
      .selectDistinct({ id: todoAttachments.uploadId })
      .from(todoAttachments)
    return rows.map((r) => r.id)
  },
  references: (db, uploadId) =>
    hasRows(
      db
        .select({ id: todoAttachments.uploadId })
        .from(todoAttachments)
        .where(eq(todoAttachments.uploadId, uploadId))
        .limit(1)
    ),
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
  references: (db, uploadId) =>
    hasRows(
      db
        .select({ id: todos.id })
        .from(todos)
        .where(eq(todos.fileId, uploadId))
        .limit(1)
    ),
  isPublic: (db, uploadId) =>
    hasRows(
      db
        .select({ id: todos.id })
        .from(todos)
        .where(and(TODO_PUBLISHED, eq(todos.fileId, uploadId)))
        .limit(1)
    ),
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
  references: (db, uploadId) =>
    hasRows(
      db
        .select({ id: todos.id })
        .from(todos)
        .where(eq(todos.imageId, uploadId))
        .limit(1)
    ),
  isPublic: (db, uploadId) =>
    hasRows(
      db
        .select({ id: todos.id })
        .from(todos)
        .where(and(TODO_PUBLISHED, eq(todos.imageId, uploadId)))
        .limit(1)
    ),
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
  references: (db, uploadId) =>
    hasRows(
      db
        .select({ id: todoContentImages.uploadId })
        .from(todoContentImages)
        .where(eq(todoContentImages.uploadId, uploadId))
        .limit(1)
    ),
  isPublic: (db, uploadId) =>
    hasRows(
      db
        .select({ id: todoContentImages.todoId })
        .from(todoContentImages)
        .innerJoin(todos, eq(todos.id, todoContentImages.todoId))
        .where(and(TODO_PUBLISHED, eq(todoContentImages.uploadId, uploadId)))
        .limit(1)
    ),
})
