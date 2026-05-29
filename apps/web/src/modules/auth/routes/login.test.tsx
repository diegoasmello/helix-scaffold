import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Login } from './login'

const { mockNavigate, mockSignIn, mockUseLoaderData } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSignIn: vi.fn(),
  mockUseLoaderData: vi.fn().mockReturnValue({ registrationOpen: false }),
}))

vi.mock('.', () => ({
  loginRoute: {
    useNavigate: () => mockNavigate,
    useLoaderData: mockUseLoaderData,
  },
}))

vi.mock('../../../lib/authentication', () => ({
  authClient: {
    signIn: { email: mockSignIn },
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
  mockUseLoaderData.mockReturnValue({ registrationOpen: false })
})

it('renders the sign-in form', () => {
  renderLogin()
  expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('Your password')).toBeInTheDocument()
})

describe('sign-up link', () => {
  it('shows link when registration is open', () => {
    mockUseLoaderData.mockReturnValue({ registrationOpen: true })
    renderLogin()
    expect(screen.getByText('Create one')).toBeInTheDocument()
  })

  it('hides link when registration is closed', () => {
    renderLogin()
    expect(screen.queryByText('Create one')).not.toBeInTheDocument()
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
