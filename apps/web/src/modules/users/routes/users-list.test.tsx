import {
  createPaginatedUsers,
  createUserWithRole,
  deleteUsersIdHandler,
  deleteUsersIdHandlerResponse204,
  deleteUsersIdHandlerResponse403,
  getMePermissionsHandler,
  getUsersHandler,
  getUsersHandlerResponse200,
} from '@helix/api-client/mocks'
import {
  MantineEmotionProvider,
  MantineProvider,
  ModalsProvider,
} from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { parseISO } from 'date-fns'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { formatDate } from '@/utils/date'

import { server } from '../../../mocks/server'
import { UsersList } from './users-list'

const mockNotify = vi.hoisted(() => vi.fn())

vi.mock('@helix/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@helix/ui')>()),
  notify: mockNotify,
}))

vi.mock('.', () => ({
  usersListRoute: {
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

const mockUsers = [
  createUserWithRole({
    id: '1',
    name: 'Alice Silva',
    email: 'alice@example.com',
    emailVerified: true,
    roleId: 'role-1',
    role: { id: 'role-1', name: 'Admin', isAdmin: false },
    createdAt: '2026-03-12T10:00:00.000Z',
  }),
  createUserWithRole({
    id: '2',
    name: 'Bob Santos',
    email: 'bob@example.com',
    emailVerified: false,
    roleId: null,
    role: null,
  }),
]

function renderUsersList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <ModalsProvider>
          <QueryClientProvider client={queryClient}>
            <Suspense fallback={<div>Loading...</div>}>
              <UsersList />
            </Suspense>
          </QueryClientProvider>
        </ModalsProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(
    getUsersHandler(
      createPaginatedUsers({
        data: mockUsers,
        total: mockUsers.length,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      })
    ),
    getMePermissionsHandler({
      grants: { users: ['view', 'create', 'edit', 'delete'] },
    })
  )
})

afterEach(() => vi.clearAllMocks())

describe('UsersList', () => {
  it('shows the role as a badge and the creation date', async () => {
    renderUsersList()
    await screen.findByText('Alice Silva')
    const row = screen
      .getAllByRole('row')
      .find((r) => within(r).queryByText('Alice Silva'))!
    expect(
      within(row).getByText('Admin').closest('.mantine-Badge-root')
    ).not.toBeNull()
    expect(
      within(row).getByText(
        formatDate(parseISO('2026-03-12T10:00:00.000Z'), 'short')
      )
    ).toBeInTheDocument()
  })

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
    const deleteButtons = await screen.findAllByRole('button', {
      name: 'Delete',
    })
    await userEvent.click(deleteButtons[0])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Delete user')).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        `Are you sure you want to delete "Alice Silva"? This action cannot be undone.`
      )
    ).toBeInTheDocument()
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
    const deleteButtons = await screen.findAllByRole('button', {
      name: 'Delete',
    })
    await userEvent.click(deleteButtons[0])
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' })
    )
    await waitFor(() => expect(deletedId).toBe('1'))
  })

  it('refetches the list after deleting, so the row disappears', async () => {
    let users = mockUsers
    server.use(
      getUsersHandler(() =>
        getUsersHandlerResponse200(
          createPaginatedUsers({
            data: users,
            total: users.length,
            page: 1,
            pageSize: 10,
            totalPages: 1,
          })
        )
      ),
      deleteUsersIdHandler(({ params }) => {
        users = users.filter((u) => u.id !== params.id)
        return deleteUsersIdHandlerResponse204()
      })
    )
    renderUsersList()
    const deleteButtons = await screen.findAllByRole('button', {
      name: 'Delete',
    })
    await userEvent.click(deleteButtons[0])
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' })
    )
    await waitFor(() =>
      expect(screen.queryByText('Alice Silva')).not.toBeInTheDocument()
    )
    expect(screen.getByText('Bob Santos')).toBeInTheDocument()
  })

  it('closes delete modal on cancel', async () => {
    renderUsersList()
    const deleteButtons = await screen.findAllByRole('button', {
      name: 'Delete',
    })
    await userEvent.click(deleteButtons[0])
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' })
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
  })

  it('offers only View on the admin account', async () => {
    server.use(
      getUsersHandler(
        createPaginatedUsers({
          data: [
            createUserWithRole({
              id: '9',
              name: 'Root Admin',
              roleId: 'role-admin',
              role: { id: 'role-admin', name: 'Administrator', isAdmin: true },
            }),
          ],
          total: 1,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        })
      )
    )
    renderUsersList()
    await screen.findByText('Root Admin')
    expect(
      await screen.findByRole('button', { name: 'View' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Edit' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Delete' })
    ).not.toBeInTheDocument()
  })

  it('explains why the API refused the deletion', async () => {
    server.use(
      deleteUsersIdHandler(() =>
        deleteUsersIdHandlerResponse403({
          message: 'This user has permissions your own role lacks',
          code: 'user_not_editable',
        })
      )
    )
    renderUsersList()
    const deleteButtons = await screen.findAllByRole('button', {
      name: 'Delete',
    })
    await userEvent.click(deleteButtons[0])
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' })
    )
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith({
        status: 'danger',
        message:
          "You can't change the email or role of a user with permissions your own role doesn't have, nor delete them.",
      })
    )
  })
})
