import {
  createSubscription,
  getSubscriptionStatusHandler,
  getSubscriptionStatusHandlerResponse200,
  postSubscriptionsHandler,
  postSubscriptionsHandlerResponse201,
} from '@helix/api-client/mocks'
import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import type { SubscriptionsFormProps } from '../components/subscriptions-form'
import type { CreateSubscriptionInput } from '../types'
import { SubscriptionsCreate } from './subscriptions-create'

const mockNavigate = vi.fn()

const mockNotify = vi.hoisted(() => vi.fn())

vi.mock('@helix/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@helix/ui')>()),
  notify: mockNotify,
}))

vi.mock('.', () => ({
  subscriptionsListRoute: { useNavigate: () => mockNavigate },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useBlocker: vi.fn() }
})

vi.mock('../components/subscriptions-form', () => ({
  SubscriptionsForm: ({ form, plans, isEditing }: SubscriptionsFormProps) => (
    <div>
      {!isEditing && (
        <input
          placeholder="User ID"
          value={form.values.userId}
          onChange={(e) => form.setFieldValue('userId', e.target.value)}
        />
      )}
      {form.errors.userId && <span>{String(form.errors.userId)}</span>}
      <input
        placeholder="Select a plan"
        value={form.values.planId}
        onChange={(e) => form.setFieldValue('planId', e.target.value)}
      />
      {form.errors.planId && <span>{String(form.errors.planId)}</span>}
      <input
        placeholder="Payment processor subscription ID"
        value={form.values.externalId}
        onChange={(e) => form.setFieldValue('externalId', e.target.value)}
      />
      <span data-testid="plans">{plans.map((p) => p.name).join(',')}</span>
    </div>
  ),
}))

const plans = [
  { id: 'starter', name: 'Starter', features: [] },
  { id: 'pro', name: 'Pro', features: ['todos'] },
]

function renderSubscriptionsCreate() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div>Loading...</div>}>
            <SubscriptionsCreate />
          </Suspense>
        </QueryClientProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

async function fillRequiredFields() {
  await userEvent.type(screen.getByPlaceholderText('User ID'), 'user-1')
  await userEvent.type(screen.getByPlaceholderText('Select a plan'), 'pro')
}

beforeEach(() => {
  server.use(
    getSubscriptionStatusHandler(() =>
      getSubscriptionStatusHandlerResponse200({ enabled: true, plans })
    ),
    postSubscriptionsHandler(async (info) => {
      const body = (await info.request.json()) as CreateSubscriptionInput
      return postSubscriptionsHandlerResponse201(
        createSubscription({ ...(body as object), id: '99' })
      )
    })
  )
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('SubscriptionsCreate', () => {
  it('renders the create form heading', async () => {
    renderSubscriptionsCreate()
    expect(
      await screen.findByRole('heading', { name: 'Create Subscription' })
    ).toBeInTheDocument()
  })

  it('passes the plan catalog to the form', async () => {
    renderSubscriptionsCreate()
    await waitFor(() =>
      expect(screen.getByTestId('plans')).toHaveTextContent('Starter,Pro')
    )
  })

  it('shows validation errors when submitting empty form', async () => {
    renderSubscriptionsCreate()
    await screen.findByRole('heading', { name: 'Create Subscription' })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const errors = await screen.findAllByText('Required')
    expect(errors).toHaveLength(2)
  })

  it('calls POST /subscriptions with defaults and navigates on success', async () => {
    let capturedBody: CreateSubscriptionInput | undefined
    server.use(
      postSubscriptionsHandler(async (info) => {
        capturedBody = (await info.request.json()) as CreateSubscriptionInput
        return postSubscriptionsHandlerResponse201(
          createSubscription({ ...(capturedBody as object), id: '99' })
        )
      })
    )

    renderSubscriptionsCreate()
    await screen.findByRole('heading', { name: 'Create Subscription' })
    await fillRequiredFields()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(capturedBody).toMatchObject({
        userId: 'user-1',
        planId: 'pro',
        status: 'active',
        trialEndsAt: null,
      })
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/subscriptions' })
    })
    // Default period: today → today + 30 days, as YYYY-MM-DD.
    const start = new Date(capturedBody!.currentPeriodStart as string)
    const end = new Date(capturedBody!.currentPeriodEnd as string)
    expect(capturedBody!.currentPeriodStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(capturedBody!.currentPeriodEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect((end.getTime() - start.getTime()) / 86_400_000).toBe(30)
    // Empty externalId is omitted, not sent as ''.
    expect(capturedBody).not.toHaveProperty('externalId')
  })

  it('sends externalId when filled', async () => {
    let capturedBody: CreateSubscriptionInput | undefined
    server.use(
      postSubscriptionsHandler(async (info) => {
        capturedBody = (await info.request.json()) as CreateSubscriptionInput
        return postSubscriptionsHandlerResponse201(
          createSubscription({ ...(capturedBody as object), id: '99' })
        )
      })
    )

    renderSubscriptionsCreate()
    await screen.findByRole('heading', { name: 'Create Subscription' })
    await fillRequiredFields()
    await userEvent.type(
      screen.getByPlaceholderText('Payment processor subscription ID'),
      'sub_123'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(capturedBody).toMatchObject({ externalId: 'sub_123' })
    )
  })

  it('navigates back to the list when Cancel is clicked', async () => {
    renderSubscriptionsCreate()
    await screen.findByRole('heading', { name: 'Create Subscription' })
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/subscriptions' })
  })

  it('does not navigate when API returns error', async () => {
    server.use(
      postSubscriptionsHandler(
        () =>
          new Response(JSON.stringify({ message: 'Server error' }), {
            status: 500,
          })
      )
    )

    renderSubscriptionsCreate()
    await screen.findByRole('heading', { name: 'Create Subscription' })
    await fillRequiredFields()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    )
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockNotify).toHaveBeenCalledWith({
      status: 'danger',
      message: 'Failed to create subscription',
    })
  })

  it('explains a 409 when the user already has a live subscription', async () => {
    server.use(
      postSubscriptionsHandler(
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

    renderSubscriptionsCreate()
    await screen.findByRole('heading', { name: 'Create Subscription' })
    await fillRequiredFields()
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
