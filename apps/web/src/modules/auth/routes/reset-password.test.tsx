import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ResetPassword } from './reset-password'

const { mockNavigate, mockResetPassword, mockUseSearch } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockResetPassword: vi.fn(),
  mockUseSearch: vi
    .fn()
    .mockReturnValue({ token: 'valid-token', error: undefined }),
}))

vi.mock('.', () => ({
  resetPasswordRoute: {
    useNavigate: () => mockNavigate,
    useSearch: mockUseSearch,
  },
}))

vi.mock('../../../lib/authentication', () => ({
  authClient: {
    resetPassword: mockResetPassword,
  },
}))

function renderResetPassword() {
  render(
    <MantineProvider>
      <MantineEmotionProvider>
        <ResetPassword />
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

afterEach(() => {
  vi.clearAllMocks()
  mockUseSearch.mockReturnValue({ token: 'valid-token', error: undefined })
})

describe('invalid token state', () => {
  it('shows generic invalid link message when token is missing', () => {
    mockUseSearch.mockReturnValue({ token: undefined, error: undefined })
    renderResetPassword()

    expect(
      screen.getByRole('heading', { name: 'Invalid link' })
    ).toBeInTheDocument()
    expect(
      screen.getByText('This password reset link is invalid or has expired.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Request a new link' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Reset password' })
    ).not.toBeInTheDocument()
  })

  it('shows expired link message when Better Auth redirects with error=INVALID_TOKEN', () => {
    mockUseSearch.mockReturnValue({ token: undefined, error: 'INVALID_TOKEN' })
    renderResetPassword()

    expect(
      screen.getByRole('heading', { name: 'Invalid link' })
    ).toBeInTheDocument()
    expect(
      screen.getByText('This password reset link has expired.')
    ).toBeInTheDocument()
  })
})

describe('reset password form', () => {
  it('renders the form when token is present', () => {
    renderResetPassword()

    expect(
      screen.getByRole('heading', { name: 'Reset your password' })
    ).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('At least 8 characters')
    ).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('Repeat your new password')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Reset password' })
    ).toBeInTheDocument()
  })

  it('calls resetPassword with new password and token on submit', async () => {
    mockResetPassword.mockResolvedValue({ error: null })
    renderResetPassword()

    await userEvent.type(
      screen.getByPlaceholderText('At least 8 characters'),
      'newpassword123'
    )
    await userEvent.type(
      screen.getByPlaceholderText('Repeat your new password'),
      'newpassword123'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset password' })
    )

    expect(mockResetPassword).toHaveBeenCalledWith({
      newPassword: 'newpassword123',
      token: 'valid-token',
    })
  })

  it('navigates to /login on success', async () => {
    mockResetPassword.mockResolvedValue({ error: null })
    renderResetPassword()

    await userEvent.type(
      screen.getByPlaceholderText('At least 8 characters'),
      'newpassword123'
    )
    await userEvent.type(
      screen.getByPlaceholderText('Repeat your new password'),
      'newpassword123'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset password' })
    )

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' })
  })

  it('shows generic error message on API failure', async () => {
    mockResetPassword.mockResolvedValue({
      error: { message: 'INVALID_TOKEN' },
    })
    renderResetPassword()

    await userEvent.type(
      screen.getByPlaceholderText('At least 8 characters'),
      'newpassword123'
    )
    await userEvent.type(
      screen.getByPlaceholderText('Repeat your new password'),
      'newpassword123'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset password' })
    )

    expect(
      await screen.findByText(
        'Failed to reset password. The link may have expired.'
      )
    ).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('shows generic error message even when error.message is empty string', async () => {
    mockResetPassword.mockResolvedValue({ error: { message: '' } })
    renderResetPassword()

    await userEvent.type(
      screen.getByPlaceholderText('At least 8 characters'),
      'newpassword123'
    )
    await userEvent.type(
      screen.getByPlaceholderText('Repeat your new password'),
      'newpassword123'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset password' })
    )

    expect(
      await screen.findByText(
        'Failed to reset password. The link may have expired.'
      )
    ).toBeInTheDocument()
  })
})

describe('form validation', () => {
  it('shows error when password is too short', async () => {
    renderResetPassword()

    await userEvent.type(
      screen.getByPlaceholderText('At least 8 characters'),
      'short'
    )
    await userEvent.type(
      screen.getByPlaceholderText('Repeat your new password'),
      'short'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset password' })
    )

    expect(
      await screen.findByText('Password must be at least 8 characters')
    ).toBeInTheDocument()
    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  it('shows error when passwords do not match', async () => {
    renderResetPassword()

    await userEvent.type(
      screen.getByPlaceholderText('At least 8 characters'),
      'newpassword123'
    )
    await userEvent.type(
      screen.getByPlaceholderText('Repeat your new password'),
      'differentpassword'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset password' })
    )

    expect(
      await screen.findByText('Passwords do not match')
    ).toBeInTheDocument()
    expect(mockResetPassword).not.toHaveBeenCalled()
  })
})
