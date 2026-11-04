import { index, pgTable, primaryKey, text } from 'drizzle-orm/pg-core'

import { todos } from './todos'
import { uploads } from './uploads'

export const todoAttachments = pgTable(
  'todo_attachments',
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
    index('todo_attachments_upload_id_idx').on(t.uploadId),
  ]
)
