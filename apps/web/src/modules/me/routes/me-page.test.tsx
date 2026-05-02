import {
  createGetMe200,
  getMeHandler,
  patchMeHandler,
  patchMeHandlerResponse200,
  patchMePasswordHandler,
  patchMePasswordHandlerResponse204,
  patchMePasswordHandlerResponse400,
} from '@helix/api-client/mocks'
import { MantineProvider } from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import { MePage } from './me-page'

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }))

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

function renderMePage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<div>Loading...</div>}>
          <MePage />
        </Suspense>
      </QueryClientProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(getMeHandler(mockProfile))
})

afterEach(() => vi.clearAllMocks())

describe('Profile display', () => {
  it('renders the profile page title', async () => {
    renderMePage()
    await screen.findByRole('heading', { name: 'Profile' })
  })

  it('pre-populates form fields with user data', async () => {
    renderMePage()
    const nameInput = await screen.findByLabelText('Name')
    const emailInput = await screen.findByLabelText('Email')
    expect(nameInput).toHaveValue('Test User')
    expect(emailInput).toHaveValue('test@example.com')
  })
})

describe('Profile update', () => {
  it('submits updated name and shows success', async () => {
    const user = userEvent.setup()
    const updatedProfile = { ...mockProfile, name: 'New Name' }

    server.use(patchMeHandler(() => patchMeHandlerResponse200(updatedProfile)))

    renderMePage()
    const nameInput = await screen.findByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'New Name')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Profile updated successfully.')
  })

  it('shows validation error when name is empty', async () => {
    const user = userEvent.setup()
    renderMePage()
    const nameInput = await screen.findByLabelText('Name')
    await user.clear(nameInput)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Required')
  })
})

describe('Password change', () => {
  it('submits password change and shows success', async () => {
    const user = userEvent.setup()

    server.use(
      patchMePasswordHandler(() => patchMePasswordHandlerResponse204())
    )

    renderMePage()
    await screen.findByLabelText('Current Password')

    await user.type(screen.getByLabelText('Current Password'), 'Password123!')
    await user.type(screen.getByLabelText('New Password'), 'NewPass456!')
    await user.type(
      screen.getByLabelText('Confirm New Password'),
      'NewPass456!'
    )
    await user.click(screen.getByRole('button', { name: 'Change Password' }))

    await screen.findByText('Password changed successfully.')
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

    renderMePage()
    await screen.findByLabelText('Current Password')

    await user.type(screen.getByLabelText('Current Password'), 'WrongPass!')
    await user.type(screen.getByLabelText('New Password'), 'NewPass456!')
    await user.type(
      screen.getByLabelText('Confirm New Password'),
      'NewPass456!'
    )
    await user.click(screen.getByRole('button', { name: 'Change Password' }))

    await screen.findByText('Current password is incorrect.')
  })

  it('shows validation error when passwords do not match', async () => {
    const user = userEvent.setup()
    renderMePage()
    await screen.findByLabelText('Current Password')

    await user.type(screen.getByLabelText('Current Password'), 'Password123!')
    await user.type(screen.getByLabelText('New Password'), 'NewPass456!')
    await user.type(screen.getByLabelText('Confirm New Password'), 'Different!')
    await user.click(screen.getByRole('button', { name: 'Change Password' }))

    await screen.findByText('Passwords do not match')
  })

  it('shows validation error when new password is too short', async () => {
    const user = userEvent.setup()
    renderMePage()
    await screen.findByLabelText('Current Password')

    await user.type(screen.getByLabelText('Current Password'), 'Password123!')
    await user.type(screen.getByLabelText('New Password'), 'short')
    await user.type(screen.getByLabelText('Confirm New Password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Change Password' }))

    await screen.findByText('Min 8 characters')
  })
})
