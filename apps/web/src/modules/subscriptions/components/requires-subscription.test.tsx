import {
  createSubscription,
  getMePermissionsHandler,
  getMeSubscriptionHandler,
  getMeSubscriptionHandlerResponse204,
  getSubscriptionStatusHandler,
  getSubscriptionStatusHandlerResponse200,
} from '@helix/api-client/mocks'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import { RequiresSubscription } from './requires-subscription'

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

function mockSubscription(planId: string | null) {
  server.use(
    getMeSubscriptionHandler(() =>
      planId
        ? new Response(
            JSON.stringify(createSubscription({ planId, status: 'active' })),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        : getMeSubscriptionHandlerResponse204()
    )
  )
}

function renderGate(feature?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <RequiresSubscription feature={feature} fallback={<p>Upgrade</p>}>
        <p>Premium</p>
      </RequiresSubscription>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  server.use(
    getSubscriptionStatusHandler(() =>
      getSubscriptionStatusHandlerResponse200({ enabled: true, plans })
    ),
    getMePermissionsHandler({ grants: {} })
  )
})

describe('RequiresSubscription', () => {
  it('renders children when subscriptions are disabled', async () => {
    server.use(
      getSubscriptionStatusHandler(() =>
        getSubscriptionStatusHandlerResponse200({ enabled: false, plans: [] })
      )
    )
    renderGate('reports')
    expect(await screen.findByText('Premium')).toBeInTheDocument()
  })

  it('renders the fallback without an active subscription', async () => {
    mockSubscription(null)
    renderGate()
    expect(await screen.findByText('Upgrade')).toBeInTheDocument()
  })

  it('renders children with any active subscription when no feature is given', async () => {
    mockSubscription('starter')
    renderGate()
    expect(await screen.findByText('Premium')).toBeInTheDocument()
  })

  it('renders the fallback when the plan lacks the feature', async () => {
    mockSubscription('starter')
    renderGate('reports')
    expect(await screen.findByText('Upgrade')).toBeInTheDocument()
  })

  it('renders children when the plan includes the feature', async () => {
    mockSubscription('pro')
    renderGate('reports')
    expect(await screen.findByText('Premium')).toBeInTheDocument()
  })

  it('renders children for users with subscriptions:view', async () => {
    mockSubscription(null)
    server.use(getMePermissionsHandler({ grants: { subscriptions: ['view'] } }))
    renderGate('reports')
    expect(await screen.findByText('Premium')).toBeInTheDocument()
  })
})
