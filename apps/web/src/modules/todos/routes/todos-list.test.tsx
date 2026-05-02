import {
  createPaginatedTodos,
  createTodo,
  deleteTodosIdHandler,
  deleteTodosIdHandlerResponse204,
  getTodosHandler,
} from '@helix/api-client/mocks'
import { MantineProvider, ModalsProvider } from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import { TodoList } from './todos-list'

vi.mock('.', () => ({
  todoListRoute: {
    useNavigate: () => vi.fn(),
    useSearch: () => ({ page: 1, pageSize: 10, sortOrder: 'desc' }),
  },
}))

const mockTodos = [
  createTodo({
    id: '1',
    title: 'Review quarterly report',
    status: 'completed',
  }),
  createTodo({
    id: '2',
    title: 'Update project documentation',
    status: 'pending',
  }),
]

function renderTodoList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <ModalsProvider>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div>Loading...</div>}>
            <TodoList />
          </Suspense>
        </QueryClientProvider>
      </ModalsProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(
    getTodosHandler(
      createPaginatedTodos({
        data: mockTodos,
        total: mockTodos.length,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      })
    )
  )
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('TodoList', () => {
  it('renders all todo items', async () => {
    renderTodoList()
    expect(
      await screen.findByText('Review quarterly report')
    ).toBeInTheDocument()
    expect(screen.getByText('Update project documentation')).toBeInTheDocument()
  })

  it('shows completed badge for completed todos', async () => {
    renderTodoList()
    await screen.findByText('Review quarterly report')
    const rows = screen.getAllByRole('row')
    const completedRow = rows.find((r) =>
      within(r).queryByText('Review quarterly report')
    )!
    expect(within(completedRow).getByText('Completed')).toBeInTheDocument()
  })

  it('shows pending badge for pending todos', async () => {
    renderTodoList()
    await screen.findByText('Update project documentation')
    const rows = screen.getAllByRole('row')
    const pendingRow = rows.find((r) =>
      within(r).queryByText('Update project documentation')
    )!
    expect(within(pendingRow).getByText('Pending')).toBeInTheDocument()
  })

  it('opens delete modal when delete button is clicked', async () => {
    renderTodoList()
    await screen.findByText('Review quarterly report')
    await userEvent.click(screen.getAllByLabelText('Delete')[0])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Delete todo')).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        'Are you sure you want to delete this todo? This action cannot be undone.'
      )
    ).toBeInTheDocument()
  })

  it('calls delete endpoint and closes modal on confirm', async () => {
    let deletedId: string | undefined
    server.use(
      deleteTodosIdHandler((info) => {
        deletedId = info.params.id as string
        return deleteTodosIdHandlerResponse204()
      })
    )

    renderTodoList()
    await screen.findByText('Review quarterly report')
    await userEvent.click(screen.getAllByLabelText('Delete')[0])
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' })
    )
    await waitFor(() => expect(deletedId).toBe('1'))
  })

  it('closes delete modal on cancel', async () => {
    renderTodoList()
    await screen.findByText('Review quarterly report')
    await userEvent.click(screen.getAllByLabelText('Delete')[0])
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' })
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
  })
})
