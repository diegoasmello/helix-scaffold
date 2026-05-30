import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Login } from './login'

const { mockNavigate, mockSignIn, mockSignInSocial, mockUseLoaderData } =
  vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockSignIn: vi.fn(),
    mockSignInSocial: vi.fn(),
    mockUseLoaderData: vi
      .fn()
      .mockReturnValue({ registrationOpen: false, providers: [] }),
  }))

vi.mock('.', () => ({
  loginRoute: {
    useNavigate: () => mockNavigate,
    useLoaderData: mockUseLoaderData,
  },
}))

vi.mock('../../../lib/authentication', () => ({
  authClient: {
    signIn: { email: mockSignIn, social: mockSignInSocial },
  },
}))

function renderLogin() {
  render(
    <MantineProvider>
      <MantineEmotionProvider>
        <Login />
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

afterEach(() => {
  vi.clearAllMocks()
  mockUseLoaderData.mockReturnValue({ registrationOpen: false, providers: [] })
})

it('renders the sign-in form', () => {
  renderLogin()
  expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('Your password')).toBeInTheDocument()
})

describe('sign-up link', () => {
  it('shows link when registration is open', () => {
    mockUseLoaderData.mockReturnValue({ registrationOpen: true, providers: [] })
    renderLogin()
    expect(screen.getByText('Create one')).toBeInTheDocument()
  })

  it('hides link when registration is closed', () => {
    renderLogin()
    expect(screen.queryByText('Create one')).not.toBeInTheDocument()
  })
})

describe('social login buttons', () => {
  it('shows social buttons when registration is open and providers are configured', () => {
    mockUseLoaderData.mockReturnValue({
      registrationOpen: true,
      providers: ['google', 'facebook'],
    })
    renderLogin()
    expect(
      screen.getByRole('button', { name: /continue with google/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /continue with facebook/i })
    ).toBeInTheDocument()
  })

  it('hides social buttons when registration is closed', () => {
    mockUseLoaderData.mockReturnValue({
      registrationOpen: false,
      providers: ['google'],
    })
    renderLogin()
    expect(
      screen.queryByRole('button', { name: /continue with google/i })
    ).not.toBeInTheDocument()
  })

  it('hides social buttons when registration is open but no providers are configured', () => {
    mockUseLoaderData.mockReturnValue({
      registrationOpen: true,
      providers: [],
    })
    renderLogin()
    expect(
      screen.queryByRole('button', { name: /continue with/i })
    ).not.toBeInTheDocument()
  })

  it('calls signIn.social with correct provider on button click', async () => {
    mockSignInSocial.mockResolvedValue({})
    mockUseLoaderData.mockReturnValue({
      registrationOpen: true,
      providers: ['google'],
    })
    renderLogin()

    await userEvent.click(
      screen.getByRole('button', { name: /continue with google/i })
    )

    expect(mockSignInSocial).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: window.location.origin + '/',
    })
  })

  it('shows error message when signIn.social throws', async () => {
    mockSignInSocial.mockRejectedValue(new Error('Network error'))
    mockUseLoaderData.mockReturnValue({
      registrationOpen: true,
      providers: ['google'],
    })
    renderLogin()

    await userEvent.click(
      screen.getByRole('button', { name: /continue with google/i })
    )

    expect(
      await screen.findByText(
        'Could not sign in with this provider. Please try again.'
      )
    ).toBeInTheDocument()
  })

  it('ignores unknown provider strings from the backend', () => {
    mockUseLoaderData.mockReturnValue({
      registrationOpen: true,
      providers: ['github', 'twitter'],
    })
    renderLogin()
    expect(
      screen.queryByRole('button', { name: /continue with/i })
    ).not.toBeInTheDocument()
  })
})

describe('form submission', () => {
  it('calls signIn.email with correct args on submit', async () => {
    mockSignIn.mockResolvedValue({ error: null })
    renderLogin()

    await userEvent.type(
      screen.getByPlaceholderText('you@example.com'),
      'user@example.com'
    )
    await userEvent.type(
      screen.getByPlaceholderText('Your password'),
      'password123'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(mockSignIn).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
    })
  })

  it('navigates to / on success', async () => {
    mockSignIn.mockResolvedValue({ error: null })
    renderLogin()

    await userEvent.type(
      screen.getByPlaceholderText('you@example.com'),
      'user@example.com'
    )
    await userEvent.type(
      screen.getByPlaceholderText('Your password'),
      'password123'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
  })

  it('shows server error on failure', async () => {
    mockSignIn.mockResolvedValue({
      error: { message: 'Invalid credentials' },
    })
    renderLogin()

    await userEvent.type(
      screen.getByPlaceholderText('you@example.com'),
      'user@example.com'
    )
    await userEvent.type(screen.getByPlaceholderText('Your password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
  })
})
