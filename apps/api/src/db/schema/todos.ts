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
  // Searchable copies of `title`/`description` (see `TODO_NORMALIZED_FIELDS`).
  // Never returned by the API.
  normalizedTitle: text('normalized_title').notNull(),
  normalizedDescription: text('normalized_description').notNull(),
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

/**
 * The text fields of `todos` with a normalized copy (`src/lib/normalize-text.ts`):
 * every write fills it with `normalizedValues(data, TODO_NORMALIZED_FIELDS)` —
 * the service, the seed and the tests' `todoRow()`. Search and the text filters
 * read it. A new normalized column goes in the table above and here.
 */
export const TODO_NORMALIZED_FIELDS = {
  title: 'normalizedTitle',
  description: 'normalizedDescription',
} as const satisfies Record<string, keyof typeof todos.$inferInsert>
