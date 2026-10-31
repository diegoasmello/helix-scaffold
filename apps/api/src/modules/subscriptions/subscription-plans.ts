import { config } from '@/config'

export type SubscriptionPlan = (typeof config.subscriptions.plans)[number]

export function getPlan(planId: string): SubscriptionPlan | undefined {
  return config.subscriptions.plans.find((plan) => plan.id === planId)
}

export function isKnownPlan(planId: string): boolean {
  return getPlan(planId) !== undefined
}

/** True when at least one plan declares the feature. */
export function isKnownFeature(feature: string): boolean {
  return config.subscriptions.plans.some((plan) =>
    plan.features.includes(feature)
  )
}

/** Unknown plans (e.g. removed from the catalog) unlock no features. */
export function planHasFeature(planId: string, feature: string): boolean {
  return getPlan(planId)?.features.includes(feature) ?? false
}
