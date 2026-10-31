import type {
  PatchSubscriptionsIdMutationRequest,
  PostSubscriptionsMutationRequest,
  Subscription,
  SubscriptionPlan as ApiSubscriptionPlan,
  SubscriptionStatusEnumKey,
} from '@helix/api-client/types'

export type SubscriptionItem = Subscription
export type SubscriptionPlan = ApiSubscriptionPlan
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
  externalId: string
}
