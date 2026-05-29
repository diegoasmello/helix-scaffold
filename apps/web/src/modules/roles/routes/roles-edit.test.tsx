import {
  createRole,
  getRolesIdHandler,
  patchRolesIdHandler,
  patchRolesIdHandlerResponse200,
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
import type { RoleFormValues, UpdateRoleInput } from '../types'
import { RolesEdit } from './roles-edit'

const mockNavigate = vi.fn()

vi.mock('.', () => ({
  rolesEditRoute: {
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: '1' }),
  },
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

const mockRole = createRole({
  id: '1',
  name: 'Admin',
  description: 'Full access',
})

function renderRolesEdit() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div>Loading...</div>}>
            <RolesEdit />
          </Suspense>
        </QueryClientProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(
    getRolesIdHandler(mockRole),
    patchRolesIdHandler(async (info) => {
      const body = (await info.request.json()) as UpdateRoleInput
      return patchRolesIdHandlerResponse200({ ...mockRole, ...body })
    })
  )
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('RolesEdit', () => {
  it('renders form pre-populated with item data', async () => {
    renderRolesEdit()
    expect(await screen.findByDisplayValue('Admin')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Full access')).toBeInTheDocument()
  })

  it('shows validation errors when name is cleared and form is submitted', async () => {
    renderRolesEdit()
    await screen.findByDisplayValue('Admin')
    await userEvent.clear(screen.getByPlaceholderText('Role name'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Required')).toBeInTheDocument()
  })

  it('calls PATCH /roles/:id with updated payload and navigates on success', async () => {
    let capturedBody: UpdateRoleInput | undefined
    server.use(
      patchRolesIdHandler(async (info) => {
        capturedBody = (await info.request.json()) as UpdateRoleInput
        return patchRolesIdHandlerResponse200({ ...mockRole, ...capturedBody })
      })
    )

    renderRolesEdit()
    await screen.findByDisplayValue('Admin')
    await userEvent.clear(screen.getByPlaceholderText('Role name'))
    await userEvent.type(
      screen.getByPlaceholderText('Role name'),
      'Super Admin'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(capturedBody).toMatchObject({
        name: 'Super Admin',
      })
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/roles' })
    })
  })

  it('does not navigate when API returns error', async () => {
    server.use(
      patchRolesIdHandler(
        () =>
          new Response(JSON.stringify({ message: 'Server error' }), {
            status: 500,
          })
      )
    )

    renderRolesEdit()
    await screen.findByDisplayValue('Admin')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
})
