import type { SubscriptionEntitlements } from '@helix/api-client/types'

export interface SubscriptionAccessState {
  enabled: boolean
  /** From `GET /me/entitlements`; `null` until loaded (or when disabled). */
  entitlements: SubscriptionEntitlements | null
}

/**
 * True when the user may use the feature (or, without a feature, has an
 * access-granting subscription). The decision itself (operator bypass,
 * statuses, grace period, plan features) is made by the API: this only reads
 * its answer, the same one `requireSubscription()` enforces. Shared by
 * `useSubscriptionAccess()` (components) and the router context
 * (`context.hasSubscriptionAccess` in `beforeLoad`).
 */
export function hasSubscriptionAccess(
  state: SubscriptionAccessState,
  feature?: string
): boolean {
  const { enabled, entitlements } = state
  if (!enabled) return true
  if (!entitlements) return false
  if (entitlements.operator) return true
  return feature
    ? entitlements.features.includes(feature)
    : entitlements.subscribed
}
