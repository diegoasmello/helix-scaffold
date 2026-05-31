import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ForgotPassword } from './forgot-password'

const { mockRequestPasswordReset } = vi.hoisted(() => ({
  mockRequestPasswordReset: vi.fn(),
}))

vi.mock('../../../lib/authentication', () => ({
  authClient: {
    requestPasswordReset: mockRequestPasswordReset,
  },
}))

function renderForgotPassword() {
  render(
    <MantineProvider>
      <MantineEmotionProvider>
        <ForgotPassword />
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

it('renders the forgot password form', () => {
  renderForgotPassword()
  expect(
    screen.getByRole('heading', { name: 'Forgot password?' })
  ).toBeInTheDocument()
  expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Send reset link' })
  ).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: 'Back to sign in' })
  ).toBeInTheDocument()
})

describe('form submission', () => {
  it('calls forgetPassword with email and redirectTo', async () => {
    mockRequestPasswordReset.mockResolvedValue({ error: null })
    renderForgotPassword()

    await userEvent.type(
      screen.getByPlaceholderText('you@example.com'),
      'user@example.com'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Send reset link' })
    )

    expect(mockRequestPasswordReset).toHaveBeenCalledWith({
      email: 'user@example.com',
      redirectTo: window.location.origin + '/reset-password',
    })
  })

  it('shows success message after submission regardless of whether email exists', async () => {
    mockRequestPasswordReset.mockResolvedValue({ error: null })
    renderForgotPassword()

    await userEvent.type(
      screen.getByPlaceholderText('you@example.com'),
      'anyone@example.com'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Send reset link' })
    )

    expect(
      await screen.findByRole('heading', { name: 'Check your inbox' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/if an account with that email exists/i)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Back to sign in' })
    ).toBeInTheDocument()
  })

  it('shows error message on API failure', async () => {
    mockRequestPasswordReset.mockResolvedValue({
      error: { message: 'Server error' },
    })
    renderForgotPassword()

    await userEvent.type(
      screen.getByPlaceholderText('you@example.com'),
      'user@example.com'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Send reset link' })
    )

    expect(
      await screen.findByText('Something went wrong. Please try again.')
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Check your inbox' })
    ).not.toBeInTheDocument()
  })

  it('does not call forgetPassword when email is blank', async () => {
    renderForgotPassword()

    await userEvent.type(screen.getByPlaceholderText('you@example.com'), '   ')
    await userEvent.click(
      screen.getByRole('button', { name: 'Send reset link' })
    )

    expect(mockRequestPasswordReset).not.toHaveBeenCalled()
  })
})
