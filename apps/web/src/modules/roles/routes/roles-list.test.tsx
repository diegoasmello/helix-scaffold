import {
  createPaginatedRoles,
  createRole,
  deleteRolesIdHandler,
  deleteRolesIdHandlerResponse204,
  getMePermissionsHandler,
  getRolesHandler,
} from '@helix/api-client/mocks'
import { MantineProvider, ModalsProvider } from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import { RolesList } from './roles-list'

vi.mock('.', () => ({
  rolesListRoute: {
    useNavigate: () => vi.fn(),
    useSearch: () => ({ page: 1, pageSize: 10, sortOrder: 'desc' }),
  },
}))

vi.mock('../../../lib/authentication', () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: {
          id: 'test-user',
          name: 'Test User',
          email: 'test@example.com',
          image: null,
          roleId: 'test-role',
        },
      },
      isPending: false,
    }),
  },
}))

const mockRoles = [
  createRole({
    id: '1',
    name: 'Admin',
    description: 'Full access to all features.',
  }),
  createRole({ id: '2', name: 'Viewer', description: 'Read-only access.' }),
]

function renderRolesList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <ModalsProvider>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div>Loading...</div>}>
            <RolesList />
          </Suspense>
        </QueryClientProvider>
      </ModalsProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(
    getRolesHandler(
      createPaginatedRoles({
        data: mockRoles,
        total: mockRoles.length,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      })
    ),
    getMePermissionsHandler({
      grants: { roles: ['view', 'create', 'edit', 'delete'] },
    })
  )
})

afterEach(() => vi.clearAllMocks())

describe('RolesList', () => {
  it('renders all roles', async () => {
    renderRolesList()
    expect(await screen.findByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('Viewer')).toBeInTheDocument()
  })

  it('opens delete modal when delete button is clicked', async () => {
    renderRolesList()
    const deleteButtons = await screen.findAllByLabelText('Delete')
    await userEvent.click(deleteButtons[0])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Delete role')).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        `Are you sure you want to delete "Admin"? This action cannot be undone.`
      )
    ).toBeInTheDocument()
  })

  it('calls DELETE endpoint and closes modal on confirm', async () => {
    let deletedId: string | undefined
    server.use(
      deleteRolesIdHandler(({ params }) => {
        deletedId = params.id as string
        return deleteRolesIdHandlerResponse204()
      })
    )
    renderRolesList()
    const deleteButtons = await screen.findAllByLabelText('Delete')
    await userEvent.click(deleteButtons[0])
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' })
    )
    await waitFor(() => expect(deletedId).toBe('1'))
  })

  it('closes delete modal on cancel', async () => {
    renderRolesList()
    const deleteButtons = await screen.findAllByLabelText('Delete')
    await userEvent.click(deleteButtons[0])
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' })
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
  })

  it('hides edit and delete buttons when user lacks permissions', async () => {
    server.use(getMePermissionsHandler({ grants: { roles: ['view'] } }))
    renderRolesList()
    await screen.findByText('Admin')
    expect(screen.queryByLabelText('Edit')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Delete')).not.toBeInTheDocument()
  })
})
