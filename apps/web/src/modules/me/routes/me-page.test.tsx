import {
  createGetMe200,
  getMeHandler,
  getMeHandlerResponse200,
  getRegistrationStatusHandler,
  getRegistrationStatusHandlerResponse200,
  getSubscriptionStatusHandler,
  getSubscriptionStatusHandlerResponse200,
  patchMeEmailHandler,
  patchMeEmailHandlerResponse200,
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
  Notifications,
  notifications,
  type PageTabsProps,
} from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
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
    PageTabs: (props: PageTabsProps) => (
      <nav aria-label={props.label}>
        {props.tabs.map((tab) => (
          <a key={tab.to} href={tab.to}>
            {tab.label}
          </a>
        ))}
      </nav>
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
      <MantineEmotionProvider>
        <Notifications />
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div>Loading...</div>}>
            <MeAccount />
          </Suspense>
        </QueryClientProvider>
      </MantineEmotionProvider>
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
      <MantineEmotionProvider>
        <QueryClientProvider client={queryClient}>
          <MePage />
        </QueryClientProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

function mockSubscriptionsEnabled(enabled: boolean) {
  server.use(
    getSubscriptionStatusHandler(() =>
      getSubscriptionStatusHandlerResponse200({
        enabled,
        plans: [],
      })
    )
  )
}

beforeEach(() => {
  server.use(getMeHandler(mockProfile))
  mockListAccounts.mockResolvedValue({ data: [credentialAccount], error: null })
})

afterEach(() => {
  vi.clearAllMocks()
  // The store is global: notifications from one test would fill the next
  notifications.clean()
})

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
      screen.getByRole('heading', { name: 'Email address' })
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

describe('Email change', () => {
  async function submitEmailChange(fill: { password?: string } = {}) {
    const user = userEvent.setup()
    renderMeAccount()
    await user.type(
      await screen.findByLabelText(/New email/),
      'moved@example.com'
    )
    if (fill.password) {
      await user.type(screen.getByLabelText(/Current password/), fill.password)
    }
    await user.click(screen.getByRole('button', { name: 'Request change' }))
  }

  it('asks an account with a password for it, and sends it', async () => {
    let body: unknown
    server.use(
      patchMeEmailHandler(async ({ request }) => {
        body = await request.json()
        return patchMeEmailHandlerResponse200({
          message: 'ok',
          changed: false,
        })
      })
    )
    await submitEmailChange({ password: 'Password123!' })

    await screen.findByText('Check your inbox')
    expect(body).toEqual({
      newEmail: 'moved@example.com',
      currentPassword: 'Password123!',
    })
  })

  it('asks no password of a social-only account', async () => {
    mockListAccounts.mockResolvedValue({ data: [googleAccount], error: null })
    let body: unknown
    server.use(
      patchMeEmailHandler(async ({ request }) => {
        body = await request.json()
        return patchMeEmailHandlerResponse200({
          message: 'ok',
          changed: false,
        })
      })
    )
    await submitEmailChange()

    await screen.findByText('Check your inbox')
    expect(screen.queryByLabelText(/Current password/)).not.toBeInTheDocument()
    expect(body).toEqual({ newEmail: 'moved@example.com' })
  })

  it('explains a wrong password', async () => {
    server.use(
      patchMeEmailHandler(
        () =>
          new Response(
            JSON.stringify({
              message: 'Current password is incorrect',
              code: 'invalid_password',
            }),
            { status: 400 }
          )
      )
    )
    await submitEmailChange({ password: 'WrongPass!' })

    await screen.findByText('Current password is incorrect')
  })
})

describe('Email change without email (email.enabled: false)', () => {
  beforeEach(() => {
    server.use(
      getRegistrationStatusHandler(() =>
        getRegistrationStatusHandlerResponse200({
          open: false,
          providers: [],
          email: false,
        })
      )
    )
  })

  it('asks anyone but the admin to contact an administrator', async () => {
    const user = userEvent.setup()
    renderMeAccount()

    await user.click(
      await screen.findByRole('button', { name: 'Change email' })
    )

    expect(screen.queryByLabelText(/New email/)).not.toBeInTheDocument()
    expect(
      screen.getByText(
        'Only an administrator can change the email of your account.'
      )
    ).toBeInTheDocument()
    const dialog = await screen.findByRole('dialog', {
      name: 'Change your email',
    })
    expect(dialog).toHaveTextContent(
      'Ask your administrator to change the email of your account.'
    )
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
  })

  it('lets the admin change their email at once', async () => {
    const user = userEvent.setup()
    let currentEmail = 'test@example.com'
    let body: unknown
    server.use(
      getMeHandler(() =>
        getMeHandlerResponse200(
          createGetMe200({
            ...mockProfile,
            email: currentEmail,
            role: { id: 'admin', name: 'Admin', isAdmin: true },
          })
        )
      ),
      patchMeEmailHandler(async ({ request }) => {
        body = await request.json()
        currentEmail = 'moved@example.com'
        return patchMeEmailHandlerResponse200({
          message: 'Email address changed',
          changed: true,
        })
      })
    )
    renderMeAccount()

    await user.type(
      await screen.findByLabelText(/New email/),
      'moved@example.com'
    )
    await user.type(screen.getByLabelText(/Current password/), 'Password123!')
    await user.click(screen.getByRole('button', { name: 'Change email' }))

    await screen.findByText('Email updated')
    expect(body).toEqual({
      newEmail: 'moved@example.com',
      currentPassword: 'Password123!',
    })
    expect(await screen.findByDisplayValue('moved@example.com')).toBeDisabled()
    expect(screen.queryByText('Check your inbox')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/New email/)).toHaveValue('')
  })
})

describe('Password change — user with existing password', () => {
  it('submits password change and shows success', async () => {
    const user = userEvent.setup()

    server.use(
      patchMePasswordHandler(() => patchMePasswordHandlerResponse204())
    )

    renderMeSecurity()
    await screen.findByRole('button', { name: 'Change password' })
    const [currentPwdInput, newPwdInput, confirmPwdInput] =
      document.querySelectorAll('input[type="password"]')

    await user.type(currentPwdInput, 'Password123!')
    await user.type(newPwdInput, 'NewPass456!')
    await user.type(confirmPwdInput, 'NewPass456!')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    await screen.findByText('Password changed successfully')
  })

  it('shows error when current password is wrong', async () => {
    const user = userEvent.setup()

    server.use(
      patchMePasswordHandler(() =>
        patchMePasswordHandlerResponse400({
          message: 'Current password is incorrect',
          code: 'invalid_password',
        })
      )
    )

    renderMeSecurity()
    await screen.findByRole('button', { name: 'Change password' })
    const [currentPwdInput, newPwdInput, confirmPwdInput] =
      document.querySelectorAll('input[type="password"]')

    await user.type(currentPwdInput, 'WrongPass!')
    await user.type(newPwdInput, 'NewPass456!')
    await user.type(confirmPwdInput, 'NewPass456!')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    await screen.findByText('Current password is incorrect')
  })

  it('explains a lockout after too many wrong passwords', async () => {
    const user = userEvent.setup()
    server.use(
      patchMePasswordHandler(
        () =>
          new Response(
            JSON.stringify({
              message: 'Too many failed attempts.',
              code: 'too_many_attempts',
            }),
            { status: 429 }
          )
      )
    )

    renderMeSecurity()
    await screen.findByRole('button', { name: 'Change password' })
    const [currentPwdInput, newPwdInput, confirmPwdInput] =
      document.querySelectorAll('input[type="password"]')
    await user.type(currentPwdInput, 'Password123!')
    await user.type(newPwdInput, 'NewPass456!')
    await user.type(confirmPwdInput, 'NewPass456!')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    await screen.findByText(
      'Too many wrong passwords. Wait 15 minutes and try again.'
    )
  })

  it('shows validation error when passwords do not match', async () => {
    const user = userEvent.setup()
    renderMeSecurity()
    await screen.findByRole('button', { name: 'Change password' })
    const [currentPwdInput, newPwdInput, confirmPwdInput] =
      document.querySelectorAll('input[type="password"]')

    await user.type(currentPwdInput, 'Password123!')
    await user.type(newPwdInput, 'NewPass456!')
    await user.type(confirmPwdInput, 'Different!')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    await screen.findByText('Passwords do not match')
  })

  it('shows validation error when new password is too short', async () => {
    const user = userEvent.setup()
    renderMeSecurity()
    await screen.findByRole('button', { name: 'Change password' })
    const [currentPwdInput, newPwdInput, confirmPwdInput] =
      document.querySelectorAll('input[type="password"]')

    await user.type(currentPwdInput, 'Password123!')
    await user.type(newPwdInput, 'short')
    await user.type(confirmPwdInput, 'short')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

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
      screen.queryByRole('button', { name: 'Change password' })
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
