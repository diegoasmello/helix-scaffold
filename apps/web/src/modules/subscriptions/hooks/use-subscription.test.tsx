import {
  createSubscription,
  getMeSubscriptionHandler,
  getMeSubscriptionHandlerResponse200,
  getMeSubscriptionHandlerResponse204,
  getSubscriptionStatusHandler,
  getSubscriptionStatusHandlerResponse200,
} from '@helix/api-client/mocks'
import type { Subscription } from '@helix/api-client/types'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { delay } from 'msw'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import { server } from '../../../mocks/server'
import { useSubscription } from './use-subscription'

const plans = [
  { id: 'starter', name: 'Starter', features: [] },
  { id: 'pro', name: 'Pro', features: ['reports'] },
]

function mockStatus(enabled: boolean) {
  server.use(
    getSubscriptionStatusHandler(() =>
      getSubscriptionStatusHandlerResponse200(
        enabled ? { enabled: true, plans } : { enabled: false, plans: [] }
      )
    )
  )
}

function mockMeSubscription(subscription: Subscription | null) {
  let calls = 0
  server.use(
    getMeSubscriptionHandler(() => {
      calls += 1
      return subscription
        ? getMeSubscriptionHandlerResponse200(subscription)
        : getMeSubscriptionHandlerResponse204()
    })
  )
  return { calls: () => calls }
}

function renderUseSubscription() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(() => useSubscription(), { wrapper })
}

async function renderSettled() {
  const hook = renderUseSubscription()
  await waitFor(() => expect(hook.result.current.isPending).toBe(false))
  return hook.result
}

beforeEach(() => {
  mockStatus(true)
  mockMeSubscription(null)
})

describe('useSubscription', () => {
  describe('when subscriptions are disabled', () => {
    beforeEach(() => mockStatus(false))

    it('returns safe defaults', async () => {
      const result = await renderSettled()
      expect(result.current).toMatchObject({
        enabled: false,
        plans: [],
        subscription: null,
        plan: null,
        isActive: false,
        isTrialing: false,
      })
    })

    it('never requests GET /me/subscription', async () => {
      const meSubscription = mockMeSubscription(
        createSubscription({ status: 'active' })
      )
      await renderSettled()
      expect(meSubscription.calls()).toBe(0)
    })
  })

  describe('when subscriptions are enabled', () => {
    it('exposes the plan catalog', async () => {
      const result = await renderSettled()
      expect(result.current.enabled).toBe(true)
      expect(result.current.plans).toEqual(plans)
    })

    it('returns no subscription when the API answers 204', async () => {
      const result = await renderSettled()
      expect(result.current.subscription).toBeNull()
      expect(result.current.plan).toBeNull()
      expect(result.current.isActive).toBe(false)
      expect(result.current.isTrialing).toBe(false)
    })

    it('resolves an active subscription and its plan', async () => {
      const subscription = createSubscription({
        planId: 'pro',
        status: 'active',
      })
      mockMeSubscription(subscription)
      const result = await renderSettled()
      expect(result.current.subscription).toEqual(subscription)
      expect(result.current.plan).toEqual(plans[1])
      expect(result.current.isActive).toBe(true)
      expect(result.current.isTrialing).toBe(false)
    })

    it('flags a trialing subscription', async () => {
      mockMeSubscription(
        createSubscription({ planId: 'starter', status: 'trialing' })
      )
      const result = await renderSettled()
      expect(result.current.isTrialing).toBe(true)
      expect(result.current.isActive).toBe(false)
    })

    it('returns plan null when the plan was removed from the catalog', async () => {
      mockMeSubscription(
        createSubscription({ planId: 'legacy', status: 'active' })
      )
      const result = await renderSettled()
      expect(result.current.subscription?.planId).toBe('legacy')
      expect(result.current.plan).toBeNull()
    })
  })

  describe('getPlanName', () => {
    it('returns the catalog name', async () => {
      const result = await renderSettled()
      expect(result.current.getPlanName('pro')).toBe('Pro')
    })

    it('falls back to the raw id for plans not in the catalog', async () => {
      const result = await renderSettled()
      expect(result.current.getPlanName('legacy')).toBe('legacy')
    })
  })

  describe('isPending', () => {
    it('is true while the status is loading', () => {
      server.use(
        getSubscriptionStatusHandler(async () => {
          await delay('infinite')
          return getSubscriptionStatusHandlerResponse200({
            enabled: false,
            plans: [],
          })
        })
      )
      const { result } = renderUseSubscription()
      expect(result.current.isPending).toBe(true)
    })

    it('stays true after the status resolves until the subscription loads', async () => {
      server.use(
        getMeSubscriptionHandler(async () => {
          await delay('infinite')
          return getMeSubscriptionHandlerResponse204()
        })
      )
      const { result } = renderUseSubscription()
      await waitFor(() => expect(result.current.enabled).toBe(true))
      expect(result.current.isPending).toBe(true)
    })
  })
})
