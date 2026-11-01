import { describe, expect, it } from 'vitest'

import {
  denialFor,
  type Entitlements,
  resolveEntitlements,
} from './entitlements'

// Plans come from src/config/test-overrides.ts: `starter` (no features),
// `pro` and `enterprise` (both ['todos']).
const none = {
  operator: false,
  subscription: null,
  pastDueGraceDays: 7,
}

function entitlements(overrides: Partial<Entitlements> = {}): Entitlements {
  return {
    operator: false,
    subscribed: true,
    features: ['todos'],
    graceEndsAt: null,
    ...overrides,
  }
}

describe('resolveEntitlements', () => {
  it('grants nothing without a subscription', () => {
    expect(resolveEntitlements(none)).toEqual({
      operator: false,
      subscribed: false,
      features: [],
      graceEndsAt: null,
    })
  })

  it("lists the plan's features", () => {
    const result = resolveEntitlements({
      ...none,
      subscription: { planId: 'pro', status: 'active', pastDueSince: null },
    })
    expect(result.subscribed).toBe(true)
    expect(result.features).toEqual(['todos'])
  })

  it('unlocks no features for a plan removed from the catalog', () => {
    const result = resolveEntitlements({
      ...none,
      subscription: { planId: 'legacy', status: 'active', pastDueSince: null },
    })
    expect(result.subscribed).toBe(true)
    expect(result.features).toEqual([])
  })

  it('ends the grace period pastDueGraceDays after pastDueSince', () => {
    const result = resolveEntitlements({
      ...none,
      subscription: {
        planId: 'pro',
        status: 'past_due',
        pastDueSince: new Date('2026-03-01T12:00:00.000Z'),
      },
    })
    expect(result.graceEndsAt).toEqual(new Date('2026-03-08T12:00:00.000Z'))
  })

  it.each(['active', 'trialing'] as const)(
    'has no grace end for a %s subscription',
    (status) => {
      const result = resolveEntitlements({
        ...none,
        subscription: { planId: 'pro', status, pastDueSince: null },
      })
      expect(result.graceEndsAt).toBeNull()
    }
  )

  it('keeps the operator flag', () => {
    expect(resolveEntitlements({ ...none, operator: true }).operator).toBe(true)
  })
})

describe('denialFor', () => {
  it('lets operators through without a subscription', () => {
    const operator = entitlements({
      operator: true,
      subscribed: false,
      features: [],
    })
    expect(denialFor(operator, 'todos')).toBeNull()
  })

  it('requires a subscription', () => {
    const unsubscribed = entitlements({ subscribed: false, features: [] })
    expect(denialFor(unsubscribed)).toBe('subscription_required')
    expect(denialFor(unsubscribed, 'todos')).toBe('subscription_required')
  })

  it('accepts any subscription when no feature is asked for', () => {
    expect(denialFor(entitlements({ features: [] }))).toBeNull()
  })

  it("requires the feature to be in the user's plan", () => {
    expect(denialFor(entitlements(), 'todos')).toBeNull()
    expect(denialFor(entitlements({ features: [] }), 'todos')).toBe(
      'feature_not_in_plan'
    )
  })
})
