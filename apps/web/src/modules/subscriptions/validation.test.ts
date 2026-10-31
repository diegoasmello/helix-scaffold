import { describe, expect, it } from 'vitest'

import type { SubscriptionFormValues } from './types'
import { subscriptionFormValidate } from './validation'

const base: SubscriptionFormValues = {
  userId: 'user-1',
  planId: 'pro',
  status: 'active',
  currentPeriodStart: '2026-01-01',
  currentPeriodEnd: '2026-02-01',
  trialEndsAt: null,
  externalId: '',
}

describe('subscriptionFormValidate', () => {
  describe('userId', () => {
    it('returns error when empty', () => {
      expect(subscriptionFormValidate.userId('', base)).toBe('Required')
    })
    it('returns null when valid', () => {
      expect(subscriptionFormValidate.userId('user-1', base)).toBeNull()
    })
  })

  describe('planId', () => {
    it('returns error when empty', () => {
      expect(subscriptionFormValidate.planId('', base)).toBe('Required')
    })
    it('returns null when valid', () => {
      expect(subscriptionFormValidate.planId('pro', base)).toBeNull()
    })
  })

  describe('status', () => {
    it('returns error when empty', () => {
      expect(
        subscriptionFormValidate.status(
          '' as SubscriptionFormValues['status'],
          base
        )
      ).toBe('Required')
    })
    it('returns null when valid', () => {
      expect(subscriptionFormValidate.status('trialing', base)).toBeNull()
    })
  })

  describe('currentPeriodStart', () => {
    it('returns error when empty', () => {
      expect(subscriptionFormValidate.currentPeriodStart('', base)).toBe(
        'Required'
      )
    })
    it('returns null when valid', () => {
      expect(
        subscriptionFormValidate.currentPeriodStart('2026-01-01', base)
      ).toBeNull()
    })
  })

  describe('currentPeriodEnd', () => {
    it('returns error when empty', () => {
      expect(subscriptionFormValidate.currentPeriodEnd('', base)).toBe(
        'Required'
      )
    })
    it('returns null when valid', () => {
      expect(
        subscriptionFormValidate.currentPeriodEnd('2026-02-01', base)
      ).toBeNull()
    })
  })

  it('does not validate optional fields', () => {
    expect(subscriptionFormValidate).not.toHaveProperty('trialEndsAt')
    expect(subscriptionFormValidate).not.toHaveProperty('externalId')
  })
})
