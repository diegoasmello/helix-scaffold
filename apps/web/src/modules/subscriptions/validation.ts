import { createValidator, required } from '@helix/ui'

import type { SubscriptionFormValues } from './types'

export const subscriptionFormValidate =
  createValidator<SubscriptionFormValues>()({
    userId: [required],
    planId: [required],
    status: [required],
    currentPeriodStart: [required],
    currentPeriodEnd: [required],
  })
