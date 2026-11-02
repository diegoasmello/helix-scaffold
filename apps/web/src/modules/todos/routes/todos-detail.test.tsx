import {
  createTodo,
  createUpload,
  deleteTodosIdHandler,
  deleteTodosIdHandlerResponse204,
  getTodosIdHandler,
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
import { TodoDetail } from './todos-detail'

const mockNavigate = vi.hoisted(() => vi.fn())

vi.mock('.', () => ({
  todoDetailRoute: {
    useNavigate: () => mockNavigate,
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
        <ModalsProvider>
          <QueryClientProvider client={queryClient}>
            <Suspense fallback={<div>Loading...</div>}>
              <TodoDetail />
            </Suspense>
          </QueryClientProvider>
        </ModalsProvider>
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
    expect(screen.getAllByText(/\d+\/\d+\/\d+/).length).toBeGreaterThanOrEqual(
      1
    )
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
      getTodosIdHandler(
        createTodo({ ...completedTodo, attachments: [attachment] })
      )
    )
    renderTodoDetail()
    expect(await screen.findByText('design.pdf')).toBeInTheDocument()
  })

  it('does not render the attachments section when item has no attachments', async () => {
    renderTodoDetail()
    await screen.findByText('Review quarterly report')
    expect(screen.queryByText('Attachments')).not.toBeInTheDocument()
  })

  it('opens the edit page from the header', async () => {
    renderTodoDetail()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/todos/$id/edit',
      params: { id: '1' },
    })
  })

  it('deletes after confirming and goes back to the list', async () => {
    let deletedId: string | undefined
    server.use(
      deleteTodosIdHandler((info) => {
        deletedId = info.params.id as string
        return deleteTodosIdHandlerResponse204()
      })
    )
    renderTodoDetail()
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' })
    )
    await waitFor(() => expect(deletedId).toBe('1'))
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/todos' })
    )
  })
})
