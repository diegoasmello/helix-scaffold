import {
  createSubscription,
  getMeSubscriptionHandler,
  getMeSubscriptionHandlerResponse200,
  getMeSubscriptionHandlerResponse204,
  getSubscriptionStatusHandler,
  getSubscriptionStatusHandlerResponse200,
} from '@helix/api-client/mocks'
import type { Subscription } from '@helix/api-client/types'
import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { parseISO } from 'date-fns'
import { delay } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { formatDate } from '@/utils/date'

import { server } from '../../../mocks/server'
import { MeSubscription } from './me-subscription'

const plans = [
  { id: 'starter', name: 'Starter', features: [] },
  { id: 'pro', name: 'Pro', features: ['todos'] },
]

const mockSubscription = createSubscription({
  id: 'sub-1',
  planId: 'pro',
  status: 'active',
  currentPeriodStart: '2026-01-01T12:00:00.000Z',
  currentPeriodEnd: '2026-02-01T12:00:00.000Z',
  trialEndsAt: null,
})

const short = (iso: string) => formatDate(parseISO(iso), 'short')

function mockMeSubscription(subscription: Subscription | null) {
  server.use(
    getMeSubscriptionHandler(() =>
      subscription
        ? getMeSubscriptionHandlerResponse200(subscription)
        : getMeSubscriptionHandlerResponse204()
    )
  )
}

function renderMeSubscription() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <QueryClientProvider client={queryClient}>
          <MeSubscription />
        </QueryClientProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(
    getSubscriptionStatusHandler(() =>
      getSubscriptionStatusHandlerResponse200({ enabled: true, plans })
    )
  )
  mockMeSubscription(mockSubscription)
})

describe('MeSubscription', () => {
  it('shows a loader while the subscription is loading', async () => {
    server.use(
      getMeSubscriptionHandler(async () => {
        await delay('infinite')
        return getMeSubscriptionHandlerResponse204()
      })
    )
    const { container } = renderMeSubscription()
    expect(container.querySelector('.mantine-Loader-root')).toBeInTheDocument()
    expect(screen.queryByText('Subscription')).not.toBeInTheDocument()
  })

  it('shows the empty state when the user has no subscription', async () => {
    mockMeSubscription(null)
    renderMeSubscription()
    expect(
      await screen.findByRole('heading', { name: 'No active subscription' })
    ).toBeInTheDocument()
    expect(
      screen.getByText("You don't have an active subscription.")
    ).toBeInTheDocument()
  })

  it('renders the plan name from the catalog', async () => {
    renderMeSubscription()
    expect(
      await screen.findByRole('heading', { name: 'Subscription' })
    ).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
  })

  it('falls back to the raw plan id for plans not in the catalog', async () => {
    mockMeSubscription({ ...mockSubscription, planId: 'legacy' })
    renderMeSubscription()
    expect(await screen.findByText('legacy')).toBeInTheDocument()
  })

  it('renders the status badge', async () => {
    mockMeSubscription({ ...mockSubscription, status: 'trialing' })
    renderMeSubscription()
    expect(await screen.findByText('Trialing')).toBeInTheDocument()
  })

  it('renders the current period dates', async () => {
    renderMeSubscription()
    await screen.findByText('Pro')
    expect(screen.getByText('Period start')).toBeInTheDocument()
    expect(
      screen.getByText(short(mockSubscription.currentPeriodStart))
    ).toBeInTheDocument()
    expect(screen.getByText('Period end')).toBeInTheDocument()
    expect(
      screen.getByText(short(mockSubscription.currentPeriodEnd))
    ).toBeInTheDocument()
  })

  it('renders the trial end date when set', async () => {
    const trialEndsAt = '2026-01-15T12:00:00.000Z'
    mockMeSubscription({ ...mockSubscription, trialEndsAt })
    renderMeSubscription()
    expect(await screen.findByText('Trial ends')).toBeInTheDocument()
    expect(screen.getByText(short(trialEndsAt))).toBeInTheDocument()
  })

  it('hides the trial end date when not set', async () => {
    renderMeSubscription()
    await screen.findByText('Pro')
    expect(screen.queryByText('Trial ends')).not.toBeInTheDocument()
  })
})
