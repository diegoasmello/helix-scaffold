import { index, pgTable, primaryKey, text } from 'drizzle-orm/pg-core'

import { todos } from './todos'
import { uploads } from './uploads'

/**
 * The uploads shown as images inside `todos.content` (rich text). The service
 * fills it from the HTML on every write (`uploadIdsInHtml()`); the API
 * contract never mentions it. It is what keeps those images from the orphan
 * cleanup and lets the todo's readers open them (`src/config/upload-references.ts`).
 */
export const todoContentImages = pgTable(
  'todo_content_images',
  {
    todoId: text('todo_id')
      .notNull()
      .references(() => todos.id, { onDelete: 'cascade' }),
    uploadId: text('upload_id')
      .notNull()
      .references(() => uploads.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.todoId, t.uploadId] }),
    // The primary key serves lookups by `todo_id` (its first column) only;
    // lookups and cascades by `upload_id` need their own index.
    index('todo_content_images_upload_id_idx').on(t.uploadId),
  ]
)
