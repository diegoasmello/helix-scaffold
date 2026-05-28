import {
  createAuditLog,
  createPaginatedAuditLogs,
  getAuditLogsHandler,
  getMePermissionsHandler,
} from '@helix/api-client/mocks'
import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import { AuditList } from './audit-list'

vi.mock('.', () => ({
  auditListRoute: {
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
          name: 'Test',
          email: 'test@example.com',
          image: null,
          roleId: 'test-role',
        },
      },
      isPending: false,
    }),
  },
}))

const mockLogs = [
  createAuditLog({
    id: 'log-1',
    userId: 'u1',
    userName: 'Alice Silva',
    userEmail: 'alice@example.com',
    action: 'create',
    resource: 'todos',
    resourceId: 't1',
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    createdAt: '2026-01-01T10:00:00.000Z',
  }),
  createAuditLog({
    id: 'log-2',
    userId: 'u1',
    userName: 'Alice Silva',
    userEmail: 'alice@example.com',
    action: 'delete',
    resource: 'roles',
    resourceId: 'r1',
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    createdAt: '2026-01-01T12:00:00.000Z',
  }),
]

function renderAuditList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div>Loading...</div>}>
            <AuditList />
          </Suspense>
        </QueryClientProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(
    getAuditLogsHandler(
      createPaginatedAuditLogs({
        data: mockLogs,
        total: mockLogs.length,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      })
    ),
    getMePermissionsHandler({ grants: { audit: ['view'] } })
  )
})

afterEach(() => vi.clearAllMocks())

describe('AuditList', () => {
  it('renders all audit log entries', async () => {
    renderAuditList()
    const cells = await screen.findAllByText('Alice Silva')
    expect(cells).toHaveLength(2)
  })

  it('shows action badges', async () => {
    renderAuditList()
    await screen.findAllByText('Alice Silva')
    expect(screen.getByText('create')).toBeInTheDocument()
    expect(screen.getByText('delete')).toBeInTheDocument()
  })

  it('shows resource names', async () => {
    renderAuditList()
    await screen.findByText('todos')
    expect(screen.getByText('roles')).toBeInTheDocument()
  })

  it('shows dash when resourceId is null', async () => {
    server.use(
      getAuditLogsHandler(
        createPaginatedAuditLogs({
          data: [{ ...mockLogs[0], resourceId: null }],
          total: 1,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        })
      )
    )
    renderAuditList()
    await screen.findByText('Alice Silva')
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders empty state when no logs exist', async () => {
    server.use(
      getAuditLogsHandler(
        createPaginatedAuditLogs({
          data: [],
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 0,
        })
      )
    )
    renderAuditList()
    await screen.findByText('Audit Log')
    expect(
      screen.queryByRole('row', { name: /alice/i })
    ).not.toBeInTheDocument()
  })
})
