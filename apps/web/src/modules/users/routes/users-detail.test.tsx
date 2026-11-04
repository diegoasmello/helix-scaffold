import { createUserWithRole, getUsersIdHandler } from '@helix/api-client/mocks'
import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import { UsersDetail } from './users-detail'

vi.mock('.', () => ({
  usersDetailRoute: {
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: '1' }),
  },
}))

const mockUser = createUserWithRole({
  id: '1',
  name: 'Alice Silva',
  email: 'alice@example.com',
  emailVerified: true,
  roleId: 'role-1',
  role: { id: 'role-1', name: 'Admin', isAdmin: false },
})

function renderUsersDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div>Loading...</div>}>
            <UsersDetail />
          </Suspense>
        </QueryClientProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(getUsersIdHandler(mockUser))
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('UsersDetail', () => {
  it('renders the user name', async () => {
    renderUsersDetail()
    expect(await screen.findByText('Alice Silva')).toBeInTheDocument()
  })

  it('renders the user email', async () => {
    renderUsersDetail()
    expect(await screen.findByText('alice@example.com')).toBeInTheDocument()
  })

  it('renders the role name', async () => {
    renderUsersDetail()
    expect(await screen.findByText('Admin')).toBeInTheDocument()
  })

  it('renders Yes when email is verified', async () => {
    renderUsersDetail()
    await screen.findByText('Alice Silva')
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })

  it('renders No when email is not verified', async () => {
    server.use(
      getUsersIdHandler(
        createUserWithRole({ ...mockUser, emailVerified: false })
      )
    )
    renderUsersDetail()
    await screen.findByText('Alice Silva')
    expect(screen.getByText('No')).toBeInTheDocument()
  })
})
