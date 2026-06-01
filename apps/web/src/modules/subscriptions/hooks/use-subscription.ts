import {
  getMeSubscriptionQueryOptions,
  getSubscriptionStatusQueryOptions,
} from '@helix/api-client/hooks'
import type { Subscription } from '@helix/api-client/types'
import { useQuery } from '@tanstack/react-query'

export function useSubscription() {
  const { data: statusData } = useQuery({
    ...getSubscriptionStatusQueryOptions(),
    staleTime: Infinity,
  })

  const enabled = statusData?.enabled ?? false

  const { data, isPending } = useQuery({
    ...getMeSubscriptionQueryOptions(),
    enabled,
  })

  const subscription = (data as Subscription | null | undefined) ?? null

  return {
    subscription,
    isActive: subscription?.status === 'active',
    isTrialing: subscription?.status === 'trialing',
    isPending,
    enabled,
  }
}
