import {
  createSubscription,
  getSubscriptionsIdHandler,
  getSubscriptionStatusHandler,
  getSubscriptionStatusHandlerResponse200,
} from '@helix/api-client/mocks'
import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { parseISO } from 'date-fns'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { formatDate } from '@/utils/date'

import { server } from '../../../mocks/server'
import { SubscriptionsDetail } from './subscriptions-detail'

const mockNavigate = vi.fn()

vi.mock('.', () => ({
  subscriptionsDetailRoute: { useParams: () => ({ id: '1' }) },
  subscriptionsListRoute: { useNavigate: () => mockNavigate },
}))

const plans = [
  { id: 'starter', name: 'Starter', features: [] },
  { id: 'pro', name: 'Pro', features: ['todos'] },
]

const mockSubscription = createSubscription({
  id: '1',
  userId: 'user-1',
  planId: 'pro',
  status: 'trialing',
  currentPeriodStart: '2026-01-01T12:00:00.000Z',
  currentPeriodEnd: '2026-02-01T12:00:00.000Z',
  trialEndsAt: '2026-01-15T12:00:00.000Z',
  canceledAt: '2026-01-20T12:00:00.000Z',
  pastDueSince: '2026-01-18T12:00:00.000Z',
  externalId: 'sub_123',
  createdAt: '2025-12-31T12:00:00.000Z',
})

const short = (iso: string) => formatDate(parseISO(iso), 'short')

function renderSubscriptionsDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div>Loading...</div>}>
            <SubscriptionsDetail />
          </Suspense>
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
    ),
    getSubscriptionsIdHandler(mockSubscription)
  )
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('SubscriptionsDetail', () => {
  it('renders the user id', async () => {
    renderSubscriptionsDetail()
    expect(await screen.findByText('user-1')).toBeInTheDocument()
  })

  it('renders the plan name from the catalog', async () => {
    renderSubscriptionsDetail()
    expect(await screen.findByText('Pro')).toBeInTheDocument()
  })

  it('falls back to the raw plan id for plans not in the catalog', async () => {
    server.use(
      getSubscriptionsIdHandler({ ...mockSubscription, planId: 'legacy' })
    )
    renderSubscriptionsDetail()
    expect(await screen.findByText('legacy')).toBeInTheDocument()
  })

  it.each([
    ['active', 'Active'],
    ['trialing', 'Trialing'],
    ['canceled', 'Canceled'],
    ['past_due', 'Past due'],
    ['expired', 'Expired'],
  ] as const)('renders the %s status badge', async (status, label) => {
    server.use(getSubscriptionsIdHandler({ ...mockSubscription, status }))
    renderSubscriptionsDetail()
    expect(await screen.findByText(label)).toBeInTheDocument()
  })

  it('renders the period and creation dates', async () => {
    renderSubscriptionsDetail()
    await screen.findByText('user-1')
    expect(
      screen.getByText(short(mockSubscription.currentPeriodStart))
    ).toBeInTheDocument()
    expect(
      screen.getByText(short(mockSubscription.currentPeriodEnd))
    ).toBeInTheDocument()
    expect(
      screen.getByText(short(mockSubscription.createdAt))
    ).toBeInTheDocument()
  })

  it('renders optional fields when they are set', async () => {
    renderSubscriptionsDetail()
    await screen.findByText('user-1')
    expect(screen.getByText('Trial ends')).toBeInTheDocument()
    expect(
      screen.getByText(short(mockSubscription.trialEndsAt!))
    ).toBeInTheDocument()
    expect(screen.getByText('Canceled at')).toBeInTheDocument()
    expect(
      screen.getByText(short(mockSubscription.canceledAt!))
    ).toBeInTheDocument()
    expect(screen.getByText('Past due since')).toBeInTheDocument()
    expect(
      screen.getByText(short(mockSubscription.pastDueSince!))
    ).toBeInTheDocument()
    expect(screen.getByText('External ID')).toBeInTheDocument()
    expect(screen.getByText('sub_123')).toBeInTheDocument()
  })

  it('hides optional fields when they are not set', async () => {
    server.use(
      getSubscriptionsIdHandler({
        ...mockSubscription,
        trialEndsAt: null,
        canceledAt: null,
        pastDueSince: null,
        externalId: null,
      })
    )
    renderSubscriptionsDetail()
    await screen.findByText('user-1')
    expect(screen.queryByText('Trial ends')).not.toBeInTheDocument()
    expect(screen.queryByText('Canceled at')).not.toBeInTheDocument()
    expect(screen.queryByText('Past due since')).not.toBeInTheDocument()
    expect(screen.queryByText('External ID')).not.toBeInTheDocument()
  })

  it('navigates back to the list when Back is clicked', async () => {
    renderSubscriptionsDetail()
    await screen.findByText('user-1')
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/subscriptions' })
  })
})
