import {
  createPaginatedSubscriptions,
  createSubscription,
  deleteSubscriptionsIdHandler,
  deleteSubscriptionsIdHandlerResponse204,
  getMePermissionsHandler,
  getSubscriptionsHandler,
  getSubscriptionStatusHandler,
  getSubscriptionStatusHandlerResponse200,
} from '@helix/api-client/mocks'
import {
  MantineEmotionProvider,
  MantineProvider,
  ModalsProvider,
} from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import type { SubscriptionItem } from '../types'
import { SubscriptionsList } from './subscriptions-list'

const mockNavigate = vi.fn()

vi.mock('.', () => ({
  subscriptionsListRoute: {
    useNavigate: () => mockNavigate,
    useSearch: () => ({ page: 1, pageSize: 10, sortOrder: 'desc' }),
  },
}))

vi.mock('../../../lib/authentication', () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: {
          id: 'test-user',
          name: 'Test User',
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
  { id: 'pro', name: 'Pro', features: ['todos'] },
]

const mockSubscriptions = [
  createSubscription({
    id: '1',
    userId: 'user-alice',
    planId: 'pro',
    status: 'active',
  }),
  createSubscription({
    id: '2',
    userId: 'user-bob',
    planId: 'legacy',
    status: 'canceled',
  }),
]

function mockList(data: SubscriptionItem[]) {
  server.use(
    getSubscriptionsHandler(
      createPaginatedSubscriptions({
        data,
        total: data.length,
        page: 1,
        pageSize: 10,
        totalPages: data.length > 0 ? 1 : 0,
      })
    )
  )
}

function renderSubscriptionsList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <ModalsProvider>
          <QueryClientProvider client={queryClient}>
            <Suspense fallback={<div>Loading...</div>}>
              <SubscriptionsList />
            </Suspense>
          </QueryClientProvider>
        </ModalsProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

function getRow(text: string) {
  return screen
    .getAllByRole('row')
    .find((row) => within(row).queryByText(text))!
}

beforeEach(() => {
  mockList(mockSubscriptions)
  server.use(
    getSubscriptionStatusHandler(() =>
      getSubscriptionStatusHandlerResponse200({
        enabled: true,
        plans,
      })
    ),
    getMePermissionsHandler({
      grants: { subscriptions: ['view', 'create', 'edit', 'delete'] },
    })
  )
})

afterEach(() => vi.clearAllMocks())

describe('SubscriptionsList', () => {
  it('renders all subscriptions', async () => {
    renderSubscriptionsList()
    expect(await screen.findByText('user-alice')).toBeInTheDocument()
    expect(screen.getByText('user-bob')).toBeInTheDocument()
  })

  it('shows the plan name from the catalog', async () => {
    renderSubscriptionsList()
    await screen.findByText('user-alice')
    await waitFor(() =>
      expect(within(getRow('user-alice')).getByText('Pro')).toBeInTheDocument()
    )
  })

  it('falls back to the raw plan id for plans not in the catalog', async () => {
    renderSubscriptionsList()
    await screen.findByText('user-bob')
    expect(within(getRow('user-bob')).getByText('legacy')).toBeInTheDocument()
  })

  it('shows the status badge for each subscription', async () => {
    renderSubscriptionsList()
    await screen.findByText('user-alice')
    expect(within(getRow('user-alice')).getByText('Active')).toBeInTheDocument()
    expect(within(getRow('user-bob')).getByText('Canceled')).toBeInTheDocument()
  })

  it('navigates to the detail screen when View is clicked', async () => {
    renderSubscriptionsList()
    const viewButtons = await screen.findAllByRole('button', { name: 'View' })
    await userEvent.click(viewButtons[0])
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/subscriptions/$id',
      params: { id: '1' },
    })
  })

  it('navigates to the edit screen when Edit is clicked', async () => {
    renderSubscriptionsList()
    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await userEvent.click(editButtons[0])
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/subscriptions/$id/edit',
      params: { id: '1' },
    })
  })

  it('navigates to the create screen when Create is clicked', async () => {
    renderSubscriptionsList()
    await userEvent.click(await screen.findByRole('button', { name: 'Create' }))
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/subscriptions/create' })
  })

  it('opens delete modal when delete button is clicked', async () => {
    renderSubscriptionsList()
    const deleteButtons = await screen.findAllByRole('button', {
      name: 'Delete',
    })
    await userEvent.click(deleteButtons[0])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Delete subscription')).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        'Are you sure you want to delete this subscription? This action cannot be undone.'
      )
    ).toBeInTheDocument()
  })

  it('calls DELETE endpoint on confirm', async () => {
    let deletedId: string | undefined
    server.use(
      deleteSubscriptionsIdHandler(({ params }) => {
        deletedId = params.id as string
        return deleteSubscriptionsIdHandlerResponse204()
      })
    )
    renderSubscriptionsList()
    const deleteButtons = await screen.findAllByRole('button', {
      name: 'Delete',
    })
    await userEvent.click(deleteButtons[0])
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' })
    )
    await waitFor(() => expect(deletedId).toBe('1'))
  })

  it('closes delete modal on cancel without calling DELETE', async () => {
    let deleteCalled = false
    server.use(
      deleteSubscriptionsIdHandler(() => {
        deleteCalled = true
        return deleteSubscriptionsIdHandlerResponse204()
      })
    )
    renderSubscriptionsList()
    const deleteButtons = await screen.findAllByRole('button', {
      name: 'Delete',
    })
    await userEvent.click(deleteButtons[0])
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' })
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(deleteCalled).toBe(false)
  })

  it('hides Edit and Delete when user lacks permissions', async () => {
    server.use(
      getMePermissionsHandler({ grants: { subscriptions: ['view', 'create'] } })
    )
    renderSubscriptionsList()
    // Create is permission-gated too: once it shows, permissions have resolved.
    await screen.findByRole('button', { name: 'Create' })
    expect(screen.getAllByRole('button', { name: 'View' })).toHaveLength(2)
    expect(
      screen.queryByRole('button', { name: 'Edit' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Delete' })
    ).not.toBeInTheDocument()
  })

  describe('empty state', () => {
    beforeEach(() => mockList([]))

    it('renders the empty state when there are no subscriptions', async () => {
      renderSubscriptionsList()
      expect(
        await screen.findByText('No subscriptions yet')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Create a subscription to grant a user access.')
      ).toBeInTheDocument()
    })

    it('navigates to the create screen from the empty state', async () => {
      renderSubscriptionsList()
      await userEvent.click(
        await screen.findByRole('button', { name: 'Create first subscription' })
      )
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/subscriptions/create' })
    })

    it('hides the create button when user lacks create permission', async () => {
      server.use(
        getMePermissionsHandler({ grants: { subscriptions: ['view'] } })
      )
      renderSubscriptionsList()
      await screen.findByText('No subscriptions yet')
      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: 'Create first subscription' })
        ).not.toBeInTheDocument()
      )
    })
  })
})
