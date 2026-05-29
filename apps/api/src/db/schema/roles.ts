import { sql } from 'drizzle-orm'
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { uuidv7 } from 'uuidv7'

export const roles = pgTable(
  'roles',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    name: text('name').notNull().unique(),
    description: text('description'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex('roles_is_default_unique')
      .on(table.isDefault)
      .where(sql`is_default = true`),
  ]
)
