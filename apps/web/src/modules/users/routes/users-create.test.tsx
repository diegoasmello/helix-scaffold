import {
  createUserWithRole,
  postUsersHandler,
  postUsersHandlerResponse201,
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
import type { CreateUserInput, UserFormValues } from '../types'
import { UsersCreate } from './users-create'

const mockNavigate = vi.fn()

vi.mock('.', () => ({
  usersCreateRoute: { useNavigate: () => mockNavigate },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useBlocker: vi.fn() }
})

vi.mock('../components/users-form', () => ({
  UsersForm: ({ form }: { form: UseFormReturnType<UserFormValues> }) => (
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
      <input
        placeholder="Min 8 characters"
        value={form.values.password}
        onChange={(e) => form.setFieldValue('password', e.target.value)}
      />
      {form.errors.password && <span>{String(form.errors.password)}</span>}
    </div>
  ),
}))

function renderUsersCreate() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div>Loading...</div>}>
            <UsersCreate />
          </Suspense>
        </QueryClientProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(
    postUsersHandler(async (info) => {
      const body = (await info.request.json()) as CreateUserInput
      return postUsersHandlerResponse201(
        createUserWithRole({ ...(body as object), id: '99' })
      )
    })
  )
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('UsersCreate', () => {
  it('renders the create form heading', async () => {
    renderUsersCreate()
    expect(
      await screen.findByRole('heading', { name: 'Create User' })
    ).toBeInTheDocument()
  })

  it('shows validation errors when submitting empty form', async () => {
    renderUsersCreate()
    await screen.findByRole('heading', { name: 'Create User' })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const errors = await screen.findAllByText('Required')
    expect(errors.length).toBeGreaterThanOrEqual(2)
  })

  it('calls POST /users with correct payload and navigates on success', async () => {
    let capturedBody: CreateUserInput | undefined
    server.use(
      postUsersHandler(async (info) => {
        capturedBody = (await info.request.json()) as CreateUserInput
        return postUsersHandlerResponse201(
          createUserWithRole({ ...(capturedBody as object), id: '99' })
        )
      })
    )

    renderUsersCreate()
    await screen.findByRole('heading', { name: 'Create User' })

    await userEvent.type(screen.getByPlaceholderText('Full name'), 'Alice Silva')
    await userEvent.type(
      screen.getByPlaceholderText('email@example.com'),
      'alice@example.com'
    )
    await userEvent.type(
      screen.getByPlaceholderText('Min 8 characters'),
      'password123'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(capturedBody).toMatchObject({
        name: 'Alice Silva',
        email: 'alice@example.com',
        password: 'password123',
      })
      expect(capturedBody).not.toHaveProperty('roleId')
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/users' })
    })
  })

  it('does not navigate when API returns error', async () => {
    server.use(
      postUsersHandler(
        () =>
          new Response(JSON.stringify({ message: 'Server error' }), {
            status: 500,
          })
      )
    )

    renderUsersCreate()
    await screen.findByRole('heading', { name: 'Create User' })

    await userEvent.type(screen.getByPlaceholderText('Full name'), 'Alice Silva')
    await userEvent.type(
      screen.getByPlaceholderText('email@example.com'),
      'alice@example.com'
    )
    await userEvent.type(
      screen.getByPlaceholderText('Min 8 characters'),
      'password123'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
})
