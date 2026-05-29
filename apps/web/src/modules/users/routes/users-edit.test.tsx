import {
  createUserWithRole,
  getUsersIdHandler,
  patchUsersIdHandler,
  patchUsersIdHandlerResponse200,
} from '@helix/api-client/mocks'
import {
  MantineEmotionProvider,
  MantineProvider,
  type UseFormReturnType,
} from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import type { UpdateUserInput, UserFormValues } from '../types'
import { UsersEdit } from './users-edit'

const mockNavigate = vi.fn()

vi.mock('.', () => ({
  usersEditRoute: {
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: '1' }),
  },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useBlocker: vi.fn() }
})

vi.mock('../components/users-form', () => ({
  UsersForm: ({
    form,
  }: {
    form: UseFormReturnType<UserFormValues>
    isEditing?: boolean
  }) => (
    <div>
      <input
        placeholder="Full name"
        value={form.values.name}
        onChange={(e) => form.setFieldValue('name', e.target.value)}
      />
      {form.errors.name && <span>{String(form.errors.name)}</span>}
      <input
        placeholder="email@example.com"
        value={form.values.email}
        onChange={(e) => form.setFieldValue('email', e.target.value)}
      />
      {form.errors.email && <span>{String(form.errors.email)}</span>}
    </div>
  ),
}))

const mockUser = createUserWithRole({
  id: '1',
  name: 'Alice Silva',
  email: 'alice@example.com',
  emailVerified: true,
  roleId: 'role-1',
  role: { id: 'role-1', name: 'Admin' },
})

function renderUsersEdit() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div>Loading...</div>}>
            <UsersEdit />
          </Suspense>
        </QueryClientProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(
    getUsersIdHandler(mockUser),
    patchUsersIdHandler(async (info) => {
      const body = (await info.request.json()) as UpdateUserInput
      return patchUsersIdHandlerResponse200({ ...mockUser, ...body })
    })
  )
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('UsersEdit', () => {
  it('renders form pre-populated with item data', async () => {
    renderUsersEdit()
    expect(
      await screen.findByDisplayValue('Alice Silva')
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue('alice@example.com')).toBeInTheDocument()
  })

  it('shows validation errors when name is cleared and form is submitted', async () => {
    renderUsersEdit()
    await screen.findByDisplayValue('Alice Silva')
    await userEvent.clear(screen.getByPlaceholderText('Full name'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Required')).toBeInTheDocument()
  })

  it('calls PATCH /users/:id with updated payload and navigates on success', async () => {
    let capturedBody: UpdateUserInput | undefined
    server.use(
      patchUsersIdHandler(async (info) => {
        capturedBody = (await info.request.json()) as UpdateUserInput
        return patchUsersIdHandlerResponse200({ ...mockUser, ...capturedBody })
      })
    )

    renderUsersEdit()
    await screen.findByDisplayValue('Alice Silva')
    await userEvent.clear(screen.getByPlaceholderText('Full name'))
    await userEvent.type(
      screen.getByPlaceholderText('Full name'),
      'Updated name'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(capturedBody).toMatchObject({
        name: 'Updated name',
        email: 'alice@example.com',
        roleId: 'role-1',
      })
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/users' })
    })
  })

  it('does not navigate when API returns error', async () => {
    server.use(
      patchUsersIdHandler(
        () =>
          new Response(JSON.stringify({ message: 'Server error' }), {
            status: 500,
          })
      )
    )

    renderUsersEdit()
    await screen.findByDisplayValue('Alice Silva')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
})
