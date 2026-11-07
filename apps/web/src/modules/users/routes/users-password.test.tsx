import {
  createUserWithRole,
  getUsersIdHandler,
  putUsersIdPasswordHandler,
  putUsersIdPasswordHandlerResponse204,
  putUsersIdPasswordHandlerResponse403,
} from '@helix/api-client/mocks'
import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import type { SetUserPasswordInput } from '../types'
import { UsersPassword } from './users-password'

const mockNavigate = vi.fn()

const mockNotify = vi.hoisted(() => vi.fn())

vi.mock('@helix/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@helix/ui')>()),
  notify: mockNotify,
}))

vi.mock('.', () => ({
  usersPasswordRoute: {
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: '1' }),
  },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useBlocker: vi.fn() }
})

const mockUser = createUserWithRole({
  id: '1',
  name: 'Alice Silva',
  email: 'alice@example.com',
  roleId: 'role-1',
  role: { id: 'role-1', name: 'Editor', isAdmin: false },
})

function renderUsersPassword() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div>Loading...</div>}>
            <UsersPassword />
          </Suspense>
        </QueryClientProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

async function fillPasswords(newPassword: string, confirmPassword: string) {
  await userEvent.type(
    await screen.findByPlaceholderText('Min 8 characters'),
    newPassword
  )
  await userEvent.type(
    screen.getByPlaceholderText('Repeat the new password'),
    confirmPassword
  )
}

beforeEach(() => {
  server.use(getUsersIdHandler(mockUser))
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('UsersPassword', () => {
  it('names the user whose password is set', async () => {
    renderUsersPassword()
    expect(
      await screen.findByText(
        /Set a new password for Alice Silva \(alice@example\.com\)/
      )
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Min 8 characters')).toBeRequired()
    expect(
      screen.getByPlaceholderText('Repeat the new password')
    ).toBeRequired()
  })

  it('refuses passwords that do not match, without calling the API', async () => {
    let called = false
    server.use(
      putUsersIdPasswordHandler(() => {
        called = true
        return putUsersIdPasswordHandlerResponse204()
      })
    )
    renderUsersPassword()
    await fillPasswords('NewPassword1!', 'Different1!')
    await userEvent.click(
      screen.getByRole('button', { name: 'Change password' })
    )

    expect(
      await screen.findByText("The passwords don't match")
    ).toBeInTheDocument()
    expect(called).toBe(false)
  })

  it('refuses a password shorter than 8 characters', async () => {
    renderUsersPassword()
    await fillPasswords('short', 'short')
    await userEvent.click(
      screen.getByRole('button', { name: 'Change password' })
    )
    expect(await screen.findByText('Min 8 characters')).toBeInTheDocument()
  })

  it('sends only the new password, notifies and returns to the detail', async () => {
    let capturedBody: SetUserPasswordInput | undefined
    let capturedId: string | undefined
    server.use(
      putUsersIdPasswordHandler(async (info) => {
        capturedId = info.params.id as string
        capturedBody = (await info.request.json()) as SetUserPasswordInput
        return putUsersIdPasswordHandlerResponse204()
      })
    )
    renderUsersPassword()
    await fillPasswords('NewPassword1!', 'NewPassword1!')
    await userEvent.click(
      screen.getByRole('button', { name: 'Change password' })
    )

    await waitFor(() => {
      expect(capturedId).toBe('1')
      expect(capturedBody).toEqual({ newPassword: 'NewPassword1!' })
      expect(mockNotify).toHaveBeenCalledWith({
        status: 'success',
        message: 'Password changed. Alice Silva was signed out everywhere.',
      })
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/users/$id',
        params: { id: '1' },
      })
    })
  })

  it("explains the API's refusal and stays on the page", async () => {
    server.use(
      putUsersIdPasswordHandler(() =>
        putUsersIdPasswordHandlerResponse403({
          message: 'The admin account cannot be changed or deleted here',
          code: 'admin_user_locked',
        })
      )
    )
    renderUsersPassword()
    await fillPasswords('NewPassword1!', 'NewPassword1!')
    await userEvent.click(
      screen.getByRole('button', { name: 'Change password' })
    )

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith({
        status: 'danger',
        message: "The admin account can't be edited or deleted here.",
      })
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('goes back to the detail on Cancel', async () => {
    renderUsersPassword()
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/users/$id',
      params: { id: '1' },
    })
  })
})
