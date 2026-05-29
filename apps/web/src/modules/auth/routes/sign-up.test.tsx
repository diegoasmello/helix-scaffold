import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SignUp } from './sign-up'

const { mockNavigate, mockSignUp } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSignUp: vi.fn(),
}))

vi.mock('.', () => ({
  signUpRoute: {
    useNavigate: () => mockNavigate,
  },
}))

vi.mock('../../../lib/authentication', () => ({
  authClient: {
    signUp: { email: mockSignUp },
  },
}))

function renderSignUp() {
  render(
    <MantineProvider>
      <MantineEmotionProvider>
        <SignUp />
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

it('renders all form fields', () => {
  renderSignUp()
  expect(
    screen.getByRole('heading', { name: 'Create account' })
  ).toBeInTheDocument()
  expect(screen.getByLabelText(/^name/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/^password/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
})

it('renders sign-in link', () => {
  renderSignUp()
  expect(screen.getByText('Sign in')).toBeInTheDocument()
  expect(screen.getByText('Sign in').closest('a')).toHaveAttribute(
    'href',
    '/login'
  )
})

describe('validation', () => {
  it('blocks submission when form is empty', async () => {
    mockSignUp.mockResolvedValue({ error: null })
    renderSignUp()
    await userEvent.click(
      screen.getByRole('button', { name: 'Create account' })
    )
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('blocks submission when passwords do not match', async () => {
    mockSignUp.mockResolvedValue({ error: null })
    renderSignUp()
    await userEvent.type(screen.getByPlaceholderText('Your name'), 'Jane')
    await userEvent.type(
      screen.getByPlaceholderText('you@example.com'),
      'jane@example.com'
    )
    await userEvent.type(
      screen.getByPlaceholderText('At least 8 characters'),
      'password123'
    )
    await userEvent.type(
      screen.getByPlaceholderText('Repeat your password'),
      'different'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Create account' })
    )
    expect(mockSignUp).not.toHaveBeenCalled()
  })
})

describe('form submission', () => {
  async function fillAndSubmit() {
    await userEvent.type(screen.getByPlaceholderText('Your name'), 'Jane Doe')
    await userEvent.type(
      screen.getByPlaceholderText('you@example.com'),
      'jane@example.com'
    )
    await userEvent.type(
      screen.getByPlaceholderText('At least 8 characters'),
      'password123'
    )
    await userEvent.type(
      screen.getByPlaceholderText('Repeat your password'),
      'password123'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Create account' })
    )
  }

  it('calls signUp.email with correct args', async () => {
    mockSignUp.mockResolvedValue({ error: null })
    renderSignUp()
    await fillAndSubmit()
    expect(mockSignUp).toHaveBeenCalledWith({
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'password123',
    })
  })

  it('navigates to / on success', async () => {
    mockSignUp.mockResolvedValue({ error: null })
    renderSignUp()
    await fillAndSubmit()
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
  })

  it('shows server error on failure', async () => {
    mockSignUp.mockResolvedValue({
      error: { message: 'Email already in use' },
    })
    renderSignUp()
    await fillAndSubmit()
    expect(screen.getByText('Email already in use')).toBeInTheDocument()
  })
})
