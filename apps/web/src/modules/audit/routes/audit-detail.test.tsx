import {
  createAuditLog,
  getAuditLogsIdHandler,
  getMePermissionsHandler,
} from '@helix/api-client/mocks'
import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import { AuditDetail } from './audit-detail'

vi.mock('.', () => ({
  auditDetailRoute: {
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: 'log-1' }),
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

const mockLog = createAuditLog({
  id: 'log-1',
  userId: 'u1',
  userName: 'Alice Silva',
  userEmail: 'alice@example.com',
  action: 'create',
  resource: 'todos',
  resourceId: 't1',
  metadata: { title: 'My Todo', description: 'Desc' },
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0',
  createdAt: '2026-01-01T10:00:00.000Z',
})

function renderAuditDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div>Loading...</div>}>
            <AuditDetail />
          </Suspense>
        </QueryClientProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(
    getAuditLogsIdHandler(mockLog),
    getMePermissionsHandler({ grants: { audit: ['view'] } })
  )
})

afterEach(() => vi.clearAllMocks())

describe('AuditDetail', () => {
  it('renders the page title', async () => {
    renderAuditDetail()
    expect(
      await screen.findByRole('heading', { name: 'View Audit Log' })
    ).toBeInTheDocument()
  })

  it('renders user information', async () => {
    renderAuditDetail()
    await screen.findByText('Alice Silva')
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
  })

  it('renders resource and resource id', async () => {
    renderAuditDetail()
    await screen.findByText('todos')
    expect(screen.getByText('t1')).toBeInTheDocument()
  })

  it('renders IP address', async () => {
    renderAuditDetail()
    expect(await screen.findByText('192.168.1.1')).toBeInTheDocument()
  })

  it('renders metadata as formatted JSON', async () => {
    renderAuditDetail()
    await screen.findByText('Alice Silva')
    expect(screen.getByText(/My Todo/)).toBeInTheDocument()
  })

  it('hides metadata section when metadata is null', async () => {
    server.use(getAuditLogsIdHandler({ ...mockLog, metadata: null }))
    renderAuditDetail()
    await screen.findByText('Alice Silva')
    expect(screen.queryByText('Metadata')).not.toBeInTheDocument()
  })
})
