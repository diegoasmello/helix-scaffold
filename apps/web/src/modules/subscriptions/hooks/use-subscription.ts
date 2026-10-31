import {
  getMeSubscriptionQueryOptions,
  getSubscriptionStatusQueryOptions,
} from '@helix/api-client/hooks'
import type { Subscription } from '@helix/api-client/types'
import { useQuery } from '@tanstack/react-query'

export function useSubscription() {
  const { data: statusData, isPending: statusPending } = useQuery({
    ...getSubscriptionStatusQueryOptions(),
    staleTime: Infinity,
  })

  const enabled = statusData?.enabled ?? false
  const plans = statusData?.plans ?? []

  const { data, isPending: subscriptionPending } = useQuery({
    ...getMeSubscriptionQueryOptions(),
    enabled,
  })

  // Only count subscriptionPending when the query is actually enabled.
  // React Query v5 reports isPending=true for disabled queries that never fetched.
  const isPending = statusPending || (enabled && subscriptionPending)

  const subscription = (data as Subscription | null | undefined) ?? null
  const plan = subscription
    ? (plans.find((p) => p.id === subscription.planId) ?? null)
    : null

  // Falls back to the raw id for plans no longer in the catalog.
  const getPlanName = (planId: string) =>
    plans.find((p) => p.id === planId)?.name ?? planId

  return {
    subscription,
    plan,
    plans,
    getPlanName,
    isActive: subscription?.status === 'active',
    isTrialing: subscription?.status === 'trialing',
    isPending,
    enabled,
  }
}
