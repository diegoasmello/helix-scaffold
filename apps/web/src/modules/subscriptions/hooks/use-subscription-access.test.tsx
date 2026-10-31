import {
  createSubscription,
  getMePermissionsHandler,
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
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import { useSubscriptionAccess } from './use-subscription-access'

vi.mock('../../../lib/authentication', () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: {
          id: 'test-user',
          name: 'Test',
          email: 'test@example.com',
          image: null,
          roleId: 'test-role',
        },
      },
      isPending: false,
    }),
  },
}))

const plans = [
  { id: 'starter', name: 'Starter', features: [] },
  { id: 'pro', name: 'Pro', features: ['reports'] },
]

function mockSubscription(subscription: Subscription | null) {
  server.use(
    getMeSubscriptionHandler(() =>
      subscription
        ? getMeSubscriptionHandlerResponse200(subscription)
        : getMeSubscriptionHandlerResponse204()
    )
  )
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
  return hook.result.current.hasAccess
}

beforeEach(() => {
  server.use(
    getSubscriptionStatusHandler(() =>
      getSubscriptionStatusHandlerResponse200({
        enabled: true,
        plans,
        pastDueGraceDays: 0,
      })
    ),
    getMePermissionsHandler({ grants: {} })
  )
  mockSubscription(null)
})

describe('useSubscriptionAccess', () => {
  it('grants everything when subscriptions are disabled', async () => {
    server.use(
      getSubscriptionStatusHandler(() =>
        getSubscriptionStatusHandlerResponse200({
          enabled: false,
          plans: [],
          pastDueGraceDays: 0,
        })
      )
    )
    const hasAccess = await renderSettled()
    expect(hasAccess()).toBe(true)
    expect(hasAccess('reports')).toBe(true)
  })

  it('grants everything to operators with subscriptions:view', async () => {
    server.use(getMePermissionsHandler({ grants: { subscriptions: ['view'] } }))
    const hasAccess = await renderSettled()
    expect(hasAccess()).toBe(true)
    expect(hasAccess('reports')).toBe(true)
  })

  it('denies access without a subscription', async () => {
    const hasAccess = await renderSettled()
    expect(hasAccess()).toBe(false)
    expect(hasAccess('reports')).toBe(false)
  })

  it.each(['canceled', 'expired'] as const)(
    'denies access when the subscription is %s',
    async (status) => {
      mockSubscription(createSubscription({ planId: 'pro', status }))
      const hasAccess = await renderSettled()
      expect(hasAccess()).toBe(false)
      expect(hasAccess('reports')).toBe(false)
    }
  )

  // past_due only comes back from GET /me/subscription while inside the
  // grace period (subscriptions.pastDueGraceDays), so it grants access.
  it.each(['active', 'trialing', 'past_due'] as const)(
    'grants feature-less access when the subscription is %s',
    async (status) => {
      mockSubscription(createSubscription({ planId: 'starter', status }))
      const hasAccess = await renderSettled()
      expect(hasAccess()).toBe(true)
    }
  )

  it('grants a feature the plan includes', async () => {
    mockSubscription(createSubscription({ planId: 'pro', status: 'trialing' }))
    const hasAccess = await renderSettled()
    expect(hasAccess('reports')).toBe(true)
  })

  it('denies a feature the plan lacks', async () => {
    mockSubscription(
      createSubscription({ planId: 'starter', status: 'active' })
    )
    const hasAccess = await renderSettled()
    expect(hasAccess('reports')).toBe(false)
  })

  it('denies features when the plan was removed from the catalog', async () => {
    mockSubscription(createSubscription({ planId: 'legacy', status: 'active' }))
    const hasAccess = await renderSettled()
    expect(hasAccess()).toBe(true)
    expect(hasAccess('reports')).toBe(false)
  })

  it('stays pending until permissions load, even after the subscription resolves', async () => {
    server.use(
      getMePermissionsHandler(async () => {
        await delay('infinite')
        return new Response(null)
      })
    )
    const { result } = renderUseSubscriptionAccess()
    // Give the subscription queries time to settle.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(result.current.isPending).toBe(true)
  })
})
