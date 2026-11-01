import type { Config } from '@/config'
import type { Database } from '@/db'
import type { subscriptions } from '@/db/schema'
import { createPermissionsService } from '@/modules/permissions/permissions-service'

import { getPlan, type PlanCatalog } from './subscription-plans'
import { createSubscriptionsService } from './subscriptions-service'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * What the subscription axis lets a user do: the one answer shared by
 * `requireSubscription()` and the frontend (`GET /me/entitlements`).
 * Only meaningful while `subscriptions.enabled` is `true`. When it is off,
 * nothing is gated and nothing is resolved.
 */
export interface Entitlements {
  /** Role has `subscriptions:view`. Operators are never blocked. */
  operator: boolean
  /** Holds an access-granting subscription: live, or past_due within the grace period. */
  subscribed: boolean
  /** Features unlocked by that subscription's plan (`[]` without one, or for a plan removed from the catalog). */
  features: string[]
  /** For a past_due subscription, when the grace period (and access) ends. `null` otherwise. */
  graceEndsAt: Date | null
}

export type EntitlementDenial = 'subscription_required' | 'feature_not_in_plan'

type AccessGrantingSubscription = Pick<
  typeof subscriptions.$inferSelect,
  'planId' | 'status' | 'pastDueSince'
>

/**
 * Builds the entitlements from what was loaded. `subscription` must be the
 * access-granting one (`getAccessGrantingByUserId`), which already applies
 * the status and grace-period rules.
 */
export function resolveEntitlements(input: {
  operator: boolean
  subscription: AccessGrantingSubscription | null
  plans: PlanCatalog
  pastDueGraceDays: number
}): Entitlements {
  const { operator, subscription, plans, pastDueGraceDays } = input

  const graceEndsAt =
    subscription?.status === 'past_due' && subscription.pastDueSince
      ? new Date(
          subscription.pastDueSince.getTime() + pastDueGraceDays * DAY_MS
        )
      : null

  return {
    operator,
    subscribed: subscription !== null,
    features: subscription
      ? [...(getPlan(plans, subscription.planId)?.features ?? [])]
      : [],
    graceEndsAt,
  }
}

/** Why the user may not use `feature` (or, without one, the product at all). `null` = allowed. */
export function denialFor(
  entitlements: Entitlements,
  feature?: string
): EntitlementDenial | null {
  if (entitlements.operator) return null
  if (!entitlements.subscribed) return 'subscription_required'
  if (feature && !entitlements.features.includes(feature)) {
    return 'feature_not_in_plan'
  }
  return null
}

export function createEntitlementsService(
  database: Database,
  settings: Config['subscriptions']
) {
  const subscriptionsService = createSubscriptionsService(database)
  const permissionsService = createPermissionsService(database)

  async function forUser(user: {
    id: string
    roleId?: string | null
  }): Promise<Entitlements> {
    const [operator, subscription] = await Promise.all([
      // Users without a role are never operators.
      user.roleId
        ? permissionsService.hasPermission(user.roleId, 'subscriptions', 'view')
        : false,
      subscriptionsService.getAccessGrantingByUserId(user.id, {
        pastDueGraceDays: settings.pastDueGraceDays,
      }),
    ])
    return resolveEntitlements({
      operator,
      subscription,
      plans: settings.plans,
      pastDueGraceDays: settings.pastDueGraceDays,
    })
  }

  return { forUser }
}
