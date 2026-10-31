import { useAuth } from '../../auth/use-auth'
import { useSubscription } from './use-subscription'

// Mirrors `requireSubscription()` in apps/api/src/hooks/require-subscription.ts
// so the UI hides exactly what the API would reject.
export function useSubscriptionAccess() {
  const {
    enabled,
    isActive,
    isTrialing,
    plan,
    isPending: subscriptionPending,
  } = useSubscription()
  const { hasPermission, isPending: authPending } = useAuth()

  /**
   * True when the user may use the feature (or, without a feature, has any
   * active subscription). Always true when subscriptions are disabled and for
   * users with `subscriptions:view` (operators).
   */
  const hasAccess = (feature?: string) => {
    if (!enabled) return true
    if (hasPermission('subscriptions', 'view')) return true
    if (!isActive && !isTrialing) return false
    return feature ? (plan?.features.includes(feature) ?? false) : true
  }

  // Wait for permissions too, so operators never see a fallback flash.
  return { hasAccess, isPending: subscriptionPending || authPending }
}
