import type { ReactNode } from 'react'

import { useSubscriptionAccess } from '../hooks/use-subscription-access'

export interface RequiresSubscriptionProps {
  children: ReactNode
  /** Also require the user's plan to include this feature. */
  feature?: string
  fallback?: ReactNode
}

export function RequiresSubscription(
  props: Readonly<RequiresSubscriptionProps>
) {
  const { children, feature, fallback = null } = props

  const { hasAccess, isPending } = useSubscriptionAccess()

  if (isPending) return null

  return hasAccess(feature) ? <>{children}</> : <>{fallback}</>
}
