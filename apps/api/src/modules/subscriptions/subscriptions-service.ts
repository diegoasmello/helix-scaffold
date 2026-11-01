import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  isNull,
  lt,
  ne,
  or,
  sql,
} from 'drizzle-orm'

import { config } from '@/config'
import type { Database } from '@/db'
import { subscriptions } from '@/db/schema'
import { getPaginationParams } from '@/lib/pagination'

import type { BillingSubscriptionState } from '../billing-webhook/billing-webhook-types'
import type {
  CreateSubscriptionInput,
  SubscriptionsListQuery,
  SubscriptionStatus,
  UpdateSubscriptionInput,
} from './subscriptions-schema'

const SORT_COLUMNS = {
  planId: subscriptions.planId,
  status: subscriptions.status,
  currentPeriodEnd: subscriptions.currentPeriodEnd,
  createdAt: subscriptions.createdAt,
} as const

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * `pastDueSince` for a write that sets `status`: starts the grace period when
 * the row enters `past_due`, keeps it while it stays there, clears it otherwise.
 */
function pastDueSinceFor(status: SubscriptionStatus) {
  return status === 'past_due'
    ? sql`coalesce(${subscriptions.pastDueSince}, now())`
    : null
}

export function createSubscriptionsService(database: Database) {
  /**
   * The access-granting subscription: live (`active`/`trialing`), or
   * `past_due` still within `subscriptions.pastDueGraceDays` of `pastDueSince`.
   * Live rows win over a past_due one; then the most recent. Turned into the
   * user's entitlements by `entitlements.ts`.
   */
  async function getAccessGrantingByUserId(
    userId: string,
    options: { now?: Date; pastDueGraceDays?: number } = {}
  ) {
    const {
      now = new Date(),
      pastDueGraceDays = config.subscriptions.pastDueGraceDays,
    } = options
    const graceCutoff = new Date(now.getTime() - pastDueGraceDays * DAY_MS)

    const [sub] = await database
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          or(
            eq(subscriptions.status, 'active'),
            eq(subscriptions.status, 'trialing'),
            pastDueGraceDays > 0
              ? and(
                  eq(subscriptions.status, 'past_due'),
                  gt(subscriptions.pastDueSince, graceCutoff)
                )
              : undefined
          )
        )
      )
      .orderBy(
        sql`case when ${subscriptions.status} = 'past_due' then 1 else 0 end`,
        desc(subscriptions.createdAt)
      )
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
    const [sub] = await database
      .insert(subscriptions)
      .values({
        ...data,
        pastDueSince: data.status === 'past_due' ? new Date() : null,
      })
      .returning()
    return sub
  }

  async function update(id: string, data: UpdateSubscriptionInput) {
    const patch = {
      ...data,
      ...(data.status === 'canceled' && !data.canceledAt
        ? { canceledAt: new Date() }
        : {}),
      ...(data.status ? { pastDueSince: pastDueSinceFor(data.status) } : {}),
    }
    const [sub] = await database
      .update(subscriptions)
      .set(patch)
      .where(eq(subscriptions.id, id))
      .returning()
    return sub ?? null
  }

  /** Deletes the row; `false` when the id did not exist (nothing to audit). */
  async function remove(id: string): Promise<boolean> {
    const deleted = await database
      .delete(subscriptions)
      .where(eq(subscriptions.id, id))
      .returning({ id: subscriptions.id })
    return deleted.length > 0
  }

  /**
   * Marks as `expired` the lapsed subscriptions the scaffold owns (no
   * `externalId`): trials past `trialEndsAt` (or `currentPeriodEnd` when unset)
   * and active subscriptions past `currentPeriodEnd`. Rows with an
   * `externalId` are managed by the payment processor's webhooks.
   */
  async function expireLapsed(now = new Date()) {
    const expired = await database
      .update(subscriptions)
      .set({ status: 'expired' })
      .where(
        and(
          isNull(subscriptions.externalId),
          or(
            and(
              eq(subscriptions.status, 'trialing'),
              lt(
                sql`coalesce(${subscriptions.trialEndsAt}, ${subscriptions.currentPeriodEnd})`,
                now
              )
            ),
            and(
              eq(subscriptions.status, 'active'),
              lt(subscriptions.currentPeriodEnd, now)
            )
          )
        )
      )
      .returning({ id: subscriptions.id })
    return { expired: expired.length }
  }

  async function getByExternalId(externalId: string) {
    const [sub] = await database
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.externalId, externalId))
    return sub ?? null
  }

  /**
   * Creates or updates the subscription identified by `state.externalId` from
   * the payment processor's state (see `BillingSubscriptionState`).
   *
   * When the result is live (active/trialing), any other live subscription of
   * the same user is canceled first — a user has at most one, and a paid
   * subscription supersedes e.g. the trial created on sign-up.
   *
   * Returns `null` when the subscription is new and `state.userId` is missing.
   */
  async function syncFromBilling(state: BillingSubscriptionState) {
    return database.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.externalId, state.externalId))
      const userId = existing?.userId ?? state.userId
      if (!userId) return null

      if (state.status === 'active' || state.status === 'trialing') {
        await tx
          .update(subscriptions)
          .set({ status: 'canceled', canceledAt: new Date() })
          .where(
            and(
              eq(subscriptions.userId, userId),
              or(
                eq(subscriptions.status, 'active'),
                eq(subscriptions.status, 'trialing')
              ),
              existing ? ne(subscriptions.id, existing.id) : undefined
            )
          )
      }

      // `undefined` fields are skipped by Drizzle: omitted optional fields keep
      // their stored value.
      const values = {
        planId: state.planId,
        status: state.status,
        pastDueSince: pastDueSinceFor(state.status),
        currentPeriodStart: state.currentPeriodStart,
        currentPeriodEnd: state.currentPeriodEnd,
        trialEndsAt: state.trialEndsAt,
        canceledAt: state.canceledAt,
        metadata: state.metadata,
      }

      if (existing) {
        const [updated] = await tx
          .update(subscriptions)
          .set(values)
          .where(eq(subscriptions.id, existing.id))
          .returning()
        return { subscription: updated, created: false }
      }

      const [created] = await tx
        .insert(subscriptions)
        .values({
          ...values,
          pastDueSince: state.status === 'past_due' ? new Date() : null,
          userId,
          externalId: state.externalId,
        })
        .returning()
      return { subscription: created, created: true }
    })
  }

  return {
    getAccessGrantingByUserId,
    getByExternalId,
    syncFromBilling,
    list,
    getById,
    create,
    update,
    remove,
    expireLapsed,
  }
}

export type SubscriptionsService = ReturnType<typeof createSubscriptionsService>
