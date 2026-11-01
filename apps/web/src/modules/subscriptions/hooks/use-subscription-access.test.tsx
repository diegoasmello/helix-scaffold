import {
  getMeEntitlementsHandler,
  getMeEntitlementsHandlerResponse200,
  getSubscriptionStatusHandler,
  getSubscriptionStatusHandlerResponse200,
} from '@helix/api-client/mocks'
import type { SubscriptionEntitlements } from '@helix/api-client/types'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { delay } from 'msw'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import { server } from '../../../mocks/server'
import { useSubscriptionAccess } from './use-subscription-access'

const plans = [
  { id: 'starter', name: 'Starter', features: [] },
  { id: 'pro', name: 'Pro', features: ['reports'] },
]

const none: SubscriptionEntitlements = {
  operator: false,
  subscribed: false,
  features: [],
  graceEndsAt: null,
}

function mockEntitlements(overrides: Partial<SubscriptionEntitlements>) {
  let calls = 0
  server.use(
    getMeEntitlementsHandler(() => {
      calls += 1
      return getMeEntitlementsHandlerResponse200({ ...none, ...overrides })
    })
  )
  return { calls: () => calls }
}

function renderUseSubscriptionAccess() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(() => useSubscriptionAccess(), { wrapper })
}

async function renderSettled() {
  const hook = renderUseSubscriptionAccess()
  await waitFor(() => expect(hook.result.current.isPending).toBe(false))
  return hook.result.current
}

beforeEach(() => {
  server.use(
    getSubscriptionStatusHandler(() =>
      getSubscriptionStatusHandlerResponse200({ enabled: true, plans })
    )
  )
  mockEntitlements({})
})

describe('useSubscriptionAccess', () => {
  it('grants everything when subscriptions are disabled, without asking for entitlements', async () => {
    server.use(
      getSubscriptionStatusHandler(() =>
        getSubscriptionStatusHandlerResponse200({ enabled: false, plans: [] })
      )
    )
    const entitlements = mockEntitlements({})
    const { hasAccess } = await renderSettled()
    expect(hasAccess()).toBe(true)
    expect(hasAccess('reports')).toBe(true)
    expect(entitlements.calls()).toBe(0)
  })

  it('grants everything to operators', async () => {
    mockEntitlements({ operator: true })
    const { hasAccess } = await renderSettled()
    expect(hasAccess()).toBe(true)
    expect(hasAccess('reports')).toBe(true)
  })

  it('denies access without a subscription', async () => {
    const { hasAccess } = await renderSettled()
    expect(hasAccess()).toBe(false)
    expect(hasAccess('reports')).toBe(false)
  })

  it('grants feature-less access to a subscribed user', async () => {
    mockEntitlements({ subscribed: true })
    const { hasAccess } = await renderSettled()
    expect(hasAccess()).toBe(true)
    expect(hasAccess('reports')).toBe(false)
  })

  it('grants the features the API lists', async () => {
    mockEntitlements({ subscribed: true, features: ['reports'] })
    const { hasAccess } = await renderSettled()
    expect(hasAccess('reports')).toBe(true)
  })

  it('returns when a past_due subscription loses access', async () => {
    mockEntitlements({
      subscribed: true,
      graceEndsAt: '2026-03-08T12:00:00.000Z',
    })
    const { graceEndsAt } = await renderSettled()
    expect(graceEndsAt).toEqual(new Date('2026-03-08T12:00:00.000Z'))
  })

  it('has no grace end otherwise', async () => {
    mockEntitlements({ subscribed: true })
    const { graceEndsAt } = await renderSettled()
    expect(graceEndsAt).toBeNull()
  })

  it('stays pending until the entitlements load', async () => {
    server.use(
      getMeEntitlementsHandler(async () => {
        await delay('infinite')
        return getMeEntitlementsHandlerResponse200(none)
      })
    )
    const { result } = renderUseSubscriptionAccess()
    // Give the status query time to settle.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(result.current.isPending).toBe(true)
  })
})
