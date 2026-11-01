import z from 'zod'

import {
  paginatedResponseSchema,
  paginationQuerySchema,
} from '@/lib/pagination'
import { sortingQuerySchema } from '@/lib/sorting'

import { isKnownPlan, type PlanCatalog } from './subscription-plans'

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
    pastDueSince: z.date().nullable(),
    externalId: z.string().nullable(),
    metadata: z.unknown().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .meta({ id: 'Subscription', title: 'Subscription' })

export const subscriptionPlanSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    features: z.array(z.string()),
  })
  .meta({ id: 'SubscriptionPlan', title: 'SubscriptionPlan' })

// GET /me/entitlements — see `Entitlements` in ./entitlements.ts
export const entitlementsSchema = z
  .object({
    operator: z.boolean(),
    subscribed: z.boolean(),
    features: z.array(z.string()),
    graceEndsAt: z.date().nullable(),
  })
  .meta({ id: 'SubscriptionEntitlements', title: 'SubscriptionEntitlements' })

// Checked against the plan catalog by `subscriptionBodySchemas()`. A plain
// string in the OpenAPI spec so the catalog can change without regenerating
// the client — the frontend reads it from GET /subscription/status.
const planIdSchema = z.string().min(1).max(100)

export const createSubscriptionSchema = z.object({
  userId: z.string().min(1),
  planId: planIdSchema,
  status: z.enum(SUBSCRIPTION_STATUSES).default('active'),
  currentPeriodStart: z.coerce.date(),
  currentPeriodEnd: z.coerce.date(),
  trialEndsAt: z.coerce.date().optional(),
  externalId: z.string().max(255).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const updateSubscriptionSchema = z.object({
  planId: planIdSchema.optional(),
  status: z.enum(SUBSCRIPTION_STATUSES).optional(),
  currentPeriodStart: z.coerce.date().optional(),
  currentPeriodEnd: z.coerce.date().optional(),
  trialEndsAt: z.coerce.date().nullable().optional(),
  canceledAt: z.coerce.date().nullable().optional(),
  externalId: z.string().max(255).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

/** The create/update bodies, with `planId` refined against the catalog (400 `Unknown plan`). */
export function subscriptionBodySchemas(plans: PlanCatalog) {
  const knownPlan = { message: 'Unknown plan', path: ['planId'] }
  return {
    create: createSubscriptionSchema.refine(
      (body) => isKnownPlan(plans, body.planId),
      knownPlan
    ),
    update: updateSubscriptionSchema.refine(
      (body) => body.planId === undefined || isKnownPlan(plans, body.planId),
      knownPlan
    ),
  }
}

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
