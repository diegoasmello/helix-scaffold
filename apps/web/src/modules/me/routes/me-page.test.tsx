import {
  createGetMe200,
  getMeHandler,
  patchMeHandler,
  patchMeHandlerResponse200,
  patchMePasswordHandler,
  patchMePasswordHandlerResponse204,
  patchMePasswordHandlerResponse400,
} from '@helix/api-client/mocks'
import { MantineProvider, Notifications } from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import { MeAccount } from './me-account'
import { MeSecurity } from './me-security'

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
  },
}))

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
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <MeSecurity />
      </QueryClientProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(getMeHandler(mockProfile))
})

afterEach(() => vi.clearAllMocks())

describe('Profile display', () => {
  it('renders the name and email sections', async () => {
    renderMeAccount()
    await screen.findByRole('heading', { name: 'Name' })
    expect(screen.getByRole('heading', { name: 'Email Address' })).toBeInTheDocument()
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

describe('Password change', () => {
  it('submits password change and shows success', async () => {
    const user = userEvent.setup()

    server.use(
      patchMePasswordHandler(() => patchMePasswordHandlerResponse204())
    )

    renderMeSecurity()
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
    const [currentPwdInput, newPwdInput, confirmPwdInput] =
      document.querySelectorAll('input[type="password"]')

    await user.type(currentPwdInput, 'Password123!')
    await user.type(newPwdInput, 'short')
    await user.type(confirmPwdInput, 'short')
    await user.click(screen.getByRole('button', { name: 'Change Password' }))

    await screen.findByText('Min 8 characters')
  })
})
