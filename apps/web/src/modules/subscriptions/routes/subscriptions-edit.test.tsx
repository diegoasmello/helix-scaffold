import {
  createSubscription,
  getSubscriptionsIdHandler,
  getSubscriptionStatusHandler,
  getSubscriptionStatusHandlerResponse200,
  patchSubscriptionsIdHandler,
  patchSubscriptionsIdHandlerResponse200,
} from '@helix/api-client/mocks'
import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import type { SubscriptionsFormProps } from '../components/subscriptions-form'
import type { UpdateSubscriptionInput } from '../types'
import { SubscriptionsEdit } from './subscriptions-edit'

const mockNavigate = vi.fn()

const mockNotify = vi.hoisted(() => vi.fn())

vi.mock('@helix/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@helix/ui')>()),
  notify: mockNotify,
}))

vi.mock('.', () => ({
  subscriptionsEditRoute: { useParams: () => ({ id: '1' }) },
  subscriptionsListRoute: { useNavigate: () => mockNavigate },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useBlocker: vi.fn() }
})

vi.mock('../components/subscriptions-form', () => ({
  SubscriptionsForm: ({ form, isEditing }: SubscriptionsFormProps) => (
    <div>
      {!isEditing && (
        <input
          placeholder="User ID"
          value={form.values.userId}
          onChange={(e) => form.setFieldValue('userId', e.target.value)}
        />
      )}
      <input
        placeholder="Select a plan"
        value={form.values.planId}
        onChange={(e) => form.setFieldValue('planId', e.target.value)}
      />
      {form.errors.planId && <span>{String(form.errors.planId)}</span>}
      <input
        placeholder="Period start"
        value={form.values.currentPeriodStart}
        onChange={(e) =>
          form.setFieldValue('currentPeriodStart', e.target.value)
        }
      />
      <input
        placeholder="Period end"
        value={form.values.currentPeriodEnd}
        onChange={(e) => form.setFieldValue('currentPeriodEnd', e.target.value)}
      />
      <input
        placeholder="Trial ends at"
        value={form.values.trialEndsAt ?? ''}
        onChange={(e) =>
          form.setFieldValue('trialEndsAt', e.target.value || null)
        }
      />
      <input
        placeholder="Payment processor subscription ID"
        value={form.values.externalId}
        onChange={(e) => form.setFieldValue('externalId', e.target.value)}
      />
    </div>
  ),
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
  canceledAt: null,
  externalId: 'sub_123',
})

function renderSubscriptionsEdit() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div>Loading...</div>}>
            <SubscriptionsEdit />
          </Suspense>
        </QueryClientProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

function capturePatch() {
  const captured: { body?: UpdateSubscriptionInput } = {}
  server.use(
    patchSubscriptionsIdHandler(async (info) => {
      captured.body = (await info.request.json()) as UpdateSubscriptionInput
      return patchSubscriptionsIdHandlerResponse200({
        ...mockSubscription,
        ...(captured.body as object),
      })
    })
  )
  return captured
}

beforeEach(() => {
  server.use(
    getSubscriptionStatusHandler(() =>
      getSubscriptionStatusHandlerResponse200({
        enabled: true,
        plans,
      })
    ),
    getSubscriptionsIdHandler(mockSubscription)
  )
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('SubscriptionsEdit', () => {
  it('renders the edit form heading', async () => {
    renderSubscriptionsEdit()
    expect(
      await screen.findByRole('heading', { name: 'Edit Subscription' })
    ).toBeInTheDocument()
  })

  it('renders form pre-populated with item data, dates as YYYY-MM-DD', async () => {
    renderSubscriptionsEdit()
    expect(await screen.findByDisplayValue('pro')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Period start')).toHaveValue(
      '2026-01-01'
    )
    expect(screen.getByPlaceholderText('Period end')).toHaveValue('2026-02-01')
    expect(screen.getByPlaceholderText('Trial ends at')).toHaveValue(
      '2026-01-15'
    )
    expect(screen.getByDisplayValue('sub_123')).toBeInTheDocument()
  })

  it('renders the form in editing mode (no user field)', async () => {
    renderSubscriptionsEdit()
    await screen.findByDisplayValue('pro')
    expect(screen.queryByPlaceholderText('User ID')).not.toBeInTheDocument()
  })

  it('shows validation error when plan is cleared and form is submitted', async () => {
    renderSubscriptionsEdit()
    await screen.findByDisplayValue('pro')
    await userEvent.clear(screen.getByPlaceholderText('Select a plan'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Required')).toBeInTheDocument()
  })

  it('calls PATCH /subscriptions/:id with updated payload and navigates on success', async () => {
    const captured = capturePatch()

    renderSubscriptionsEdit()
    await screen.findByDisplayValue('pro')
    await userEvent.clear(screen.getByPlaceholderText('Select a plan'))
    await userEvent.type(
      screen.getByPlaceholderText('Select a plan'),
      'starter'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(captured.body).toEqual({
        planId: 'starter',
        status: 'trialing',
        currentPeriodStart: '2026-01-01',
        currentPeriodEnd: '2026-02-01',
        trialEndsAt: '2026-01-15',
        externalId: 'sub_123',
      })
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/subscriptions' })
    })
  })

  it('sends null for cleared optional fields', async () => {
    const captured = capturePatch()

    renderSubscriptionsEdit()
    await screen.findByDisplayValue('pro')
    await userEvent.clear(screen.getByPlaceholderText('Trial ends at'))
    await userEvent.clear(
      screen.getByPlaceholderText('Payment processor subscription ID')
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(captured.body).toMatchObject({
        trialEndsAt: null,
        externalId: null,
      })
    )
  })

  it('navigates back to the list when Cancel is clicked', async () => {
    renderSubscriptionsEdit()
    await screen.findByDisplayValue('pro')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/subscriptions' })
  })

  it('does not navigate when API returns error', async () => {
    server.use(
      patchSubscriptionsIdHandler(
        () =>
          new Response(JSON.stringify({ message: 'Server error' }), {
            status: 500,
          })
      )
    )

    renderSubscriptionsEdit()
    await screen.findByDisplayValue('pro')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    )
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockNotify).toHaveBeenCalledWith({
      status: 'danger',
      message: 'Failed to update subscription',
    })
  })

  it('explains a 409 when the user already has a live subscription', async () => {
    server.use(
      patchSubscriptionsIdHandler(
        () =>
          new Response(
            JSON.stringify({
              message: 'User already has an active or trialing subscription',
              code: 'live_subscription_exists',
            }),
            { status: 409 }
          )
      )
    )

    renderSubscriptionsEdit()
    await screen.findByDisplayValue('pro')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith({
        status: 'danger',
        message:
          'This user already has an active or trialing subscription. Cancel it or change its plan instead.',
      })
    )
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
