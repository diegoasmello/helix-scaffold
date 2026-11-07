import {
  createRoleDetail,
  createRolePermissionsResponse,
  getMePermissionsHandler,
  getPermissionsResourcesHandler,
  getRegistrationStatusHandler,
  getRegistrationStatusHandlerResponse200,
  getRolesIdHandler,
  getRolesIdPermissionsHandler,
} from '@helix/api-client/mocks'
import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import { RolesDetail } from './roles-detail'

const mockNavigate = vi.fn()

vi.mock('.', () => ({
  rolesDetailRoute: {
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: '1' }),
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

const mockRole = createRoleDetail({
  isAdmin: false,
  manageable: true,
  id: '1',
  name: 'Admin',
  description: 'Full access',
  createdAt: '2024-03-15T10:00:00.000Z',
})

const mockGrants = createRolePermissionsResponse({
  grants: { roles: ['view', 'edit'] },
})

function renderRolesDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div>Loading...</div>}>
            <RolesDetail />
          </Suspense>
        </QueryClientProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(
    getRolesIdHandler(mockRole),
    getRolesIdPermissionsHandler(mockGrants),
    getPermissionsResourcesHandler([]),
    getMePermissionsHandler({
      grants: { roles: ['view', 'edit'], permissions: ['view', 'edit'] },
    })
  )
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('RolesDetail', () => {
  it('shows whether the role is the default when registration is open', async () => {
    server.use(
      getRegistrationStatusHandler(() =>
        getRegistrationStatusHandlerResponse200({
          open: true,
          providers: [],
          email: true,
        })
      )
    )
    renderRolesDetail()
    expect(await screen.findByText('Default for new users')).toBeInTheDocument()
  })

  it('hides the default flag when registration is closed', async () => {
    // The default handler answers { open: false } (and the flag stays hidden
    // while the status loads)
    renderRolesDetail()
    await screen.findByText('Permissions')
    expect(screen.queryByText('Default for new users')).not.toBeInTheDocument()
  })

  it('renders the role name', async () => {
    renderRolesDetail()
    expect(await screen.findByText('Admin')).toBeInTheDocument()
  })

  it('renders the role description', async () => {
    renderRolesDetail()
    expect(await screen.findByText('Full access')).toBeInTheDocument()
  })

  it('renders the created at date', async () => {
    renderRolesDetail()
    await screen.findByText('Admin')
    expect(screen.getAllByText(/\d+\/\d+\/\d+/).length).toBeGreaterThanOrEqual(
      1
    )
  })

  it('renders the Permissions section', async () => {
    renderRolesDetail()
    expect(await screen.findByText('Permissions')).toBeInTheDocument()
  })

  it('shows Edit permissions button when user has permissions:edit', async () => {
    renderRolesDetail()
    expect(
      await screen.findByRole('button', { name: 'Edit permissions' })
    ).toBeInTheDocument()
  })

  it('shows a role above the user as out of reach, with no actions', async () => {
    // The API's decision (privilege ceiling)
    server.use(getRolesIdHandler({ ...mockRole, manageable: false }))
    renderRolesDetail()
    expect(await screen.findByText('Above your role')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Edit permissions' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Edit' })
    ).not.toBeInTheDocument()
    // The grants still show, read-only
    expect(await screen.findByText('Permissions')).toBeInTheDocument()
  })

  it('hides Edit permissions button when user lacks permissions:edit', async () => {
    server.use(getMePermissionsHandler({ grants: { roles: ['view'] } }))
    renderRolesDetail()
    await screen.findByText('Admin')
    expect(
      screen.queryByRole('button', { name: 'Edit permissions' })
    ).not.toBeInTheDocument()
  })

  it('shows the role without its permissions when user lacks permissions:view', async () => {
    const grantsRequested = vi.fn()
    server.use(
      getMePermissionsHandler({ grants: { roles: ['view'] } }),
      getRolesIdPermissionsHandler(() => {
        grantsRequested()
        return new Response(null, { status: 403 })
      })
    )
    renderRolesDetail()
    expect(await screen.findByText('Admin')).toBeInTheDocument()
    expect(screen.queryByText('Permissions')).not.toBeInTheDocument()
    expect(grantsRequested).not.toHaveBeenCalled()
  })

  it('hides Edit permissions button when user can edit but not view permissions', async () => {
    server.use(
      getMePermissionsHandler({
        grants: { roles: ['view'], permissions: ['edit'] },
      })
    )
    renderRolesDetail()
    await screen.findByText('Admin')
    expect(
      screen.queryByRole('button', { name: 'Edit permissions' })
    ).not.toBeInTheDocument()
  })

  it('navigates to permissions edit when Edit permissions is clicked', async () => {
    renderRolesDetail()
    const editBtn = await screen.findByRole('button', {
      name: 'Edit permissions',
    })
    await userEvent.click(editBtn)
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/roles/$id/permissions',
      params: { id: '1' },
    })
  })

  it('shows the admin role as locked, with no actions', async () => {
    server.use(
      getRolesIdHandler(
        createRoleDetail({
          isAdmin: true,
          manageable: false,
          id: '1',
          name: 'Administrator',
        })
      ),
      getMePermissionsHandler({
        grants: { roles: ['view', 'edit'], permissions: ['view', 'edit'] },
      })
    )
    renderRolesDetail()
    expect(await screen.findByText('Admin role')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Edit permissions' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Edit' })
    ).not.toBeInTheDocument()
  })
})
