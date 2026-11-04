import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SignUp } from './sign-up'

const { mockNavigate, mockSignUp, mockSignInSocial, mockUseLoaderData } =
  vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockSignUp: vi.fn(),
    mockSignInSocial: vi.fn(),
    mockUseLoaderData: vi.fn().mockReturnValue({ providers: [] }),
  }))

vi.mock('.', () => ({
  signUpRoute: {
    useNavigate: () => mockNavigate,
    useLoaderData: mockUseLoaderData,
  },
}))

vi.mock('../../../lib/authentication', () => ({
  authClient: {
    signUp: { email: mockSignUp },
    signIn: { social: mockSignInSocial },
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
  mockUseLoaderData.mockReturnValue({ providers: [] })
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

describe('social login buttons', () => {
  it('shows social buttons when providers are configured', () => {
    mockUseLoaderData.mockReturnValue({ providers: ['google', 'apple'] })
    renderSignUp()
    expect(
      screen.getByRole('button', { name: /continue with google/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /continue with apple/i })
    ).toBeInTheDocument()
  })

  it('hides social buttons when no providers are configured', () => {
    renderSignUp()
    expect(
      screen.queryByRole('button', { name: /continue with/i })
    ).not.toBeInTheDocument()
  })

  it('calls signIn.social with correct provider on button click', async () => {
    mockSignInSocial.mockResolvedValue({})
    mockUseLoaderData.mockReturnValue({ providers: ['google'] })
    renderSignUp()

    await userEvent.click(
      screen.getByRole('button', { name: /continue with google/i })
    )

    expect(mockSignInSocial).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: window.location.origin + '/',
      errorCallbackURL: window.location.origin + '/login',
    })
  })

  it('shows error message when signIn.social throws', async () => {
    mockSignInSocial.mockRejectedValue(new Error('Network error'))
    mockUseLoaderData.mockReturnValue({ providers: ['google'] })
    renderSignUp()

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
    mockUseLoaderData.mockReturnValue({ providers: ['github'] })
    renderSignUp()
    expect(
      screen.queryByRole('button', { name: /continue with/i })
    ).not.toBeInTheDocument()
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
