import { pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { uuidv7 } from 'uuidv7'

import { uploads } from './uploads'

export const todoStatusEnum = pgEnum('todo_status', ['pending', 'completed'])

export const todos = pgTable('todos', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  title: text('title').notNull(),
  description: text('description').notNull(),
  content: text('content').notNull(),
  status: todoStatusEnum('status').default('pending').notNull(),
  date: timestamp('date').notNull(),
  fileId: text('file_id').references(() => uploads.id, {
    onDelete: 'set null',
  }),
  imageId: text('image_id').references(() => uploads.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
})
