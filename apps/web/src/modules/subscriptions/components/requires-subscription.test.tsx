import {
  getMeEntitlementsHandler,
  getSubscriptionStatusHandler,
  getSubscriptionStatusHandlerResponse200,
} from '@helix/api-client/mocks'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { server } from '../../../mocks/server'
import { RequiresSubscription } from './requires-subscription'

const plans = [
  { id: 'starter', name: 'Starter', features: [] },
  { id: 'pro', name: 'Pro', features: ['reports'] },
]

// What GET /me/entitlements answers for a user on that plan (or none).
function mockSubscription(planId: string | null) {
  server.use(
    getMeEntitlementsHandler({
      operator: false,
      subscribed: planId !== null,
      features: plans.find((plan) => plan.id === planId)?.features ?? [],
      graceEndsAt: null,
    })
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
      getSubscriptionStatusHandlerResponse200({
        enabled: true,
        plans,
      })
    )
  )
})

describe('RequiresSubscription', () => {
  it('renders children when subscriptions are disabled', async () => {
    server.use(
      getSubscriptionStatusHandler(() =>
        getSubscriptionStatusHandlerResponse200({
          enabled: false,
          plans: [],
        })
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

  it('renders children for operators', async () => {
    server.use(
      getMeEntitlementsHandler({
        operator: true,
        subscribed: false,
        features: [],
        graceEndsAt: null,
      })
    )
    renderGate('reports')
    expect(await screen.findByText('Premium')).toBeInTheDocument()
  })
})
