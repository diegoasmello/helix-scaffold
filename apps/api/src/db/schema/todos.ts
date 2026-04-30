import { pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { uuidv7 } from 'uuidv7'

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
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
})
