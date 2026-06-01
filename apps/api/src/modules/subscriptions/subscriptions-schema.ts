import z from 'zod'

import {
  paginatedResponseSchema,
  paginationQuerySchema,
} from '@/lib/pagination'
import { sortingQuerySchema } from '@/lib/sorting'

export const SUBSCRIPTION_STATUSES = [
  'active',
  'trialing',
  'canceled',
  'past_due',
  'expired',
] as const

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

export const subscriptionSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    planId: z.string(),
    status: z.enum(SUBSCRIPTION_STATUSES),
    trialEndsAt: z.date().nullable(),
    currentPeriodStart: z.date(),
    currentPeriodEnd: z.date(),
    canceledAt: z.date().nullable(),
    externalId: z.string().nullable(),
    metadata: z.unknown().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .meta({ id: 'Subscription', title: 'Subscription' })

export const createSubscriptionSchema = z.object({
  userId: z.string().min(1),
  planId: z.string().min(1).max(100),
  status: z.enum(SUBSCRIPTION_STATUSES).default('active'),
  currentPeriodStart: z.coerce.date(),
  currentPeriodEnd: z.coerce.date(),
  trialEndsAt: z.coerce.date().optional(),
  externalId: z.string().max(255).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const updateSubscriptionSchema = z.object({
  planId: z.string().min(1).max(100).optional(),
  status: z.enum(SUBSCRIPTION_STATUSES).optional(),
  currentPeriodStart: z.coerce.date().optional(),
  currentPeriodEnd: z.coerce.date().optional(),
  trialEndsAt: z.coerce.date().nullable().optional(),
  canceledAt: z.coerce.date().nullable().optional(),
  externalId: z.string().max(255).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const SUBSCRIPTION_SORT_COLUMNS = [
  'planId',
  'status',
  'currentPeriodEnd',
  'createdAt',
] as const
export type SubscriptionSortColumn = (typeof SUBSCRIPTION_SORT_COLUMNS)[number]

export const subscriptionsSortingSchema = sortingQuerySchema([
  ...SUBSCRIPTION_SORT_COLUMNS,
])
export const subscriptionsListQuerySchema = paginationQuerySchema.merge(
  subscriptionsSortingSchema
)
export type SubscriptionsListQuery = z.infer<
  typeof subscriptionsListQuerySchema
>

export const paginatedSubscriptionsSchema = paginatedResponseSchema(
  subscriptionSchema
).meta({
  id: 'PaginatedSubscriptions',
  title: 'PaginatedSubscriptions',
})

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>
export type PaginatedSubscriptions = z.infer<
  typeof paginatedSubscriptionsSchema
>
