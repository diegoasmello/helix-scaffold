import { and, asc, count, desc, eq, or } from 'drizzle-orm'

import type { Database } from '@/db'
import { subscriptions } from '@/db/schema'
import { getPaginationParams } from '@/lib/pagination'

import type {
  CreateSubscriptionInput,
  SubscriptionsListQuery,
  UpdateSubscriptionInput,
} from './subscriptions-schema'

const SORT_COLUMNS = {
  planId: subscriptions.planId,
  status: subscriptions.status,
  currentPeriodEnd: subscriptions.currentPeriodEnd,
  createdAt: subscriptions.createdAt,
} as const

export function createSubscriptionsService(database: Database) {
  async function getActiveByUserId(userId: string) {
    const [sub] = await database
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          or(
            eq(subscriptions.status, 'active'),
            eq(subscriptions.status, 'trialing')
          )
        )
      )
      .orderBy(desc(subscriptions.createdAt))
      .limit(1)
    return sub ?? null
  }

  async function list(query: SubscriptionsListQuery) {
    const { limit, offset } = getPaginationParams(query.page, query.pageSize)
    const sortCol = SORT_COLUMNS[query.sortBy ?? 'createdAt']
    const sortFn = query.sortOrder === 'desc' ? desc : asc

    const [data, [{ total }]] = await Promise.all([
      database
        .select()
        .from(subscriptions)
        .orderBy(sortFn(sortCol))
        .limit(limit)
        .offset(offset),
      database.select({ total: count() }).from(subscriptions),
    ])

    return { data, total }
  }

  async function getById(id: string) {
    const [sub] = await database
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
    return sub ?? null
  }

  async function create(data: CreateSubscriptionInput) {
    const [sub] = await database.insert(subscriptions).values(data).returning()
    return sub
  }

  async function update(id: string, data: UpdateSubscriptionInput) {
    const patch = {
      ...data,
      ...(data.status === 'canceled' && !data.canceledAt
        ? { canceledAt: new Date() }
        : {}),
    }
    const [sub] = await database
      .update(subscriptions)
      .set(patch)
      .where(eq(subscriptions.id, id))
      .returning()
    return sub ?? null
  }

  async function remove(id: string) {
    await database.delete(subscriptions).where(eq(subscriptions.id, id))
  }

  return { getActiveByUserId, list, getById, create, update, remove }
}

export type SubscriptionsService = ReturnType<typeof createSubscriptionsService>
