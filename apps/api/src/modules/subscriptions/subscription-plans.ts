import type { Config } from '@/config'

/** The plan catalog: `config.subscriptions.plans`. */
export type PlanCatalog = Config['subscriptions']['plans']
export type SubscriptionPlan = PlanCatalog[number]

export function getPlan(
  plans: PlanCatalog,
  planId: string
): SubscriptionPlan | undefined {
  return plans.find((plan) => plan.id === planId)
}

export function isKnownPlan(plans: PlanCatalog, planId: string): boolean {
  return getPlan(plans, planId) !== undefined
}

/** True when at least one plan declares the feature. */
export function isKnownFeature(plans: PlanCatalog, feature: string): boolean {
  return plans.some((plan) => plan.features.includes(feature))
}
