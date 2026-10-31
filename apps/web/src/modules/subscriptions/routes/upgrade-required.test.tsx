import {
  createSubscription,
  getMeSubscriptionHandler,
  getMeSubscriptionHandlerResponse204,
  getSubscriptionStatusHandler,
  getSubscriptionStatusHandlerResponse200,
} from '@helix/api-client/mocks'
import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import { UpgradeRequired } from './upgrade-required'

const mockNavigate = vi.fn()
const mockBack = vi.fn()
const mockSearch = vi.hoisted(() => ({
  current: {} as { feature?: string },
}))

vi.mock('.', () => ({
  upgradeRoute: {
    useSearch: () => mockSearch.current,
    useNavigate: () => mockNavigate,
  },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useRouter: () => ({ history: { back: mockBack } }),
}))

const plans = [
  { id: 'starter', name: 'Starter', features: [] },
  { id: 'pro', name: 'Pro', features: ['reports'] },
  { id: 'enterprise', name: 'Enterprise', features: ['reports'] },
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

function renderUpgrade(feature?: string) {
  mockSearch.current = { feature }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <QueryClientProvider client={queryClient}>
          <UpgradeRequired />
        </QueryClientProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(
    getSubscriptionStatusHandler(() =>
      getSubscriptionStatusHandlerResponse200({
        enabled: true,
        plans,
        pastDueGraceDays: 0,
      })
    )
  )
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('UpgradeRequired', () => {
  it('asks for a subscription when the user has none', async () => {
    mockSubscription(null)
    renderUpgrade('reports')
    expect(
      await screen.findByRole('heading', { name: 'Subscription required' })
    ).toBeInTheDocument()
  })

  it('names the current plan when it lacks the feature', async () => {
    mockSubscription('starter')
    renderUpgrade('reports')
    expect(
      await screen.findByRole('heading', { name: 'Upgrade your plan' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Your current plan (Starter) doesn't include this feature."
      )
    ).toBeInTheDocument()
  })

  it('lists only the plans that include the feature', async () => {
    mockSubscription('starter')
    renderUpgrade('reports')
    await screen.findByText('Available on')
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('Enterprise')).toBeInTheDocument()
    expect(screen.queryByText('Starter')).not.toBeInTheDocument()
  })

  it('lists every plan when no feature is given', async () => {
    mockSubscription(null)
    renderUpgrade()
    await screen.findByText('Available on')
    expect(screen.getByText('Starter')).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
  })

  it('navigates to the user subscription page', async () => {
    mockSubscription('starter')
    renderUpgrade('reports')
    await userEvent.click(
      await screen.findByRole('button', { name: 'View my subscription' })
    )
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/me/subscription' })
  })

  it('goes back when Back is clicked', async () => {
    mockSubscription(null)
    renderUpgrade('reports')
    await userEvent.click(await screen.findByRole('button', { name: 'Back' }))
    expect(mockBack).toHaveBeenCalled()
  })
})
