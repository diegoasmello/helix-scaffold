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

  const { data, isPending: subscriptionPending } = useQuery({
    ...getMeSubscriptionQueryOptions(),
    enabled,
  })

  // Only count subscriptionPending when the query is actually enabled.
  // React Query v5 reports isPending=true for disabled queries that never fetched.
  const isPending = statusPending || (enabled && subscriptionPending)

  const subscription = (data as Subscription | undefined) ?? null

  return {
    subscription,
    isActive: subscription?.status === 'active',
    isTrialing: subscription?.status === 'trialing',
    isPending,
    enabled,
  }
}
