import type { Subscription, SubscriptionPlan } from '@helix/api-client/types'

export interface SubscriptionAccessState {
  enabled: boolean
  plans: SubscriptionPlan[]
  subscription: Subscription | null
  /** The user has `subscriptions:view` — operators are never blocked. */
  isOperator: boolean
}

/**
 * True when the user may use the feature (or, without a feature, has any
 * active/trialing subscription). Mirrors `requireSubscription()` in
 * apps/api/src/hooks/require-subscription.ts, so the UI blocks exactly what
 * the API would reject. Shared by `useSubscriptionAccess()` (components) and
 * the router context (`context.hasSubscriptionAccess` in `beforeLoad`).
 */
export function hasSubscriptionAccess(
  state: SubscriptionAccessState,
  feature?: string
): boolean {
  const { enabled, plans, subscription, isOperator } = state
  if (!enabled || isOperator) return true
  // `past_due` only reaches the client while inside the grace period
  // (`subscriptions.pastDueGraceDays`) — the API filters it out afterwards.
  if (
    !subscription ||
    !['active', 'trialing', 'past_due'].includes(subscription.status)
  ) {
    return false
  }
  if (!feature) return true
  const plan = plans.find((p) => p.id === subscription.planId)
  return plan?.features.includes(feature) ?? false
}
