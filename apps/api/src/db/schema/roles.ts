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
    /**
     * The system's admin role: every permission, implicitly, and locked —
     * nobody edits, deletes or assigns it. Set only by the bootstrap and the
     * seed, never through the API.
     */
    isAdmin: boolean('is_admin').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex('roles_is_default_unique')
      .on(table.isDefault)
      .where(sql`is_default = true`),
    uniqueIndex('roles_is_admin_unique')
      .on(table.isAdmin)
      .where(sql`is_admin = true`),
  ]
)
