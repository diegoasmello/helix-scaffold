import {
  getMeProvidersHandler,
  getMeProvidersHandlerResponse200,
  postMeSetPasswordHandler,
  postMeSetPasswordHandlerResponse204,
} from '@helix/api-client/mocks'
import {
  MantineEmotionProvider,
  MantineProvider,
  Notifications,
} from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import type { LinkedAccount } from '../types'
import { MeSignIn } from './me-sign-in'

const { mockListAccounts, mockLinkSocial } = vi.hoisted(() => ({
  mockListAccounts: vi.fn(),
  mockLinkSocial: vi.fn(),
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
    linkSocial: mockLinkSocial,
  },
}))

const googleAccount: LinkedAccount = {
  id: 'acc-google',
  providerId: 'google',
  accountId: 'google-123',
  createdAt: new Date('2026-01-15'),
}

const credentialAccount: LinkedAccount = {
  id: 'acc-cred',
  providerId: 'credential',
  accountId: 'test@example.com',
  createdAt: new Date('2026-01-10'),
}

function renderMeSignIn() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <Notifications />
        <QueryClientProvider client={queryClient}>
          <MeSignIn />
        </QueryClientProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  mockListAccounts.mockResolvedValue({ data: [], error: null })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('Connected accounts section', () => {
  it('renders linked social provider with icon and date', async () => {
    mockListAccounts.mockResolvedValue({
      data: [googleAccount],
      error: null,
    })
    renderMeSignIn()
    expect(await screen.findByText('Google')).toBeInTheDocument()
    // "Connected on {date}" is shown below each provider name
    expect(screen.getByText(/connected on january/i)).toBeInTheDocument()
  })

  it('renders credential account as "Email & Password"', async () => {
    mockListAccounts.mockResolvedValue({
      data: [credentialAccount],
      error: null,
    })
    renderMeSignIn()
    expect(await screen.findByText('Email & Password')).toBeInTheDocument()
  })

  it('renders unknown provider with its raw id', async () => {
    const unknownAccount: LinkedAccount = {
      id: 'acc-unknown',
      providerId: 'github',
      accountId: 'gh-99',
      createdAt: new Date('2026-02-01'),
    }
    mockListAccounts.mockResolvedValue({
      data: [unknownAccount],
      error: null,
    })
    renderMeSignIn()
    expect(await screen.findByText('github')).toBeInTheDocument()
  })

  it('shows all linked accounts', async () => {
    mockListAccounts.mockResolvedValue({
      data: [googleAccount, credentialAccount],
      error: null,
    })
    renderMeSignIn()
    expect(await screen.findByText('Google')).toBeInTheDocument()
    expect(screen.getByText('Email & Password')).toBeInTheDocument()
  })
})

describe('Password section — social-only user (no credential account)', () => {
  beforeEach(() => {
    mockListAccounts.mockResolvedValue({
      data: [googleAccount],
      error: null,
    })
  })

  it('shows the set-password form', async () => {
    renderMeSignIn()
    expect(
      await screen.findByRole('button', { name: /set password/i })
    ).toBeInTheDocument()
  })

  it('does not show the "password is set" alert', async () => {
    renderMeSignIn()
    await screen.findByRole('button', { name: /set password/i })
    expect(
      screen.queryByText(/your account has a password set/i)
    ).not.toBeInTheDocument()
  })

  it('blocks submission when passwords do not match', async () => {
    const user = userEvent.setup()
    renderMeSignIn()
    await screen.findByRole('button', { name: /set password/i })

    const [newPwd, confirmPwd] = document.querySelectorAll(
      'input[type="password"]'
    )
    await user.type(newPwd, 'Password123!')
    await user.type(confirmPwd, 'Different456!')
    await user.click(screen.getByRole('button', { name: /set password/i }))

    expect(
      await screen.findByText('Passwords do not match')
    ).toBeInTheDocument()
  })

  it('blocks submission when password is too short', async () => {
    const user = userEvent.setup()
    renderMeSignIn()
    await screen.findByRole('button', { name: /set password/i })

    const [newPwd, confirmPwd] = document.querySelectorAll(
      'input[type="password"]'
    )
    await user.type(newPwd, 'short')
    await user.type(confirmPwd, 'short')
    await user.click(screen.getByRole('button', { name: /set password/i }))

    expect(await screen.findByText('Min 8 characters')).toBeInTheDocument()
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

    renderMeSignIn()
    await screen.findByRole('button', { name: /set password/i })

    const [newPwd, confirmPwd] = document.querySelectorAll(
      'input[type="password"]'
    )
    await user.type(newPwd, 'Password123!')
    await user.type(confirmPwd, 'Password123!')
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

    renderMeSignIn()
    await screen.findByRole('button', { name: /set password/i })

    const [newPwd, confirmPwd] = document.querySelectorAll(
      'input[type="password"]'
    )
    await user.type(newPwd, 'Password123!')
    await user.type(confirmPwd, 'Password123!')
    await user.click(screen.getByRole('button', { name: /set password/i }))

    await screen.findByText('Failed to set password')
  })
})

describe('Password section — user with credential account', () => {
  beforeEach(() => {
    mockListAccounts.mockResolvedValue({
      data: [credentialAccount],
      error: null,
    })
  })

  it('shows the "password is set" alert with a link to Security', async () => {
    renderMeSignIn()
    expect(
      await screen.findByText(/your account has a password set/i)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /change password/i })
    ).toHaveAttribute('href', '/me/security')
  })

  it('does not show the set-password form', async () => {
    renderMeSignIn()
    await screen.findByText(/your account has a password set/i)
    expect(
      screen.queryByRole('button', { name: /set password/i })
    ).not.toBeInTheDocument()
  })
})

describe('Link another account section', () => {
  beforeEach(() => {
    mockListAccounts.mockResolvedValue({
      data: [credentialAccount],
      error: null,
    })
  })

  it('does not show the section when no providers are configured', async () => {
    // default handler already returns providers: []
    renderMeSignIn()
    await screen.findByText('Email & Password')
    // waitFor ensures both queries (accounts + providers) have settled before asserting absence
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: /link another account/i })
      ).not.toBeInTheDocument()
    )
  })

  it('shows Connect button for each unlinked configured provider', async () => {
    server.use(
      getMeProvidersHandler(() =>
        getMeProvidersHandlerResponse200({ providers: ['google', 'facebook'] })
      )
    )
    renderMeSignIn()
    const connectButtons = await screen.findAllByRole('button', {
      name: /connect/i,
    })
    expect(connectButtons).toHaveLength(2)
  })

  it('does not show Connect button for already linked providers', async () => {
    mockListAccounts.mockResolvedValue({
      data: [credentialAccount, googleAccount],
      error: null,
    })
    server.use(
      getMeProvidersHandler(() =>
        getMeProvidersHandlerResponse200({ providers: ['google', 'facebook'] })
      )
    )
    renderMeSignIn()
    // Google is linked, only Facebook should have a Connect button.
    // findAllByRole waits for the providers query to resolve before asserting.
    const connectButtons = await screen.findAllByRole('button', {
      name: /connect/i,
    })
    expect(connectButtons).toHaveLength(1)
    expect(within(connectButtons[0]).getByText(/connect/i)).toBeInTheDocument()
    expect(screen.getByText('Facebook')).toBeInTheDocument()
    // Google's Connect button must not be present
    expect(
      screen.queryByRole('button', { name: /connect.*google/i })
    ).not.toBeInTheDocument()
  })

  it('calls linkSocial with correct provider and callbackURL on Connect click', async () => {
    mockLinkSocial.mockResolvedValue({})
    server.use(
      getMeProvidersHandler(() =>
        getMeProvidersHandlerResponse200({ providers: ['google'] })
      )
    )
    renderMeSignIn()

    await userEvent.click(
      await screen.findByRole('button', { name: /connect/i })
    )

    expect(mockLinkSocial).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: window.location.origin + '/me/sign-in',
    })
  })

  it('shows error notification when linkSocial throws', async () => {
    mockLinkSocial.mockRejectedValue(new Error('Network error'))
    server.use(
      getMeProvidersHandler(() =>
        getMeProvidersHandlerResponse200({ providers: ['google'] })
      )
    )
    renderMeSignIn()

    await userEvent.click(
      await screen.findByRole('button', { name: /connect/i })
    )

    expect(
      await screen.findByText(/could not link this account/i)
    ).toBeInTheDocument()
  })
})

describe('Error states', () => {
  it('shows error alert when listAccounts fails', async () => {
    mockListAccounts.mockResolvedValue({
      data: null,
      error: { message: 'Unauthorized' },
    })
    renderMeSignIn()
    expect(
      await screen.findByText(/could not load your connected accounts/i)
    ).toBeInTheDocument()
    // password section should not render when accounts are unknown
    expect(
      screen.queryByRole('button', { name: /set password/i })
    ).not.toBeInTheDocument()
  })

  it('hides the link section when getMeProviders fails', async () => {
    mockListAccounts.mockResolvedValue({ data: [googleAccount], error: null })
    server.use(
      getMeProvidersHandler(
        () =>
          new Response(JSON.stringify({ message: 'Server error' }), {
            status: 500,
          })
      )
    )
    renderMeSignIn()
    await screen.findByText('Google')
    // Section is absent when providers query fails (soft failure)
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: /link another account/i })
      ).not.toBeInTheDocument()
    )
  })
})

describe('Password section with both social and credential accounts', () => {
  it('shows "password is set" when user has both Google and credential', async () => {
    mockListAccounts.mockResolvedValue({
      data: [googleAccount, credentialAccount],
      error: null,
    })
    renderMeSignIn()

    await waitFor(() => {
      expect(
        screen.queryByText(/your account has a password set/i)
      ).toBeInTheDocument()
    })
    expect(
      screen.queryByRole('button', { name: /set password/i })
    ).not.toBeInTheDocument()
  })
})
