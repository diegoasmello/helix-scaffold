import {
  createPaginatedRoles,
  createRole,
  deleteRolesIdHandler,
  deleteRolesIdHandlerResponse204,
  getMePermissionsHandler,
  getRolesHandler,
} from '@helix/api-client/mocks'
import {
  MantineEmotionProvider,
  MantineProvider,
  ModalsProvider,
} from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import { RolesList } from './roles-list'

const mockNotify = vi.hoisted(() => vi.fn())

vi.mock('@helix/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@helix/ui')>()),
  notify: mockNotify,
}))

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
    isAdmin: false,
    id: '1',
    name: 'Admin',
    description: 'Full access to all features.',
  }),
  createRole({
    isAdmin: false,
    id: '2',
    name: 'Viewer',
    description: 'Read-only access.',
  }),
]

function renderRolesList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <ModalsProvider>
          <QueryClientProvider client={queryClient}>
            <Suspense fallback={<div>Loading...</div>}>
              <RolesList />
            </Suspense>
          </QueryClientProvider>
        </ModalsProvider>
      </MantineEmotionProvider>
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
      grants: {
        roles: ['view', 'create', 'edit', 'delete'],
        permissions: ['view', 'edit'],
      },
    })
  )
})

afterEach(() => vi.clearAllMocks())

// The first row is "Admin" (id '1'). The permissions query resolves after
// the list, so the gated buttons are awaited.
async function clickDeleteOnFirstRow() {
  const [deleteButton] = await screen.findAllByRole('button', {
    name: 'Delete',
  })
  await userEvent.click(deleteButton)
}

describe('RolesList', () => {
  it('renders all roles', async () => {
    renderRolesList()
    expect(await screen.findByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('Viewer')).toBeInTheDocument()
  })

  // `maxInlineActions={4}`: all four actions stay buttons, never the menu
  it('shows all four actions as buttons in each row', async () => {
    renderRolesList()
    await screen.findByText('Admin')
    for (const name of ['View', 'Edit', 'Edit permissions', 'Delete']) {
      expect(await screen.findAllByRole('button', { name })).toHaveLength(2)
    }
    expect(screen.queryByLabelText('Actions')).not.toBeInTheDocument()
  })

  it('opens delete modal when Delete is clicked', async () => {
    renderRolesList()
    await clickDeleteOnFirstRow()
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
    await clickDeleteOnFirstRow()
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' })
    )
    await waitFor(() => expect(deletedId).toBe('1'))
  })

  it('explains why the API refused the deletion', async () => {
    server.use(
      deleteRolesIdHandler(
        () =>
          new Response(
            JSON.stringify({
              message: 'Cannot delete a role that has assigned users',
              code: 'role_in_use',
            }),
            { status: 409 }
          )
      )
    )
    renderRolesList()
    await clickDeleteOnFirstRow()
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' })
    )

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith({
        status: 'danger',
        message: 'This role still has users. Move them to another role first.',
      })
    )
  })

  it('closes delete modal on cancel', async () => {
    renderRolesList()
    await clickDeleteOnFirstRow()
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' })
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
  })

  it('shows only View when the user may only view roles', async () => {
    server.use(getMePermissionsHandler({ grants: { roles: ['view'] } }))
    renderRolesList()
    await screen.findByText('Admin')
    expect(screen.getAllByRole('button', { name: 'View' })).toHaveLength(2)
    expect(screen.queryByLabelText('Actions')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Edit' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Edit permissions' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Delete' })
    ).not.toBeInTheDocument()
  })

  it('hides Edit permissions when user lacks permissions:edit', async () => {
    server.use(
      getMePermissionsHandler({
        grants: { roles: ['view', 'edit', 'delete'] },
      })
    )
    renderRolesList()
    await screen.findByText('Admin')
    expect(await screen.findAllByRole('button', { name: 'Edit' })).toHaveLength(
      2
    )
    expect(screen.queryByLabelText('Actions')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(2)
    expect(
      screen.queryByRole('button', { name: 'Edit permissions' })
    ).not.toBeInTheDocument()
  })

  it('hides Edit permissions when user can edit but not view permissions', async () => {
    server.use(
      getMePermissionsHandler({
        grants: { roles: ['view', 'edit', 'delete'], permissions: ['edit'] },
      })
    )
    renderRolesList()
    await screen.findByText('Admin')
    expect(await screen.findAllByRole('button', { name: 'Edit' })).toHaveLength(
      2
    )
    expect(
      screen.queryByRole('button', { name: 'Edit permissions' })
    ).not.toBeInTheDocument()
  })

  it('marks the admin role and offers it only View', async () => {
    const adminRole = createRole({
      isAdmin: true,
      id: '3',
      name: 'Administrator',
      description: 'Everything.',
    })
    server.use(
      getRolesHandler(
        createPaginatedRoles({
          data: [adminRole],
          total: 1,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        })
      )
    )
    renderRolesList()
    expect(await screen.findByText('Administrator')).toBeInTheDocument()
    expect(screen.getByText('Full access')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Actions')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Edit' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Edit permissions' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Delete' })
    ).not.toBeInTheDocument()
  })
})
