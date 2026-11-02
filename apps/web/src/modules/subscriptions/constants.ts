import type { StatusTone } from '@helix/ui'

import type { SubscriptionStatus } from './types'

/** The `StatusBadge` tone of each subscription status. */
export const SUBSCRIPTION_STATUS_TONES: Record<SubscriptionStatus, StatusTone> =
  {
    active: 'success',
    trialing: 'info',
    past_due: 'warning',
    canceled: 'neutral',
    expired: 'danger',
  }
