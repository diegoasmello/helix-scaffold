import type { ReactNode } from 'react'

import { useSubscription } from './use-subscription'

interface RequiresSubscriptionProps {
  children: ReactNode
  fallback?: ReactNode
}

export function RequiresSubscription(
  props: Readonly<RequiresSubscriptionProps>
) {
  const { children, fallback = null } = props
  const { enabled, isActive, isTrialing } = useSubscription()

  if (!enabled) return <>{children}</>
  return isActive || isTrialing ? <>{children}</> : <>{fallback}</>
}
