import { useAuth } from '../../auth/use-auth'
import { hasSubscriptionAccess } from '../access'
import { useSubscription } from './use-subscription'

export function useSubscriptionAccess() {
  const {
    enabled,
    plans,
    subscription,
    isPending: subscriptionPending,
  } = useSubscription()
  const { hasPermission, isPending: authPending } = useAuth()

  /** See `hasSubscriptionAccess` in `../access.ts` for the rules. */
  const hasAccess = (feature?: string) =>
    hasSubscriptionAccess(
      {
        enabled,
        plans,
        subscription,
        isOperator: hasPermission('subscriptions', 'view'),
      },
      feature
    )

  // Wait for permissions too, so operators never see a fallback flash.
  return { hasAccess, isPending: subscriptionPending || authPending }
}
