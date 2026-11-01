import {
  createRole,
  postRolesHandler,
  postRolesHandlerResponse201,
  postRolesHandlerResponse409,
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
import type { CreateRoleInput, RoleFormValues } from '../types'
import { RolesCreate } from './roles-create'

const mockNavigate = vi.fn()

vi.mock('.', () => ({
  rolesCreateRoute: { useNavigate: () => mockNavigate },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useBlocker: vi.fn() }
})

vi.mock('../components/roles-form', () => ({
  RolesForm: ({ form }: { form: UseFormReturnType<RoleFormValues> }) => (
    <div>
      <input
        aria-label="Name"
        placeholder="Role name"
        value={form.values.name}
        onChange={(e) => form.setFieldValue('name', e.target.value)}
      />
      {form.errors.name && <span>{String(form.errors.name)}</span>}
      <textarea
        aria-label="Description"
        placeholder="Role description"
        value={form.values.description}
        onChange={(e) => form.setFieldValue('description', e.target.value)}
      />
      {form.errors.description && (
        <span>{String(form.errors.description)}</span>
      )}
    </div>
  ),
}))

function renderRolesCreate() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div>Loading...</div>}>
            <RolesCreate />
          </Suspense>
        </QueryClientProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(
    postRolesHandler(async (info) => {
      const body = (await info.request.json()) as CreateRoleInput
      return postRolesHandlerResponse201(
        createRole({ ...(body as object), id: '99' })
      )
    })
  )
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('RolesCreate', () => {
  it('renders the create form', async () => {
    renderRolesCreate()
    expect(
      await screen.findByRole('heading', { name: 'Create Role' })
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Role name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Role description')).toBeInTheDocument()
  })

  it('shows validation errors when submitting empty form', async () => {
    renderRolesCreate()
    await screen.findByRole('heading', { name: 'Create Role' })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const errors = await screen.findAllByText('Required')
    expect(errors.length).toBeGreaterThanOrEqual(2)
  })

  it('calls POST /roles with correct payload and navigates on success', async () => {
    let capturedBody: CreateRoleInput | undefined
    server.use(
      postRolesHandler(async (info) => {
        capturedBody = (await info.request.json()) as CreateRoleInput
        return postRolesHandlerResponse201(
          createRole({ ...(capturedBody as object), id: '99' })
        )
      })
    )

    renderRolesCreate()
    await screen.findByRole('heading', { name: 'Create Role' })

    await userEvent.type(screen.getByPlaceholderText('Role name'), 'Admin')
    await userEvent.type(
      screen.getByPlaceholderText('Role description'),
      'Full access'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(capturedBody).toMatchObject({
        name: 'Admin',
        description: 'Full access',
      })
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/roles' })
    })
  })

  it('shows the name error when the name is taken', async () => {
    server.use(
      postRolesHandler(() =>
        postRolesHandlerResponse409({
          message: 'A role with this name already exists',
          code: 'name_taken',
        })
      )
    )

    renderRolesCreate()
    await screen.findByRole('heading', { name: 'Create Role' })

    await userEvent.type(screen.getByPlaceholderText('Role name'), 'Admin')
    await userEvent.type(
      screen.getByPlaceholderText('Role description'),
      'Full access'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByText('A role with this name already exists')
    ).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('does not navigate when API returns error', async () => {
    server.use(
      postRolesHandler(
        () =>
          new Response(JSON.stringify({ message: 'Server error' }), {
            status: 500,
          })
      )
    )

    renderRolesCreate()
    await screen.findByRole('heading', { name: 'Create Role' })

    await userEvent.type(screen.getByPlaceholderText('Role name'), 'Admin')
    await userEvent.type(
      screen.getByPlaceholderText('Role description'),
      'Full access'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
})
