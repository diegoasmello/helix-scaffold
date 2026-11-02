import {
  createPaginatedTodos,
  createTodo,
  deleteTodosIdHandler,
  deleteTodosIdHandlerResponse204,
  getTodosHandler,
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
import { TodoList } from './todos-list'

const mockNavigate = vi.hoisted(() => vi.fn())
const mockSearch = vi.hoisted(() => ({
  state: {
    page: 1,
    pageSize: 10,
    sortOrder: 'desc' as const,
    filterLogic: 'AND' as const,
    filters: undefined as string | undefined,
  },
}))

vi.mock('.', () => ({
  todoListRoute: {
    useNavigate: () => mockNavigate,
    useSearch: () => mockSearch.state,
  },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useBlocker: vi.fn() }
})

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
      <MantineEmotionProvider>
        <ModalsProvider>
          <QueryClientProvider client={queryClient}>
            <Suspense fallback={<div>Loading...</div>}>
              <TodoList />
            </Suspense>
          </QueryClientProvider>
        </ModalsProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  mockSearch.state = {
    page: 1,
    pageSize: 10,
    sortOrder: 'desc',
    filterLogic: 'AND',
    filters: undefined,
  }
  mockNavigate.mockReset()
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
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
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
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' })
    )
    await waitFor(() => expect(deletedId).toBe('1'))
  })

  it('closes delete modal on cancel', async () => {
    renderTodoList()
    await screen.findByText('Review quarterly report')
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' })
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
  })
})

describe('Filter panel', () => {
  it('renders Filters button without badge when no filters are active', async () => {
    renderTodoList()
    await screen.findByText('Review quarterly report')
    const filtersBtn = screen.getByRole('button', { name: /filters/i })
    expect(filtersBtn).toBeInTheDocument()
    expect(filtersBtn.textContent).not.toMatch(/\d/)
  })

  it('opens the filter panel when Filters button is clicked', async () => {
    renderTodoList()
    await screen.findByText('Review quarterly report')

    await userEvent.click(screen.getByRole('button', { name: /filters/i }))

    expect(
      await screen.findByRole('button', { name: 'Add filter' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument()
  })

  it('closes the filter panel when Filters button is clicked again', async () => {
    renderTodoList()
    await screen.findByText('Review quarterly report')
    await userEvent.click(screen.getByRole('button', { name: /filters/i }))
    await screen.findByRole('button', { name: 'Add filter' })

    await userEvent.click(screen.getByRole('button', { name: /filters/i }))
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Add filter' })
      ).not.toBeInTheDocument()
    )
  })

  it('shows filter badge with count when filters are active in the URL', async () => {
    mockSearch.state = {
      ...mockSearch.state,
      filters: JSON.stringify([
        { field: 'status', op: 'eq', value: 'pending' },
      ]),
    }
    renderTodoList()
    await screen.findByText('Review quarterly report')
    const filtersBtn = screen.getByRole('button', { name: /filters/i })
    expect(within(filtersBtn).getByText('1')).toBeInTheDocument()
  })

  it('renders the list without a badge when the filters param is malformed', async () => {
    mockSearch.state = { ...mockSearch.state, filters: 'abc' }
    renderTodoList()
    await screen.findByText('Review quarterly report')
    const filtersBtn = screen.getByRole('button', { name: /filters/i })
    expect(filtersBtn.textContent).not.toMatch(/\d/)
  })

  it('auto-opens filter panel when URL contains active filters', async () => {
    mockSearch.state = {
      ...mockSearch.state,
      filters: JSON.stringify([
        { field: 'status', op: 'eq', value: 'pending' },
      ]),
    }
    renderTodoList()
    await screen.findByText('Review quarterly report')
    expect(
      await screen.findByRole('button', { name: 'Apply' })
    ).toBeInTheDocument()
  })

  it('adds a condition row when Add filter is clicked', async () => {
    renderTodoList()
    await screen.findByText('Review quarterly report')
    await userEvent.click(screen.getByRole('button', { name: /filters/i }))
    await screen.findByRole('button', { name: 'Add filter' })

    await userEvent.click(screen.getByRole('button', { name: 'Add filter' }))

    expect(await screen.findByLabelText('Remove filter')).toBeInTheDocument()
  })

  it('calls navigate with JSON-encoded filters when Apply is clicked', async () => {
    renderTodoList()
    await screen.findByText('Review quarterly report')
    await userEvent.click(screen.getByRole('button', { name: /filters/i }))
    await screen.findByRole('button', { name: 'Add filter' })

    await userEvent.click(screen.getByRole('button', { name: 'Add filter' }))
    await screen.findByLabelText('Remove filter')

    const valueInput = screen.getByPlaceholderText('Value')
    await userEvent.type(valueInput, 'test')

    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ search: expect.any(Function) })
    )
    const searchFn = (
      mockNavigate.mock.calls[0][0] as { search: (prev: object) => object }
    ).search
    const result = searchFn({ page: 2, pageSize: 10 }) as Record<
      string,
      unknown
    >
    expect(result.page).toBe(1)
    expect(typeof result.filters).toBe('string')
    expect(result.filterLogic).toBe('AND')
  })

  it('calls navigate with filters=undefined when Clear is clicked', async () => {
    mockSearch.state = {
      ...mockSearch.state,
      filters: JSON.stringify([
        { field: 'status', op: 'eq', value: 'pending' },
      ]),
    }
    renderTodoList()
    await screen.findByText('Review quarterly report')
    await screen.findByRole('button', { name: 'Apply' })

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ search: expect.any(Function) })
    )
    const searchFn = (
      mockNavigate.mock.calls[0][0] as { search: (prev: object) => object }
    ).search
    const result = searchFn({ page: 2 }) as Record<string, unknown>
    expect(result.filters).toBeUndefined()
    expect(result.page).toBe(1)
  })

  describe('on small screens', () => {
    const originalMatchMedia = window.matchMedia

    beforeEach(() => {
      // Below the `sm` breakpoint: every `min-width` query fails.
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        ...originalMatchMedia(query),
        matches: !query.includes('min-width'),
      }))
    })

    afterEach(() => {
      window.matchMedia = originalMatchMedia
    })

    it('renders one card per todo instead of a table', async () => {
      renderTodoList()
      await screen.findByText('Review quarterly report')
      expect(screen.queryByRole('table')).not.toBeInTheDocument()

      const cards = screen.getAllByRole('listitem')
      expect(cards).toHaveLength(2)
      const first = within(cards[0])
      expect(first.getByText('Review quarterly report')).toBeInTheDocument()
      expect(first.getByText('Status')).toBeInTheDocument()
      expect(first.getByText('Completed')).toBeInTheDocument()
      expect(first.getByRole('button', { name: 'View' })).toBeInTheDocument()
      expect(first.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    })

    it('deletes from a card', async () => {
      renderTodoList()
      await screen.findByText('Review quarterly report')
      const [first] = screen.getAllByRole('listitem')
      await userEvent.click(
        within(first).getByRole('button', { name: 'Delete' })
      )
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText('Delete todo')).toBeInTheDocument()
    })

    it('pages with previous/next buttons', async () => {
      server.use(
        getTodosHandler(
          createPaginatedTodos({
            data: mockTodos,
            total: 25,
            page: 1,
            pageSize: 10,
            totalPages: 3,
          })
        )
      )
      renderTodoList()
      expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

      await userEvent.click(screen.getByRole('button', { name: 'Next' }))
      const [{ search }] = mockNavigate.mock.calls.at(-1) as [
        { search: (prev: typeof mockSearch.state) => typeof mockSearch.state },
      ]
      expect(search(mockSearch.state).page).toBe(2)
    })
  })
})
