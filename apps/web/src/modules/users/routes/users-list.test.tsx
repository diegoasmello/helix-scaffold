import {
  createRole,
  createUser,
  deleteUsersIdHandler,
  deleteUsersIdHandlerResponse204,
  getMePermissionsHandler,
  getRolesHandler,
  getUsersHandler,
} from '@helix/api-client/mocks'
import { MantineProvider } from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import { UsersList } from './users-list'

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
          roleId: 'test-role',
        },
      },
      isPending: false,
    }),
  },
}))

const mockRoles = [
  createRole({ id: 'role-1', name: 'Admin', description: null }),
]

const mockUsers = [
  createUser({
    id: '1',
    name: 'Alice Silva',
    email: 'alice@example.com',
    emailVerified: true,
    roleId: 'role-1',
  }),
  createUser({
    id: '2',
    name: 'Bob Santos',
    email: 'bob@example.com',
    emailVerified: false,
    roleId: null,
  }),
]

function renderUsersList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<div>Loading...</div>}>
          <UsersList />
        </Suspense>
      </QueryClientProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(
    getUsersHandler(mockUsers),
    getRolesHandler(mockRoles),
    getMePermissionsHandler({
      grants: { users: ['view', 'create', 'edit', 'delete'] },
    })
  )
})

afterEach(() => vi.clearAllMocks())

describe('UsersList', () => {
  it('renders all users', async () => {
    renderUsersList()
    expect(await screen.findByText('Alice Silva')).toBeInTheDocument()
    expect(screen.getByText('Bob Santos')).toBeInTheDocument()
  })

  it('shows role name for user with role', async () => {
    renderUsersList()
    await screen.findByText('Alice Silva')
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('shows dash for user with no role', async () => {
    renderUsersList()
    await screen.findByText('Bob Santos')
    const rows = screen.getAllByRole('row')
    const bobRow = rows.find((r) => within(r).queryByText('Bob Santos'))!
    expect(within(bobRow).getByText('—')).toBeInTheDocument()
  })

  it('opens delete modal when delete button is clicked', async () => {
    renderUsersList()
    const deleteButtons = await screen.findAllByLabelText('Delete')
    await userEvent.click(deleteButtons[0])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Delete user')).toBeInTheDocument()
    expect(within(dialog).getByText('Alice Silva')).toBeInTheDocument()
  })

  it('calls DELETE endpoint and closes modal on confirm', async () => {
    let deletedId: string | undefined
    server.use(
      deleteUsersIdHandler(({ params }) => {
        deletedId = params.id as string
        return deleteUsersIdHandlerResponse204()
      })
    )
    renderUsersList()
    const deleteButtons = await screen.findAllByLabelText('Delete')
    await userEvent.click(deleteButtons[0])
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' })
    )
    await waitFor(() => expect(deletedId).toBe('1'))
  })

  it('closes delete modal on cancel', async () => {
    renderUsersList()
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
})
