import {
  createGetMe200,
  getMeHandler,
  getSubscriptionStatusHandler,
  getSubscriptionStatusHandlerResponse200,
  patchMeHandler,
  patchMeHandlerResponse200,
  patchMePasswordHandler,
  patchMePasswordHandlerResponse204,
  patchMePasswordHandlerResponse400,
  postMeSetPasswordHandler,
  postMeSetPasswordHandlerResponse204,
} from '@helix/api-client/mocks'
import {
  MantineEmotionProvider,
  MantineProvider,
  type NavigationItemProps,
  Notifications,
} from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import type { LinkedAccount } from '../types'
import { MeAccount } from './me-account'
import { MePage } from './me-page'
import { MeSecurity } from './me-security'

const { mockListAccounts } = vi.hoisted(() => ({
  mockListAccounts: vi.fn(),
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
          roleId: null,
        },
      },
      isPending: false,
    }),
    listAccounts: mockListAccounts,
  },
}))

// MePage renders <Outlet /> and NavigationItem (a router Link), both of which
// need a RouterProvider. Stub them; MeAccount and MeSecurity use neither.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, Outlet: () => <div data-testid="outlet" /> }
})

vi.mock('@helix/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@helix/ui')>()
  return {
    ...actual,
    NavigationItem: (props: NavigationItemProps) => (
      <a href={props.to}>{props.label}</a>
    ),
  }
})

const credentialAccount: LinkedAccount = {
  id: 'acc-cred',
  providerId: 'credential',
  accountId: 'test@example.com',
  createdAt: new Date('2026-01-10'),
}

const googleAccount: LinkedAccount = {
  id: 'acc-google',
  providerId: 'google',
  accountId: 'google-123',
  createdAt: new Date('2026-01-15'),
}

const mockProfile = createGetMe200({
  id: 'test-user',
  name: 'Test User',
  email: 'test@example.com',
  roleId: null,
  emailVerified: true,
})

function renderMeAccount() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<div>Loading...</div>}>
          <MeAccount />
        </Suspense>
      </QueryClientProvider>
    </MantineProvider>
  )
}

function renderMeSecurity() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <Notifications />
        <QueryClientProvider client={queryClient}>
          <MeSecurity />
        </QueryClientProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

function renderMePage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <MePage />
      </QueryClientProvider>
    </MantineProvider>
  )
}

function mockSubscriptionsEnabled(enabled: boolean) {
  server.use(
    getSubscriptionStatusHandler(() =>
      getSubscriptionStatusHandlerResponse200({ enabled, plans: [] })
    )
  )
}

beforeEach(() => {
  server.use(getMeHandler(mockProfile))
  mockListAccounts.mockResolvedValue({ data: [credentialAccount], error: null })
})

afterEach(() => vi.clearAllMocks())

describe('MePage layout', () => {
  it('renders the page title and the outlet', async () => {
    renderMePage()
    expect(
      screen.getByRole('heading', { name: 'Account settings' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('outlet')).toBeInTheDocument()
  })

  it('links to every sub-page', () => {
    renderMePage()
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute(
      'href',
      '/me/account'
    )
    expect(screen.getByRole('link', { name: 'Security' })).toHaveAttribute(
      'href',
      '/me/security'
    )
    expect(screen.getByRole('link', { name: 'Preferences' })).toHaveAttribute(
      'href',
      '/me/preferences'
    )
  })

  it('shows the Subscription link when subscriptions are enabled', async () => {
    mockSubscriptionsEnabled(true)
    renderMePage()
    expect(
      await screen.findByRole('link', { name: 'Subscription' })
    ).toHaveAttribute('href', '/me/subscription')
  })

  it('hides the Subscription link when subscriptions are disabled', async () => {
    let statusRequested = false
    server.use(
      getSubscriptionStatusHandler(() => {
        statusRequested = true
        return getSubscriptionStatusHandlerResponse200({
          enabled: false,
          plans: [],
        })
      })
    )
    renderMePage()
    await waitFor(() => expect(statusRequested).toBe(true))
    // Let the status response render before asserting absence.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(
      screen.queryByRole('link', { name: 'Subscription' })
    ).not.toBeInTheDocument()
  })
})

describe('Profile display', () => {
  it('renders the name and email sections', async () => {
    renderMeAccount()
    await screen.findByRole('heading', { name: 'Name' })
    expect(
      screen.getByRole('heading', { name: 'Email Address' })
    ).toBeInTheDocument()
  })

  it('pre-populates form fields with user data', async () => {
    renderMeAccount()
    const nameInput = await screen.findByDisplayValue('Test User')
    const emailInput = screen.getByDisplayValue('test@example.com')
    expect(nameInput).toBeInTheDocument()
    expect(emailInput).toBeInTheDocument()
  })
})

describe('Profile update', () => {
  it('submits updated name and shows success', async () => {
    const user = userEvent.setup()
    const updatedProfile = { ...mockProfile, name: 'New Name' }

    server.use(patchMeHandler(() => patchMeHandlerResponse200(updatedProfile)))

    renderMeAccount()
    const nameInput = await screen.findByDisplayValue('Test User')
    await user.clear(nameInput)
    await user.type(nameInput, 'New Name')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Name updated successfully')
  })

  it('shows validation error when name is empty', async () => {
    const user = userEvent.setup()
    renderMeAccount()
    const nameInput = await screen.findByDisplayValue('Test User')
    await user.clear(nameInput)
    const form = nameInput.closest('form')!
    fireEvent.submit(form)

    await screen.findByText('Required')
  })
})

describe('Password change — user with existing password', () => {
  it('submits password change and shows success', async () => {
    const user = userEvent.setup()

    server.use(
      patchMePasswordHandler(() => patchMePasswordHandlerResponse204())
    )

    renderMeSecurity()
    await screen.findByRole('button', { name: 'Change Password' })
    const [currentPwdInput, newPwdInput, confirmPwdInput] =
      document.querySelectorAll('input[type="password"]')

    await user.type(currentPwdInput, 'Password123!')
    await user.type(newPwdInput, 'NewPass456!')
    await user.type(confirmPwdInput, 'NewPass456!')
    await user.click(screen.getByRole('button', { name: 'Change Password' }))

    await screen.findByText('Password changed successfully')
  })

  it('shows error when current password is wrong', async () => {
    const user = userEvent.setup()

    server.use(
      patchMePasswordHandler(() =>
        patchMePasswordHandlerResponse400({
          message: 'Current password is incorrect',
        })
      )
    )

    renderMeSecurity()
    await screen.findByRole('button', { name: 'Change Password' })
    const [currentPwdInput, newPwdInput, confirmPwdInput] =
      document.querySelectorAll('input[type="password"]')

    await user.type(currentPwdInput, 'WrongPass!')
    await user.type(newPwdInput, 'NewPass456!')
    await user.type(confirmPwdInput, 'NewPass456!')
    await user.click(screen.getByRole('button', { name: 'Change Password' }))

    await screen.findByText('Current password is incorrect')
  })

  it('shows validation error when passwords do not match', async () => {
    const user = userEvent.setup()
    renderMeSecurity()
    await screen.findByRole('button', { name: 'Change Password' })
    const [currentPwdInput, newPwdInput, confirmPwdInput] =
      document.querySelectorAll('input[type="password"]')

    await user.type(currentPwdInput, 'Password123!')
    await user.type(newPwdInput, 'NewPass456!')
    await user.type(confirmPwdInput, 'Different!')
    await user.click(screen.getByRole('button', { name: 'Change Password' }))

    await screen.findByText('Passwords do not match')
  })

  it('shows validation error when new password is too short', async () => {
    const user = userEvent.setup()
    renderMeSecurity()
    await screen.findByRole('button', { name: 'Change Password' })
    const [currentPwdInput, newPwdInput, confirmPwdInput] =
      document.querySelectorAll('input[type="password"]')

    await user.type(currentPwdInput, 'Password123!')
    await user.type(newPwdInput, 'short')
    await user.type(confirmPwdInput, 'short')
    await user.click(screen.getByRole('button', { name: 'Change Password' }))

    await screen.findByText('Min 8 characters')
  })
})

describe('Password setup — social-only user', () => {
  beforeEach(() => {
    mockListAccounts.mockResolvedValue({ data: [googleAccount], error: null })
  })

  it('shows set-password form instead of change-password form', async () => {
    renderMeSecurity()
    expect(
      await screen.findByRole('button', { name: /set password/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Change Password' })
    ).not.toBeInTheDocument()
  })

  it('blocks submission when passwords do not match', async () => {
    const user = userEvent.setup()
    renderMeSecurity()
    await screen.findByRole('button', { name: /set password/i })
    const [newPwdInput, confirmPwdInput] = document.querySelectorAll(
      'input[type="password"]'
    )

    await user.type(newPwdInput, 'Password123!')
    await user.type(confirmPwdInput, 'Different456!')
    await user.click(screen.getByRole('button', { name: /set password/i }))

    expect(
      await screen.findByText('Passwords do not match')
    ).toBeInTheDocument()
  })

  it('submits with correct newPassword and shows success notification', async () => {
    const user = userEvent.setup()
    let capturedBody: unknown

    server.use(
      postMeSetPasswordHandler(async (info) => {
        capturedBody = await info.request.json()
        return postMeSetPasswordHandlerResponse204()
      })
    )

    renderMeSecurity()
    await screen.findByRole('button', { name: /set password/i })
    const [newPwdInput, confirmPwdInput] = document.querySelectorAll(
      'input[type="password"]'
    )

    await user.type(newPwdInput, 'Password123!')
    await user.type(confirmPwdInput, 'Password123!')
    await user.click(screen.getByRole('button', { name: /set password/i }))

    await screen.findByText('Password set successfully')
    expect(capturedBody).toEqual({ newPassword: 'Password123!' })
  })

  it('shows error notification when set-password fails', async () => {
    const user = userEvent.setup()

    server.use(
      postMeSetPasswordHandler(
        () =>
          new Response(JSON.stringify({ message: 'Server error' }), {
            status: 500,
          })
      )
    )

    renderMeSecurity()
    await screen.findByRole('button', { name: /set password/i })
    const [newPwdInput, confirmPwdInput] = document.querySelectorAll(
      'input[type="password"]'
    )

    await user.type(newPwdInput, 'Password123!')
    await user.type(confirmPwdInput, 'Password123!')
    await user.click(screen.getByRole('button', { name: /set password/i }))

    await screen.findByText('Failed to set password')
  })
})
