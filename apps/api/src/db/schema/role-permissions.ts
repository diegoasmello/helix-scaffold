import { pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { uuidv7 } from 'uuidv7'

import { roles } from './roles'

export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    resource: text('resource').notNull(),
    action: text('action').notNull(),
  },
  (t) => [
    uniqueIndex('role_permissions_unique').on(t.roleId, t.resource, t.action),
  ]
)
