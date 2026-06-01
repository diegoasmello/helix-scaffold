import type { SubscriptionStatus } from './types'

export const SUBSCRIPTION_STATUS_COLORS: Record<SubscriptionStatus, string> = {
  active: 'green',
  trialing: 'blue',
  canceled: 'gray',
  past_due: 'orange',
  expired: 'red',
}
