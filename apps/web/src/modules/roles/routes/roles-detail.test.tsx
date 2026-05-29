import { createRole, getRolesIdHandler } from '@helix/api-client/mocks'
import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import { RolesDetail } from './roles-detail'

vi.mock('.', () => ({
  rolesDetailRoute: {
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: '1' }),
  },
}))

const mockRole = createRole({
  id: '1',
  name: 'Admin',
  description: 'Full access',
  createdAt: '2024-03-15T10:00:00.000Z',
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
  server.use(getRolesIdHandler(mockRole))
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('RolesDetail', () => {
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
})
