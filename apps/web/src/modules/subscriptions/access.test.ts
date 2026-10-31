import { createSubscription } from '@helix/api-client/mocks'
import { describe, expect, it } from 'vitest'

import { hasSubscriptionAccess, type SubscriptionAccessState } from './access'

const plans = [
  { id: 'starter', name: 'Starter', features: [] },
  { id: 'pro', name: 'Pro', features: ['reports'] },
]

function state(
  overrides: Partial<SubscriptionAccessState> = {}
): SubscriptionAccessState {
  return {
    enabled: true,
    plans,
    subscription: null,
    isOperator: false,
    ...overrides,
  }
}

const active = (planId: string) =>
  createSubscription({ planId, status: 'active' })

describe('hasSubscriptionAccess', () => {
  it('grants everything when subscriptions are disabled', () => {
    expect(hasSubscriptionAccess(state({ enabled: false }), 'reports')).toBe(
      true
    )
  })

  it('grants everything to operators', () => {
    expect(hasSubscriptionAccess(state({ isOperator: true }), 'reports')).toBe(
      true
    )
  })

  it('denies access without a subscription', () => {
    expect(hasSubscriptionAccess(state())).toBe(false)
  })

  it('denies access with a subscription that is not live', () => {
    const subscription = createSubscription({
      planId: 'pro',
      status: 'expired',
    })
    expect(hasSubscriptionAccess(state({ subscription }))).toBe(false)
  })

  it('grants any live subscription when no feature is given', () => {
    expect(
      hasSubscriptionAccess(state({ subscription: active('starter') }))
    ).toBe(true)
  })

  it('accepts trialing subscriptions', () => {
    const subscription = createSubscription({
      planId: 'pro',
      status: 'trialing',
    })
    expect(hasSubscriptionAccess(state({ subscription }), 'reports')).toBe(true)
  })

  it('accepts past_due subscriptions (the API only returns them within the grace period)', () => {
    const subscription = createSubscription({
      planId: 'pro',
      status: 'past_due',
    })
    expect(hasSubscriptionAccess(state({ subscription }), 'reports')).toBe(true)
  })

  it('grants a feature the plan includes', () => {
    expect(
      hasSubscriptionAccess(state({ subscription: active('pro') }), 'reports')
    ).toBe(true)
  })

  it('denies a feature the plan lacks', () => {
    expect(
      hasSubscriptionAccess(
        state({ subscription: active('starter') }),
        'reports'
      )
    ).toBe(false)
  })

  it('denies features for a plan removed from the catalog', () => {
    expect(
      hasSubscriptionAccess(
        state({ subscription: active('legacy') }),
        'reports'
      )
    ).toBe(false)
  })
})
