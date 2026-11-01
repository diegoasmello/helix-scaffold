import { createSubscriptionEntitlements } from '@helix/api-client/mocks'
import type { SubscriptionEntitlements } from '@helix/api-client/types'
import { describe, expect, it } from 'vitest'

import { hasSubscriptionAccess } from './access'

function entitlements(
  overrides: Partial<SubscriptionEntitlements> = {}
): SubscriptionEntitlements {
  return createSubscriptionEntitlements({
    operator: false,
    subscribed: true,
    features: ['reports'],
    graceEndsAt: null,
    ...overrides,
  })
}

const enabled = (value: SubscriptionEntitlements | null) => ({
  enabled: true,
  entitlements: value,
})

describe('hasSubscriptionAccess', () => {
  it('grants everything when subscriptions are disabled', () => {
    expect(
      hasSubscriptionAccess({ enabled: false, entitlements: null }, 'reports')
    ).toBe(true)
  })

  it('denies everything until the entitlements are loaded', () => {
    expect(hasSubscriptionAccess(enabled(null))).toBe(false)
  })

  it('grants everything to operators', () => {
    const operator = entitlements({
      operator: true,
      subscribed: false,
      features: [],
    })
    expect(hasSubscriptionAccess(enabled(operator), 'reports')).toBe(true)
  })

  it('denies access without a subscription', () => {
    const none = entitlements({ subscribed: false, features: [] })
    expect(hasSubscriptionAccess(enabled(none))).toBe(false)
    expect(hasSubscriptionAccess(enabled(none), 'reports')).toBe(false)
  })

  it('grants any subscription when no feature is given', () => {
    expect(hasSubscriptionAccess(enabled(entitlements({ features: [] })))).toBe(
      true
    )
  })

  it('grants a feature the plan includes', () => {
    expect(hasSubscriptionAccess(enabled(entitlements()), 'reports')).toBe(true)
  })

  it('denies a feature the plan lacks', () => {
    expect(
      hasSubscriptionAccess(enabled(entitlements({ features: [] })), 'reports')
    ).toBe(false)
  })
})
