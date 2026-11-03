import {
  getMeProvidersHandler,
  getMeProvidersHandlerResponse200,
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
import { SignInMethods } from './sign-in-methods'

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

function renderSignInMethods() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <Notifications />
        <QueryClientProvider client={queryClient}>
          <SignInMethods />
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
    renderSignInMethods()
    expect(await screen.findByText('Google')).toBeInTheDocument()
    expect(screen.getByText(/connected on january/i)).toBeInTheDocument()
  })

  it('renders credential account as "Email & password"', async () => {
    mockListAccounts.mockResolvedValue({
      data: [credentialAccount],
      error: null,
    })
    renderSignInMethods()
    expect(await screen.findByText('Email & password')).toBeInTheDocument()
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
    renderSignInMethods()
    expect(await screen.findByText('github')).toBeInTheDocument()
  })

  it('shows all linked accounts', async () => {
    mockListAccounts.mockResolvedValue({
      data: [googleAccount, credentialAccount],
      error: null,
    })
    renderSignInMethods()
    expect(await screen.findByText('Google')).toBeInTheDocument()
    expect(screen.getByText('Email & password')).toBeInTheDocument()
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
    renderSignInMethods()
    await screen.findByText('Email & password')
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
    renderSignInMethods()
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
    renderSignInMethods()
    const connectButtons = await screen.findAllByRole('button', {
      name: /connect/i,
    })
    expect(connectButtons).toHaveLength(1)
    expect(within(connectButtons[0]).getByText(/connect/i)).toBeInTheDocument()
    expect(screen.getByText('Facebook')).toBeInTheDocument()
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
    renderSignInMethods()

    await userEvent.click(
      await screen.findByRole('button', { name: /connect/i })
    )

    expect(mockLinkSocial).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: window.location.origin + '/me/security',
    })
  })

  it('shows error notification when linkSocial throws', async () => {
    mockLinkSocial.mockRejectedValue(new Error('Network error'))
    server.use(
      getMeProvidersHandler(() =>
        getMeProvidersHandlerResponse200({ providers: ['google'] })
      )
    )
    renderSignInMethods()

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
    renderSignInMethods()
    expect(
      await screen.findByText(/could not load your connected accounts/i)
    ).toBeInTheDocument()
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
    renderSignInMethods()
    await screen.findByText('Google')
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: /link another account/i })
      ).not.toBeInTheDocument()
    )
  })
})
