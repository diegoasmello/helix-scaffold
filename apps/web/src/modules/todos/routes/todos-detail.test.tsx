import { createTodo, createUpload, getTodosIdHandler } from '@helix/api-client/mocks'
import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import { TodoDetail } from './todos-detail'

vi.mock('.', () => ({
  todoDetailRoute: {
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: '1' }),
  },
}))

const completedTodo = createTodo({
  id: '1',
  title: 'Review quarterly report',
  description: 'Go through the Q1 report.',
  date: '2020-04-10',
  status: 'completed',
  attachments: [],
})

function renderTodoDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div>Loading...</div>}>
            <TodoDetail />
          </Suspense>
        </QueryClientProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(getTodosIdHandler(completedTodo))
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('TodoDetail', () => {
  it('renders the item title, description and date', async () => {
    renderTodoDetail()
    expect(
      await screen.findByText('Review quarterly report')
    ).toBeInTheDocument()
    expect(screen.getByText('Go through the Q1 report.')).toBeInTheDocument()
    expect(screen.getAllByText(/\d+\/\d+\/\d+/).length).toBeGreaterThanOrEqual(1)
  })

  it('shows Completed badge for completed items', async () => {
    renderTodoDetail()
    expect(await screen.findByText('Completed')).toBeInTheDocument()
  })

  it('shows Pending badge for pending items', async () => {
    server.use(
      getTodosIdHandler(createTodo({ ...completedTodo, status: 'pending' }))
    )
    renderTodoDetail()
    expect(await screen.findByText('Pending')).toBeInTheDocument()
  })

  it('renders attachment filenames when item has attachments', async () => {
    const attachment = createUpload({
      id: 'att-1',
      originalName: 'design.pdf',
      mimeType: 'application/pdf',
      variants: null,
    })
    server.use(
      getTodosIdHandler(createTodo({ ...completedTodo, attachments: [attachment] }))
    )
    renderTodoDetail()
    expect(await screen.findByText('design.pdf')).toBeInTheDocument()
  })

  it('does not render the attachments section when item has no attachments', async () => {
    renderTodoDetail()
    await screen.findByText('Review quarterly report')
    expect(screen.queryByText('Attachments')).not.toBeInTheDocument()
  })
})
