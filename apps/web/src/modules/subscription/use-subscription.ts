import { getMeSubscriptionQueryOptions } from '@helix/api-client/hooks'
import type { Subscription } from '@helix/api-client/types'
import { useQuery } from '@tanstack/react-query'

import { useSubscriptionMode } from './use-subscription-mode'

export function useSubscription() {
  const { enabled } = useSubscriptionMode()
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
