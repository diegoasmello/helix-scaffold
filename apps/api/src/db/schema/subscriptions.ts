import { sql } from 'drizzle-orm'
import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { uuidv7 } from 'uuidv7'

import { user } from './authentication'

type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'canceled'
  | 'past_due'
  | 'expired'

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    planId: text('plan_id').notNull(),
    status: text('status').$type<SubscriptionStatus>().notNull(),
    trialEndsAt: timestamp('trial_ends_at'),
    currentPeriodStart: timestamp('current_period_start').notNull(),
    currentPeriodEnd: timestamp('current_period_end').notNull(),
    canceledAt: timestamp('canceled_at'),
    externalId: text('external_id'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    // At most one live (active/trialing) subscription per user.
    uniqueIndex('subscriptions_one_live_per_user')
      .on(table.userId)
      .where(sql`status in ('active', 'trialing')`),
    // The payment processor's id is the webhook sync key. NULLs (scaffold-owned
    // rows) don't collide in a Postgres unique index.
    uniqueIndex('subscriptions_external_id_unique').on(table.externalId),
  ]
)
