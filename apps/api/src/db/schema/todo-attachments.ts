import { pgTable, primaryKey, text } from 'drizzle-orm/pg-core'

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
  (t) => [primaryKey({ columns: [t.todoId, t.uploadId] })]
)
