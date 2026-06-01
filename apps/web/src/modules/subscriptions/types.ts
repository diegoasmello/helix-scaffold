import type {
  PatchSubscriptionsIdMutationRequest,
  PostSubscriptionsMutationRequest,
  Subscription,
  SubscriptionStatusEnumKey,
} from '@helix/api-client/types'

export type SubscriptionItem = Subscription
export type SubscriptionStatus = SubscriptionStatusEnumKey

export type CreateSubscriptionInput = PostSubscriptionsMutationRequest
export type UpdateSubscriptionInput = PatchSubscriptionsIdMutationRequest

export interface SubscriptionFormValues {
  userId: string
  planId: string
  status: SubscriptionStatus
  currentPeriodStart: string
  currentPeriodEnd: string
  trialEndsAt: string | null
  externalId: string | null
}
